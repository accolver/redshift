import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { Database } from 'bun:sqlite';
import { RecoveryError, RedshiftError } from './errors';

const mutexTails = new Map<string, Promise<void>>();

export async function acquireSqliteStorageLock(
	lockPath: string,
	errorFactory: (message: string, error?: unknown) => Error = (message, error) =>
		new RecoveryError(message, error),
): Promise<() => Promise<void>> {
	const releaseInProcess = await acquireInProcessLock(lockPath);
	let database: Database | null = null;
	try {
		let bootstrapIdentity: { dev: number; ino: number } | null = null;
		const bootstrap = await open(
			lockPath,
			constants.O_RDWR | constants.O_CREAT | constants.O_NOFOLLOW,
			0o600,
		);
		try {
			const entry = await bootstrap.stat();
			if (!entry.isFile()) throw errorFactory('Storage lock must be a regular file');
			bootstrapIdentity = { dev: entry.dev, ino: entry.ino };
			await bootstrap.chmod(0o600);
		} finally {
			await bootstrap.close();
		}
		database = new Database(lockPath, { create: true, strict: true });
		const reopened = await lstat(lockPath);
		if (
			!bootstrapIdentity ||
			!reopened.isFile() ||
			reopened.isSymbolicLink() ||
			reopened.dev !== bootstrapIdentity.dev ||
			reopened.ino !== bootstrapIdentity.ino
		) {
			throw errorFactory('Storage lock changed while being acquired');
		}
		database.exec('PRAGMA busy_timeout = 5000; BEGIN IMMEDIATE');
	} catch (error) {
		try {
			database?.close(false);
		} finally {
			releaseInProcess();
		}
		if (error instanceof RedshiftError) throw error;
		throw errorFactory('Storage lock could not be acquired', error);
	}
	const acquiredDatabase = database;
	return async () => {
		try {
			try {
				acquiredDatabase.exec('COMMIT');
			} catch {
				acquiredDatabase.exec('ROLLBACK');
			}
		} finally {
			try {
				acquiredDatabase.close(false);
			} finally {
				releaseInProcess();
			}
		}
	};
}

async function acquireInProcessLock(lockPath: string) {
	let releaseCurrent: (() => void) | undefined;
	const current = new Promise<void>((resolve) => {
		releaseCurrent = resolve;
	});
	const previous = mutexTails.get(lockPath) ?? Promise.resolve();
	const tail = previous.then(() => current);
	mutexTails.set(lockPath, tail);
	await previous;
	return () => {
		releaseCurrent?.();
		void tail.finally(() => {
			if (mutexTails.get(lockPath) === tail) mutexTails.delete(lockPath);
		});
	};
}

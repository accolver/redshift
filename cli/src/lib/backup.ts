import { constants } from 'node:fs';
import { chmod, link, lstat, mkdir, open, readdir, rename, unlink } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { BACKUP_LIMITS } from '@redshift/crypto';
import { getConfigDir } from './config';
import { BackupError } from './errors';
import { acquireSqliteStorageLock } from './storage-lock';

export interface BackupWriteOptions {
	force?: boolean;
	syncDirectory?: () => Promise<void>;
}

export async function writeBackupArchive(
	path: string,
	archive: Uint8Array,
	options: BackupWriteOptions = {},
): Promise<void> {
	validateArchiveBytes(archive, 'write');
	await ensureBackupLockDirectory();
	const releaseLock = await acquireSqliteStorageLock(
		join(getConfigDir(), '.backup-lock.sqlite'),
		(message, error) => new BackupError(`Backup ${message.toLowerCase()}`, 'write', error),
	);
	try {
		const parent = dirname(path);
		await requireDirectory(parent);
		const syncParent = options.syncDirectory ?? (() => syncDirectory(parent));
		await cleanupOrphanTemps(path, syncParent);
		await reconcileBackup(path, syncParent, 'write');
		const existing = await inspectDestination(path);
		if (existing && !options.force)
			throw new BackupError('Backup destination already exists', 'write');
		const operationId = `${process.pid}.${crypto.randomUUID()}`;
		const tempPath = join(parent, `.${basename(path)}.${operationId}.tmp`);
		const backupPath = rollbackPath(path);
		const markerPath = commitMarkerPath(path);
		let handle: Awaited<ReturnType<typeof open>> | null = null;
		let markerHandle: Awaited<ReturnType<typeof open>> | null = null;
		let backupCreated = false;
		let markerCreated = false;
		let finalInstalled = false;
		try {
			handle = await open(
				tempPath,
				constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
				0o600,
			);
			await handle.writeFile(archive);
			await handle.sync();
			await handle.close();
			handle = null;
			if (existing) {
				await createRollbackLink(path, backupPath, existing.dev, existing.ino);
				backupCreated = true;
				await syncParent();
				await rename(tempPath, path);
			} else {
				try {
					await link(tempPath, path);
				} catch (error) {
					if (hasErrorCode(error, 'EEXIST')) {
						throw new BackupError('Backup destination already exists', 'write', error);
					}
					throw error;
				}
				await unlink(tempPath);
			}
			finalInstalled = true;
			await chmod(path, 0o600);
			await syncParent();
			if (backupCreated) {
				markerHandle = await open(
					markerPath,
					constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
					0o600,
				);
				await markerHandle.writeFile('committed');
				await markerHandle.sync();
				await markerHandle.close();
				markerHandle = null;
				markerCreated = true;
				await syncParent();
				await unlink(backupPath);
				backupCreated = false;
				await syncParent();
				await unlink(markerPath);
				markerCreated = false;
				await syncParent();
			}
		} catch (error) {
			if (finalInstalled && backupCreated && !markerCreated) {
				try {
					await rename(backupPath, path);
					backupCreated = false;
					await syncParent();
				} catch (restoreError) {
					throw new BackupError(
						'Failed to write backup; previous destination could not be restored',
						'write',
						restoreError,
					);
				}
			}
			if (error instanceof BackupError) throw error;
			throw new BackupError('Failed to write backup archive', 'write', error);
		} finally {
			if (handle) await handle.close().catch(() => {});
			if (markerHandle) await markerHandle.close().catch(() => {});
			await unlink(tempPath).catch(() => {});
			if (backupCreated && !markerCreated) await unlink(backupPath).catch(() => {});
		}
	} finally {
		await releaseLock();
	}
}

export async function readBackupArchive(path: string): Promise<Uint8Array> {
	await ensureBackupLockDirectory();
	const releaseLock = await acquireSqliteStorageLock(
		join(getConfigDir(), '.backup-lock.sqlite'),
		(message, error) => new BackupError(`Backup ${message.toLowerCase()}`, 'read', error),
	);
	try {
		const parent = dirname(path);
		await requireDirectory(parent);
		const syncParent = () => syncDirectory(parent);
		await cleanupOrphanTemps(path, syncParent);
		await reconcileBackup(path, syncParent, 'read');
		let handle: Awaited<ReturnType<typeof open>>;
		try {
			handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
		} catch (error) {
			throw new BackupError('Backup archive must be an existing regular file', 'read', error);
		}
		try {
			const entry = await handle.stat();
			if (!entry.isFile()) throw new BackupError('Backup archive must be a regular file', 'read');
			if ((entry.mode & 0o077) !== 0) {
				throw new BackupError('Backup archive must use owner-only permissions', 'read');
			}
			if (entry.size > BACKUP_LIMITS.maxArchiveBytes) {
				throw new BackupError('Backup archive is too large', 'read');
			}
			const bytes = new Uint8Array(entry.size);
			const { bytesRead } = await handle.read(bytes, 0, bytes.byteLength, 0);
			if (bytesRead !== bytes.byteLength) {
				bytes.fill(0);
				throw new BackupError('Backup archive changed while being read', 'read');
			}
			const extra = new Uint8Array(1);
			const trailing = await handle.read(extra, 0, 1, bytes.byteLength);
			const finalEntry = await handle.stat();
			if (trailing.bytesRead !== 0 || finalEntry.size !== entry.size) {
				bytes.fill(0);
				throw new BackupError('Backup archive changed while being read', 'read');
			}
			validateArchiveBytes(bytes, 'read');
			return bytes;
		} finally {
			await handle.close();
		}
	} finally {
		await releaseLock();
	}
}

async function createRollbackLink(
	path: string,
	backupPath: string,
	expectedDevice: number,
	expectedInode: number,
) {
	let handle: Awaited<ReturnType<typeof open>>;
	try {
		handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
	} catch (error) {
		throw new BackupError('Backup destination changed before replacement', 'write', error);
	}
	let linked = false;
	try {
		const entry = await handle.stat();
		if (!entry.isFile() || entry.dev !== expectedDevice || entry.ino !== expectedInode) {
			throw new BackupError('Backup destination changed before replacement', 'write');
		}
		await handle.chmod(0o600);
		await link(path, backupPath);
		linked = true;
		const rollback = await lstat(backupPath);
		if (
			!rollback.isFile() ||
			rollback.isSymbolicLink() ||
			rollback.dev !== entry.dev ||
			rollback.ino !== entry.ino
		) {
			throw new BackupError('Backup destination changed before replacement', 'write');
		}
	} catch (error) {
		if (linked) await unlink(backupPath).catch(() => {});
		throw error;
	} finally {
		await handle.close();
	}
}

async function inspectDestination(path: string) {
	const entry = await lstat(path).catch((error: unknown) => {
		if (hasErrorCode(error, 'ENOENT')) return null;
		throw new BackupError('Failed to inspect backup destination', 'write', error);
	});
	if (!entry) return null;
	if (!entry.isFile() || entry.isSymbolicLink()) {
		throw new BackupError('Backup destination must be a regular file', 'write');
	}
	return entry;
}

async function reconcileBackup(
	path: string,
	syncParent: () => Promise<void>,
	operation: 'read' | 'write',
) {
	const backupPath = rollbackPath(path);
	const markerPath = commitMarkerPath(path);
	const [backup, marker, destination] = await Promise.all([
		inspectOptionalArtifact(backupPath, 'rollback', operation),
		inspectOptionalArtifact(markerPath, 'commit marker', operation),
		lstat(path).catch((error: unknown) => {
			if (hasErrorCode(error, 'ENOENT')) return null;
			throw new BackupError('Failed to inspect backup destination', operation, error);
		}),
	]);
	if (marker && destination?.isFile() && !destination.isSymbolicLink()) {
		if (backup) {
			await unlink(backupPath);
			await syncParent();
		}
		await unlink(markerPath);
		await syncParent();
		return;
	}
	if (backup) {
		await rename(backupPath, path);
		await syncParent();
	}
	if (marker) {
		await unlink(markerPath);
		await syncParent();
	}
}

async function cleanupOrphanTemps(path: string, syncParent: () => Promise<void>) {
	const escaped = escapeRegExp(basename(path));
	const pattern = new RegExp(`^\\.${escaped}\\.\\d+\\.[0-9a-f-]{36}\\.tmp$`);
	const names = (await readdir(dirname(path))).filter((name) => pattern.test(name));
	if (names.length > 100)
		throw new BackupError('Too many orphaned backup temporary files', 'write');
	for (const name of names) {
		const orphanPath = join(dirname(path), name);
		await inspectRequiredArtifact(orphanPath, 'temporary', 'write');
		await unlink(orphanPath);
	}
	if (names.length > 0) await syncParent();
}

async function inspectOptionalArtifact(path: string, label: string, operation: 'read' | 'write') {
	const entry = await lstat(path).catch((error: unknown) => {
		if (hasErrorCode(error, 'ENOENT')) return null;
		throw new BackupError(`Failed to inspect backup ${label} state`, operation, error);
	});
	if (!entry) return null;
	if (!entry.isFile() || entry.isSymbolicLink() || (entry.mode & 0o077) !== 0) {
		throw new BackupError(`Backup ${label} state must be a regular owner-only file`, operation);
	}
	return entry;
}

async function inspectRequiredArtifact(path: string, label: string, operation: 'read' | 'write') {
	const entry = await inspectOptionalArtifact(path, label, operation);
	if (!entry) throw new BackupError(`Backup ${label} state disappeared`, operation);
	return entry;
}

async function requireDirectory(path: string) {
	let handle: Awaited<ReturnType<typeof open>>;
	try {
		handle = await open(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
	} catch (error) {
		throw new BackupError('Backup parent must be an existing regular directory', 'write', error);
	}
	try {
		if (!(await handle.stat()).isDirectory()) {
			throw new BackupError('Backup parent must be an existing regular directory', 'write');
		}
	} finally {
		await handle.close();
	}
}

async function syncDirectory(path: string) {
	const handle = await open(
		path,
		constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
	);
	try {
		await handle.sync();
	} finally {
		await handle.close();
	}
}

async function ensureBackupLockDirectory() {
	const path = getConfigDir();
	await mkdir(path, { recursive: true, mode: 0o700 });
	await chmod(path, 0o700);
}

function rollbackPath(path: string) {
	return join(dirname(path), `.${basename(path)}.redshift-backup`);
}

function commitMarkerPath(path: string) {
	return join(dirname(path), `.${basename(path)}.redshift-committed`);
}

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function validateArchiveBytes(archive: Uint8Array, operation: 'read' | 'write') {
	if (!(archive instanceof Uint8Array) || archive.byteLength === 0) {
		throw new BackupError('Backup archive must contain encrypted bytes', operation);
	}
	if (archive.byteLength > BACKUP_LIMITS.maxArchiveBytes) {
		throw new BackupError('Backup archive is too large', operation);
	}
}

function hasErrorCode(error: unknown, code: string) {
	return Boolean(
		error &&
			typeof error === 'object' &&
			'code' in error &&
			(error as { code?: unknown }).code === code,
	);
}

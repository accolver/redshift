import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
	chmod,
	link,
	lstat,
	mkdir,
	mkdtemp,
	readFile,
	rename,
	rm,
	stat,
	symlink,
	writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { BACKUP_LIMITS, encryptBackup, type BackupPayloadV1 } from '@redshift/crypto';
import { readBackupArchive, writeBackupArchive } from '../../src/lib/backup';

let root = '';

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), 'redshift-backup-file-'));
	process.env.REDSHIFT_CONFIG_DIR = join(root, 'config');
});

afterEach(async () => {
	delete process.env.REDSHIFT_CONFIG_DIR;
	await rm(root, { recursive: true, force: true });
});

function payload(value = 'secret'): BackupPayloadV1 {
	return {
		schema: 'com.redshiftapp.backup',
		version: 1,
		createdAt: 1_700_000_000,
		sourcePubkey: 'a'.repeat(64),
		contents: {
			secretState: 'current-observed',
			projectMetadata: 'identifiers-only',
			relayConfiguration: 'excluded',
			signerCredentials: 'excluded',
			historyAndTombstones: 'excluded',
		},
		entries: [
			{
				project: 'project',
				environment: 'dev',
				sourceCreatedAt: 1_699_999_999,
				sourceEventId: 'b'.repeat(64),
				secrets: [['API_KEY', value]],
			},
		],
	};
}

describe('encrypted backup archive files', () => {
	it('creates only an encrypted owner-only regular file without clobbering by default', async () => {
		const path = join(root, 'backup.redshift');
		const archive = await encryptBackup(payload(), 'correct horse battery staple');
		await writeBackupArchive(path, archive);
		expect(await readBackupArchive(path)).toEqual(archive);
		expect((await stat(path)).mode & 0o777).toBe(0o600);
		expect(new TextDecoder().decode(await readFile(path))).not.toContain('secret');
		await expect(writeBackupArchive(path, archive)).rejects.toThrow('already exists');
	});

	it('atomically replaces a regular destination only with force', async () => {
		const path = join(root, 'backup.redshift');
		const first = await encryptBackup(payload('one'), 'correct horse battery staple');
		const second = await encryptBackup(payload('two'), 'correct horse battery staple');
		await writeFile(path, first, { mode: 0o644 });
		await writeBackupArchive(path, second, { force: true });
		expect(await readBackupArchive(path)).toEqual(second);
		expect((await stat(path)).mode & 0o777).toBe(0o600);
	});

	it('restores the prior destination when post-replacement directory sync fails', async () => {
		const path = join(root, 'backup.redshift');
		const first = await encryptBackup(payload('one'), 'correct horse battery staple');
		const second = await encryptBackup(payload('two'), 'correct horse battery staple');
		await writeBackupArchive(path, first);
		let syncCalls = 0;
		await expect(
			writeBackupArchive(path, second, {
				force: true,
				syncDirectory: async () => {
					syncCalls += 1;
					if (syncCalls === 2) throw new Error('simulated sync failure');
				},
			}),
		).rejects.toThrow('Failed to write');
		expect(await readBackupArchive(path)).toEqual(first);
	});

	it('keeps a committed replacement when crash artifacts are reconciled', async () => {
		const path = join(root, 'backup.redshift');
		const first = await encryptBackup(payload('one'), 'correct horse battery staple');
		const second = await encryptBackup(payload('two'), 'correct horse battery staple');
		await writeBackupArchive(path, first);
		const backupPath = join(root, '.backup.redshift.redshift-backup');
		const markerPath = join(root, '.backup.redshift.redshift-committed');
		const tempPath = join(root, '.replacement.tmp');
		await link(path, backupPath);
		await writeFile(tempPath, second, { mode: 0o600 });
		await rename(tempPath, path);
		await writeFile(markerPath, 'committed', { mode: 0o600 });

		expect(await readBackupArchive(path)).toEqual(second);
		await expect(lstat(backupPath)).rejects.toThrow();
		await expect(lstat(markerPath)).rejects.toThrow();
	});

	it('rejects symlink, directory, special destination, and missing parent paths', async () => {
		const archive = await encryptBackup(payload(), 'correct horse battery staple');
		const real = join(root, 'real.redshift');
		await writeFile(real, archive, { mode: 0o600 });
		const link = join(root, 'link.redshift');
		await symlink(real, link);
		await expect(writeBackupArchive(link, archive, { force: true })).rejects.toThrow(
			'regular file',
		);
		await expect(readBackupArchive(link)).rejects.toThrow('regular file');
		const directory = join(root, 'directory.redshift');
		await mkdir(directory);
		await expect(writeBackupArchive(directory, archive, { force: true })).rejects.toThrow(
			'regular file',
		);
		const fifo = join(root, 'fifo.redshift');
		if (Bun.spawnSync(['mkfifo', fifo]).exitCode === 0) {
			await expect(writeBackupArchive(fifo, archive, { force: true })).rejects.toThrow(
				'regular file',
			);
		}
		await expect(writeBackupArchive(join(root, 'missing', 'backup'), archive)).rejects.toThrow();
	});

	it('rejects insecure and oversized archive inputs before returning bytes', async () => {
		const path = join(root, 'backup.redshift');
		const archive = await encryptBackup(payload(), 'correct horse battery staple');
		await writeFile(path, archive, { mode: 0o644 });
		await expect(readBackupArchive(path)).rejects.toThrow('owner-only');
		await chmod(path, 0o600);
		await writeFile(path, new Uint8Array(BACKUP_LIMITS.maxArchiveBytes + 1), { mode: 0o600 });
		await expect(readBackupArchive(path)).rejects.toThrow('too large');
	});

	it('cleans temporary and backup artifacts after success and failure', async () => {
		const path = join(root, 'backup.redshift');
		const archive = await encryptBackup(payload(), 'correct horse battery staple');
		const orphan = join(root, `.backup.redshift.123.${crypto.randomUUID()}.tmp`);
		await writeFile(orphan, archive, { mode: 0o600 });
		await writeBackupArchive(path, archive);
		const entries = await Array.fromAsync(new Bun.Glob('*').scan({ cwd: root, dot: true }));
		expect(entries).toEqual(['backup.redshift']);
		await rm(path);
		await expect(
			writeBackupArchive(path, archive, {
				syncDirectory: async () => Promise.reject(new Error('fail')),
			}),
		).rejects.toThrow();
		const remaining = await Array.fromAsync(new Bun.Glob('*').scan({ cwd: root, dot: true }));
		expect(remaining.every((name) => !name.includes('.tmp') && !name.includes('.backup'))).toBe(
			true,
		);
		await expect(lstat(path)).resolves.toBeDefined();
	});
});

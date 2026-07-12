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
	unlink,
	writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getPublicKey } from 'nostr-tools/pure';
import {
	createProvisionalRecoveryRecord,
	getRecoveryDir,
	listRecoveryRecords,
	loadRecoveryRecord,
	removeRecoveryRecord,
	saveRecoveryRecord,
	updateRecoveryRecord,
	validateRecoveryRecord,
} from '../../src/lib/publication-recovery';
import type { PublishReport } from '../../src/lib/relay';
import { SecretManager } from '../../src/lib/secret-manager';

let configDir = '';

beforeEach(async () => {
	configDir = await mkdtemp(join(tmpdir(), 'redshift-recovery-test-'));
	process.env.REDSHIFT_CONFIG_DIR = configDir;
});

afterEach(async () => {
	delete process.env.REDSHIFT_CONFIG_DIR;
	await rm(configDir, { recursive: true, force: true });
});

async function fixture(relays = ['wss://one.test', 'wss://two.test']) {
	const privateKey = crypto.getRandomValues(new Uint8Array(32));
	const manager = new SecretManager(privateKey);
	const { event } = await manager.wrapSecrets({ API_KEY: 'secret' }, 'project|dev');
	const record = createProvisionalRecoveryRecord({
		ownerPubkey: getPublicKey(privateKey),
		project: 'project',
		environment: 'dev',
		event,
		relays,
		now: Date.now(),
	});
	await manager.close();
	return { record, event };
}

describe('publication recovery storage', () => {
	it('writes a provisional regular record atomically with restrictive modes', async () => {
		const { record } = await fixture();
		await saveRecoveryRecord(record);

		const directory = await stat(getRecoveryDir());
		const file = await stat(join(getRecoveryDir(), `${record.event.id}.json`));
		expect(directory.mode & 0o777).toBe(0o700);
		expect(file.mode & 0o777).toBe(0o600);
		expect((await stat(join(getRecoveryDir(), '.recovery-lock.sqlite'))).mode & 0o777).toBe(0o600);
		expect(file.isFile()).toBe(true);
		expect((await loadRecoveryRecord(record.event.id)).event).toEqual(record.event);
		expect((await listRecoveryRecords()).map(({ event }) => event.id)).toEqual([record.event.id]);
	});

	it('replaces outcomes while preserving the original event and created timestamp', async () => {
		const { record } = await fixture();
		await saveRecoveryRecord(record);
		const report: PublishReport = {
			eventId: record.event.id,
			required: 2,
			accepted: ['wss://one.test/'],
			failed: [{ relay: 'wss://two.test/', reason: 'timeout' }],
			outcomes: [
				{ relay: 'wss://one.test/', state: 'accepted' },
				{ relay: 'wss://two.test/', state: 'unavailable', reason: 'timeout' },
			],
		};
		const updatedAt = record.createdAt + 1000;
		const updated = updateRecoveryRecord(record, report, updatedAt);
		await saveRecoveryRecord(updated, record.revision);
		const loaded = await loadRecoveryRecord(record.event.id);
		expect(loaded.createdAt).toBe(record.createdAt);
		expect(loaded.updatedAt).toBe(updatedAt);
		expect(loaded.event).toEqual(record.event);
		expect(loaded.report).toEqual(report);
	});

	it('restores the previous provisional record when post-rename directory sync fails', async () => {
		const { record } = await fixture();
		await saveRecoveryRecord(record);
		const report: PublishReport = {
			...record.report,
			accepted: [record.report.outcomes[0]?.relay ?? ''],
			failed: record.report.failed.slice(1),
			outcomes: record.report.outcomes.map((outcome, index) =>
				index === 0 ? { relay: outcome.relay, state: 'accepted' as const } : outcome,
			),
		};
		const updated = updateRecoveryRecord(record, report);
		let syncCalls = 0;
		await expect(
			saveRecoveryRecord(updated, record.revision, {
				syncDirectory: async () => {
					syncCalls += 1;
					if (syncCalls === 2) throw new Error('simulated directory sync failure');
				},
			}),
		).rejects.toThrow('Failed to persist');
		const restored = await loadRecoveryRecord(record.event.id);
		expect(restored.revision).toBe(record.revision);
		expect(restored.report).toEqual(record.report);
	});

	it('reconciles a crash-orphaned backup before exposing recovery state', async () => {
		const { record } = await fixture();
		await saveRecoveryRecord(record);
		const report: PublishReport = {
			...record.report,
			accepted: [record.report.outcomes[0]?.relay ?? ''],
			failed: record.report.failed.slice(1),
			outcomes: record.report.outcomes.map((outcome, index) =>
				index === 0 ? { relay: outcome.relay, state: 'accepted' as const } : outcome,
			),
		};
		const updated = updateRecoveryRecord(record, report);
		const finalPath = join(getRecoveryDir(), `${record.event.id}.json`);
		const backupPath = join(getRecoveryDir(), `.${record.event.id}.backup`);
		const replacementPath = join(getRecoveryDir(), '.simulated-replacement.tmp');
		await link(finalPath, backupPath);
		await writeFile(replacementPath, `${JSON.stringify(updated)}\n`, { mode: 0o600 });
		await rename(replacementPath, finalPath);

		const reconciled = await loadRecoveryRecord(record.event.id);
		expect(reconciled.revision).toBe(record.revision);
		await expect(lstat(backupPath)).rejects.toThrow();
	});

	it('serializes distinct-event capacity checks at the configured boundary', async () => {
		const existing = (await fixture()).record;
		await saveRecoveryRecord(existing, undefined, { maxRecords: 2 });
		const first = (await fixture()).record;
		const second = (await fixture()).record;
		const results = await Promise.allSettled([
			saveRecoveryRecord(first, undefined, { maxRecords: 2 }),
			saveRecoveryRecord(second, undefined, { maxRecords: 2 }),
		]);
		expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
		expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(1);
		expect(await listRecoveryRecords()).toHaveLength(2);
	});

	it('rejects updates that reuse the expected revision', async () => {
		const { record } = await fixture();
		await saveRecoveryRecord(record);
		await expect(
			saveRecoveryRecord({ ...record, updatedAt: record.updatedAt + 1 }, record.revision),
		).rejects.toThrow('new revision');
	});

	it('rejects stale concurrent outcome replacement', async () => {
		const { record } = await fixture();
		await saveRecoveryRecord(record);
		const accepted: PublishReport = {
			eventId: record.event.id,
			required: 2,
			accepted: ['wss://one.test/'],
			failed: [{ relay: 'wss://two.test/', reason: 'timeout' }],
			outcomes: [
				{ relay: 'wss://one.test/', state: 'accepted' },
				{ relay: 'wss://two.test/', state: 'unavailable', reason: 'timeout' },
			],
		};
		const first = updateRecoveryRecord(record, accepted, record.updatedAt);
		await saveRecoveryRecord(first, record.revision);
		const stale = updateRecoveryRecord(record, accepted, record.updatedAt);
		await expect(saveRecoveryRecord(stale, record.revision)).rejects.toThrow('concurrently');
	});

	it('recovers the storage lock after a holder is killed', async () => {
		const { record } = await fixture();
		await mkdir(getRecoveryDir(), { recursive: true, mode: 0o700 });
		const lockPath = join(getRecoveryDir(), '.recovery-lock.sqlite');
		const script = [
			'import { Database } from "bun:sqlite";',
			`const db = new Database(${JSON.stringify(lockPath)}, { create: true });`,
			'db.exec("BEGIN IMMEDIATE");',
			'console.log("locked");',
			'await new Promise(() => {});',
		].join('\n');
		const holder = Bun.spawn(['bun', '--eval', script], { stdout: 'pipe', stderr: 'pipe' });
		const reader = holder.stdout.getReader();
		const ready = await reader.read();
		expect(new TextDecoder().decode(ready.value)).toContain('locked');
		holder.kill('SIGKILL');
		await holder.exited;

		await saveRecoveryRecord(record);
		expect((await loadRecoveryRecord(record.event.id)).event.id).toBe(record.event.id);
	});

	it('rejects future timestamps and terminal control characters', async () => {
		const { record } = await fixture();
		expect(() => validateRecoveryRecord({ ...record, updatedAt: Date.now() + 120_000 })).toThrow(
			'future',
		);
		expect(() =>
			validateRecoveryRecord({
				...record,
				report: {
					...record.report,
					failed: record.report.failed.map((failure, index) =>
						index === 0 ? { ...failure, reason: 'timeout\n\u001b]0;owned\u0007' } : failure,
					),
					outcomes: record.report.outcomes.map((outcome, index) =>
						index === 0 ? { ...outcome, reason: 'timeout\n\u001b]0;owned\u0007' } : outcome,
					),
				},
			}),
		).toThrow('reason');
	});

	it('rejects report, event, owner, and relay tampering', async () => {
		const { record } = await fixture();
		expect(() => validateRecoveryRecord({ ...record, ownerPubkey: 'f'.repeat(64) })).toThrow(
			'recipient',
		);
		expect(() =>
			validateRecoveryRecord({ ...record, event: { ...record.event, content: 'tampered' } }),
		).toThrow('signature');
		expect(() =>
			validateRecoveryRecord({
				...record,
				report: { ...record.report, eventId: '0'.repeat(64) },
			}),
		).toThrow('event ID');
		expect(() =>
			validateRecoveryRecord({
				...record,
				report: {
					...record.report,
					outcomes: [record.report.outcomes[0], record.report.outcomes[0]],
				},
			}),
		).toThrow('relay outcomes');
		expect(() =>
			validateRecoveryRecord({
				...record,
				report: {
					...record.report,
					outcomes: record.report.outcomes.map((outcome, index) =>
						index === 0 ? { ...outcome, relay: 'ws://example.com' } : outcome,
					),
				},
			}),
		).toThrow('relay');
	});

	it('rejects path traversal, symlinks, non-regular records, and oversized files', async () => {
		const { record } = await fixture();
		await saveRecoveryRecord(record);
		await expect(loadRecoveryRecord('../config')).rejects.toThrow('event ID');

		const linkId = 'a'.repeat(64);
		await symlink(
			join(getRecoveryDir(), `${record.event.id}.json`),
			join(getRecoveryDir(), `${linkId}.json`),
		);
		await expect(loadRecoveryRecord(linkId)).rejects.toThrow('regular file');

		const directoryId = 'b'.repeat(64);
		await mkdir(join(getRecoveryDir(), `${directoryId}.json`));
		await expect(loadRecoveryRecord(directoryId)).rejects.toThrow('regular file');

		const oversizedId = 'c'.repeat(64);
		await writeFile(join(getRecoveryDir(), `${oversizedId}.json`), 'x'.repeat(256 * 1024 + 1), {
			mode: 0o600,
		});
		await expect(loadRecoveryRecord(oversizedId)).rejects.toThrow('too large');
	});

	it('removes only a validated regular recovery file', async () => {
		const { record } = await fixture();
		await saveRecoveryRecord(record);
		await removeRecoveryRecord(record.event.id);
		await expect(lstat(join(getRecoveryDir(), `${record.event.id}.json`))).rejects.toThrow();
		await removeRecoveryRecord(record.event.id);
	});

	it('refuses malformed JSON and insecure record modes while correcting directory permissions', async () => {
		const { record } = await fixture();
		await mkdir(getRecoveryDir(), { recursive: true, mode: 0o777 });
		await chmod(getRecoveryDir(), 0o777);
		const path = join(getRecoveryDir(), `${record.event.id}.json`);
		await writeFile(path, '{broken', { mode: 0o600 });
		await expect(loadRecoveryRecord(record.event.id)).rejects.toThrow('valid JSON');
		expect((await stat(getRecoveryDir())).mode & 0o777).toBe(0o700);
		await unlink(path);
		await saveRecoveryRecord(record);
		await chmod(path, 0o644);
		await expect(loadRecoveryRecord(record.event.id)).rejects.toThrow('owner-only permissions');
		await chmod(path, 0o600);
		expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(JSON.parse(JSON.stringify(record)));
	});
});

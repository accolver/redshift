import { afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { wrapSecrets } from '@redshift/crypto';
import { nip19 } from 'nostr-tools';
import { generateSecretKey } from 'nostr-tools/pure';
import { startNostrTestRelay, type NostrTestRelay } from '../../../tests/helpers/nostr-test-relay';

const binary = join(import.meta.dir, '../../../dist/redshift');
const roots: string[] = [];
const relays: NostrTestRelay[] = [];

beforeAll(() => {
	expect(existsSync(binary), `Compiled binary required at ${binary}`).toBe(true);
});

afterEach(async () => {
	while (relays.length > 0) await relays.pop()?.stop();
	while (roots.length > 0) {
		const root = roots.pop();
		if (root) await rm(root, { recursive: true, force: true });
	}
});

async function runCli(args: string[], cwd: string, configDir: string, nsec: string) {
	const child = Bun.spawn([binary, ...args], {
		cwd,
		env: { ...Bun.env, REDSHIFT_CONFIG_DIR: configDir, REDSHIFT_NSEC: nsec },
		stdin: 'ignore',
		stdout: 'pipe',
		stderr: 'pipe',
	});
	const stdoutPromise = new Response(child.stdout).text();
	const stderrPromise = new Response(child.stderr).text();
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		const exitCode = await Promise.race([
			child.exited,
			new Promise<never>((_, reject) => {
				timer = setTimeout(() => reject(new Error(`CLI timed out: ${args.join(' ')}`)), 45_000);
			}),
		]);
		const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);
		return { exitCode, stdout, stderr };
	} catch (error) {
		child.kill('SIGTERM');
		await Promise.race([child.exited, Bun.sleep(1_000)]);
		if (child.exitCode === null) {
			child.kill('SIGKILL');
			await child.exited;
		}
		throw error;
	} finally {
		if (timer) clearTimeout(timer);
	}
}

async function writeRelayConfig(configDir: string, relayUrls: string[]) {
	await mkdir(configDir, { recursive: true });
	await Bun.write(join(configDir, 'config.json'), JSON.stringify({ relays: relayUrls }));
}

describe('compiled authenticated secret history', () => {
	it('lists, paginates, compares, restores, detects concurrency, and preserves failed publications', async () => {
		const root = await mkdtemp(join(tmpdir(), 'redshift-history-'));
		roots.push(root);
		const relay = await startNostrTestRelay({ behavior: 'accept' });
		relays.push(relay);
		const configDir = join(root, 'config');
		await writeRelayConfig(configDir, [relay.url]);
		const privateKey = generateSecretKey();
		const nsec = nip19.nsecEncode(privateKey);
		const projectFlags = ['--project', 'project', '--config', 'dev'];
		const secretValues = [
			'history-old-value',
			'history-current-value',
			'history-extra-value',
		] as const;

		for (const [key, value] of [
			['API_KEY', secretValues[0]],
			['API_KEY', secretValues[1]],
			['EXTRA', secretValues[2]],
		] as const) {
			const result = await runCli(
				['secrets', 'set', key, value, ...projectFlags],
				root,
				configDir,
				nsec,
			);
			expect(result.exitCode, result.stderr).toBe(0);
		}
		const firstEventId = relay.publishedEvents[0]!.id;
		const thirdEventId = relay.publishedEvents[2]!.id;
		for (const key of ['API_KEY', 'EXTRA']) {
			const result = await runCli(
				['secrets', 'delete', key, ...projectFlags],
				root,
				configDir,
				nsec,
			);
			expect(result.exitCode, result.stderr).toBe(0);
		}
		const tombstoneEventId = relay.publishedEvents[4]!.id;

		const tieTimestamp = Math.floor(Date.now() / 1_000) + 10;
		const tiedOne = wrapSecrets({ TIE: 'one' }, privateKey, 'project|dev', {
			createdAt: tieTimestamp,
		});
		const tiedTwo = wrapSecrets({ TIE: 'two' }, privateKey, 'project|dev', {
			createdAt: tieTimestamp,
		});
		relay.seedEvent(tiedOne.event);
		relay.seedEvent(tiedTwo.event);

		const listed = await runCli(
			['history', 'list', ...projectFlags, '--limit', '2', '--json'],
			root,
			configDir,
			nsec,
		);
		expect(listed.exitCode, listed.stderr).toBe(0);
		for (const value of secretValues) expect(listed.stdout).not.toContain(value);
		const firstPage = JSON.parse(listed.stdout) as {
			versions: Array<{ eventId: string; current: boolean; tombstone: boolean; keyCount: number }>;
			nextCursor: string;
			truncated: boolean;
		};
		const tiedIds = [tiedOne.event.id, tiedTwo.event.id].sort();
		expect(firstPage.versions.map(({ eventId }) => eventId)).toEqual(tiedIds);
		expect(firstPage.versions[0]?.current).toBe(true);
		expect(firstPage.nextCursor).toBe(`v1.${tieTimestamp}.${tiedIds[1]}`);
		expect(firstPage.truncated).toBe(false);

		const secondPageResult = await runCli(
			[
				'history',
				'list',
				...projectFlags,
				'--limit',
				'2',
				'--cursor',
				firstPage.nextCursor,
				'--json',
			],
			root,
			configDir,
			nsec,
		);
		expect(secondPageResult.exitCode, secondPageResult.stderr).toBe(0);
		const secondPage = JSON.parse(secondPageResult.stdout) as {
			versions: Array<{ eventId: string }>;
		};
		expect(secondPage.versions.map(({ eventId }) => eventId)).not.toContain(tiedIds[0]);
		expect(secondPage.versions.map(({ eventId }) => eventId)).not.toContain(tiedIds[1]);

		const compared = await runCli(
			['history', 'compare', firstEventId, thirdEventId, ...projectFlags, '--json'],
			root,
			configDir,
			nsec,
		);
		expect(compared.exitCode, compared.stderr).toBe(0);
		expect(JSON.parse(compared.stdout)).toMatchObject({
			added: ['EXTRA'],
			removed: [],
			changed: ['API_KEY'],
		});
		for (const value of secretValues) expect(compared.stdout).not.toContain(value);

		const restored = await runCli(
			['history', 'restore', firstEventId, ...projectFlags, '--yes'],
			root,
			configDir,
			nsec,
		);
		expect(restored.exitCode, restored.stderr).toBe(0);
		expect(restored.stdout).toContain('Published historical bundle as new event');
		expect(restored.stdout).not.toContain(secretValues[0]!);
		const restoredGet = await runCli(
			['secrets', 'get', 'API_KEY', '--raw', ...projectFlags],
			root,
			configDir,
			nsec,
		);
		expect(restoredGet.stdout).toBe(secretValues[0]);

		const concurrent = wrapSecrets({ CONCURRENT: 'new-state' }, privateKey, 'project|dev', {
			createdAt: tieTimestamp + 20,
		});
		let concurrentObservationCount = 0;
		relay.setRequestHook((filters, _count, seedEvent) => {
			if (filters.some((filter) => filter.limit === 1_000)) {
				concurrentObservationCount += 1;
				if (concurrentObservationCount === 2) seedEvent(concurrent.event);
			}
		});
		const conflict = await runCli(
			['history', 'restore', tombstoneEventId, ...projectFlags, '--yes'],
			root,
			configDir,
			nsec,
		);
		expect(conflict.exitCode).toBe(1);
		expect(conflict.stderr).toContain('current changed');
		expect(relay.getEvent(concurrent.event.id)).toBeDefined();

		const concurrentTwo = wrapSecrets({ CONCURRENT: 'newer-state' }, privateKey, 'project|dev', {
			createdAt: tieTimestamp + 21,
		});
		let secondConcurrentObservationCount = 0;
		relay.setRequestHook((filters, _count, seedEvent) => {
			if (filters.some((filter) => filter.limit === 1_000)) {
				secondConcurrentObservationCount += 1;
				if (secondConcurrentObservationCount === 2) seedEvent(concurrentTwo.event);
			}
		});
		const overwritten = await runCli(
			['history', 'restore', firstEventId, ...projectFlags, '--yes', '--overwrite-current'],
			root,
			configDir,
			nsec,
		);
		expect(overwritten.exitCode, overwritten.stderr).toBe(0);
		relay.setRequestHook(null);

		const rejectOne = await startNostrTestRelay({ behavior: 'reject' });
		const rejectTwo = await startNostrTestRelay({ behavior: 'reject' });
		relays.push(rejectOne, rejectTwo);
		await writeRelayConfig(configDir, [relay.url, rejectOne.url, rejectTwo.url]);
		const belowQuorum = await runCli(
			['history', 'restore', tombstoneEventId, ...projectFlags, '--yes'],
			root,
			configDir,
			nsec,
		);
		expect(belowQuorum.exitCode).toBe(1);
		expect(belowQuorum.stderr).toContain('recovery show');
		const recoveryEventId = /recovery show ([0-9a-f]{64})/.exec(belowQuorum.stderr)?.[1];
		expect(recoveryEventId).toMatch(/^[0-9a-f]{64}$/);
		const recovery = await runCli(['recovery', 'show', recoveryEventId!], root, configDir, nsec);
		expect(recovery.exitCode, recovery.stderr).toBe(0);
		expect(recovery.stdout).toContain('accepted');
		expect(recovery.stdout).toContain('rejected');
		expect(recovery.stdout).not.toContain('new-state');
	}, 120_000);
});

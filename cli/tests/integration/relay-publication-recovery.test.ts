import { afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import { generateSecretKey } from 'nostr-tools/pure';
import { nip19 } from 'nostr-tools';
import {
	reserveTcpPort,
	startNostrTestRelay,
	type NostrTestRelay,
} from '../../../tests/helpers/nostr-test-relay';

const binary = join(import.meta.dir, '../../../dist/redshift');
const roots: string[] = [];
const relays: NostrTestRelay[] = [];

beforeAll(() => {
	expect(existsSync(binary)).toBe(true);
});

afterEach(async () => {
	while (relays.length > 0) await relays.pop()?.stop();
	while (roots.length > 0) await rm(roots.pop()!, { recursive: true, force: true });
});

async function runCli(args: string[], cwd: string, configDir: string, nsec: string) {
	const process = Bun.spawn([binary, ...args], {
		cwd,
		env: {
			...Bun.env,
			REDSHIFT_CONFIG_DIR: configDir,
			REDSHIFT_NSEC: nsec,
		},
		stdout: 'pipe',
		stderr: 'pipe',
	});
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		const boundedExit = Promise.race([
			process.exited,
			new Promise<never>((_, reject) => {
				timer = setTimeout(() => reject(new Error(`CLI timed out: ${args.join(' ')}`)), 15_000);
			}),
		]);
		const [exitCode, stdout, stderr] = await Promise.all([
			boundedExit,
			new Response(process.stdout).text(),
			new Response(process.stderr).text(),
		]);
		return { exitCode, stdout, stderr };
	} catch (error) {
		process.kill('SIGTERM');
		await Promise.race([process.exited, Bun.sleep(1000)]);
		if (process.exitCode === null) process.kill('SIGKILL');
		await Promise.race([process.exited, Bun.sleep(1000)]);
		throw error;
	} finally {
		if (timer) clearTimeout(timer);
	}
}

describe('compiled relay publication recovery', () => {
	it('persists below-quorum state and retries the byte-identical event only to the recovered relay', async () => {
		const root = await mkdtemp(join(tmpdir(), 'redshift-compiled-recovery-'));
		roots.push(root);
		const configDir = join(root, 'config');
		const accepted = await startNostrTestRelay({ behavior: 'accept' });
		const rejected = await startNostrTestRelay({ behavior: 'reject' });
		relays.push(accepted, rejected);
		const offlinePort = await reserveTcpPort();
		const offlineUrl = `ws://127.0.0.1:${offlinePort}/`;
		await writeFile(
			join(root, 'redshift.yaml'),
			[
				'project: recovery-project',
				'environment: dev',
				'relays:',
				`  - ${accepted.url}`,
				`  - ${rejected.url}`,
				`  - ${offlineUrl}`,
				'',
			].join('\n'),
		);
		const nsec = nip19.nsecEncode(generateSecretKey());

		const initial = await runCli(
			['secrets', 'set', 'API_KEY', 'recovery-value'],
			root,
			configDir,
			nsec,
		);
		expect(initial.exitCode).toBe(1);
		expect(initial.stderr).toContain('Publish quorum failed');
		expect(initial.stderr).not.toContain('recovery-value');
		expect(accepted.publishCount).toBe(1);
		expect(rejected.publishCount).toBe(1);

		const recoveryDir = join(configDir, 'recovery');
		const files = (await readdir(recoveryDir)).filter((name) => name.endsWith('.json'));
		expect(files).toHaveLength(1);
		const recoveryPath = join(recoveryDir, files[0]!);
		expect((await stat(recoveryPath)).mode & 0o777).toBe(0o600);
		const record = JSON.parse(await readFile(recoveryPath, 'utf8'));
		const eventId = record.event.id as string;
		expect(record.report.outcomes.map(({ state }: { state: string }) => state)).toEqual([
			'accepted',
			'rejected',
			'unavailable',
		]);
		const originalEvent = accepted.publishedEvents[0];
		expect(originalEvent?.id).toBe(eventId);

		const recovered = await startNostrTestRelay({ port: offlinePort, behavior: 'accept' });
		relays.push(recovered);
		const retry = await runCli(['recovery', 'retry', eventId], root, configDir, nsec);
		expect(retry.exitCode).toBe(0);
		expect(retry.stdout).toContain('2/3 accepted');
		expect(retry.stdout).toContain('rejected');
		expect(accepted.publishCount).toBe(1);
		expect(rejected.publishCount).toBe(1);
		expect(recovered.publishCount).toBe(1);
		expect(recovered.publishedEvents[0]).toEqual(originalEvent);
		expect(recovered.getEvent(eventId)).toEqual(originalEvent);

		const updated = JSON.parse(await readFile(recoveryPath, 'utf8'));
		expect(updated.event).toEqual(record.event);
		expect(updated.report.outcomes.map(({ state }: { state: string }) => state)).toEqual([
			'accepted',
			'rejected',
			'accepted',
		]);

		const remove = await runCli(['recovery', 'remove', eventId], root, configDir, nsec);
		expect(remove.exitCode).toBe(0);
		expect(remove.stdout).toContain('No relay data was deleted');
		expect((await readdir(recoveryDir)).filter((name) => name.endsWith('.json'))).toEqual([]);
	}, 30_000);
});

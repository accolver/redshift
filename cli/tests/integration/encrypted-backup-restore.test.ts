import { afterEach, beforeAll, describe, expect, it } from 'bun:test';
import {
	chmod,
	lstat,
	mkdir,
	mkdtemp,
	readFile,
	readdir,
	rm,
	stat,
	symlink,
	writeFile,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decryptBackup } from '@redshift/crypto';
import { nip19 } from 'nostr-tools';
import { generateSecretKey } from 'nostr-tools/pure';
import {
	startNostrTestRelay,
	startUnavailableTestEndpoint,
	type NostrTestRelay,
} from '../../../tests/helpers/nostr-test-relay';

const binary = join(import.meta.dir, '../../../dist/redshift');
const roots: string[] = [];
const relays: NostrTestRelay[] = [];
const unavailableEndpoints: Array<ReturnType<typeof startUnavailableTestEndpoint>> = [];

beforeAll(() => {
	expect(existsSync(binary), `Compiled binary required at ${binary}`).toBe(true);
});

afterEach(async () => {
	while (unavailableEndpoints.length > 0) await unavailableEndpoints.pop()?.stop();
	while (relays.length > 0) await relays.pop()?.stop();
	while (roots.length > 0) {
		const root = roots.pop();
		if (root) await rm(root, { recursive: true, force: true });
	}
});

async function runCli(
	args: string[],
	cwd: string,
	configDir: string,
	nsec: string,
	stdin?: string,
) {
	const child = Bun.spawn([binary, ...args], {
		cwd,
		env: { ...Bun.env, REDSHIFT_CONFIG_DIR: configDir, REDSHIFT_NSEC: nsec },
		stdin: stdin === undefined ? 'ignore' : 'pipe',
		stdout: 'pipe',
		stderr: 'pipe',
	});
	if (stdin !== undefined) {
		const writer = child.stdin;
		if (!writer) throw new Error('CLI stdin pipe was not created');
		writer.write(stdin);
		writer.end();
	}
	const stdoutPromise = new Response(child.stdout).text();
	const stderrPromise = new Response(child.stderr).text();
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		const exitCode = await Promise.race([
			child.exited,
			new Promise<never>((_, reject) => {
				timer = setTimeout(() => reject(new Error(`CLI timed out: ${args.join(' ')}`)), 30_000);
			}),
		]);
		const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);
		return { exitCode, stdout, stderr };
	} catch (error) {
		child.kill('SIGTERM');
		await Promise.race([child.exited, Bun.sleep(1000)]);
		if (child.exitCode === null) {
			child.kill('SIGKILL');
			await child.exited;
		}
		throw error;
	} finally {
		if (timer) clearTimeout(timer);
	}
}

async function writeRelayConfig(configDir: string, relayUrl: string) {
	await mkdir(configDir, { recursive: true });
	await Bun.write(join(configDir, 'config.json'), JSON.stringify({ relays: [relayUrl] }));
}

const passphrase = 'correct horse battery staple';

describe('compiled encrypted backup and restore', () => {
	it('restores multiple observed bundles into a fresh identity and fails closed on tamper/conflict', async () => {
		const root = await mkdtemp(join(tmpdir(), 'redshift-encrypted-backup-'));
		roots.push(root);
		const relay = await startNostrTestRelay({ behavior: 'accept' });
		relays.push(relay);
		const sourceConfig = join(root, 'source-config');
		const targetConfig = join(root, 'target-config');
		const thirdConfig = join(root, 'third-config');
		await Promise.all([
			writeRelayConfig(sourceConfig, relay.url),
			writeRelayConfig(targetConfig, relay.url),
			writeRelayConfig(thirdConfig, relay.url),
		]);
		const sourceNsec = nip19.nsecEncode(generateSecretKey());
		const targetNsec = nip19.nsecEncode(generateSecretKey());
		const thirdNsec = nip19.nsecEncode(generateSecretKey());
		const archivePath = join(root, 'snapshot.redshift');
		const secretCases: Array<[string, string, string, string]> = [
			['alpha', 'dev', 'API_KEY', 'alpha-secret-value'],
			['beta', 'prod', 'TOKEN', 'beta-secret-value'],
		];

		for (const [project, environment, key, value] of secretCases) {
			const set = await runCli(
				['secrets', 'set', key, value, '--project', project, '--config', environment],
				root,
				sourceConfig,
				sourceNsec,
			);
			expect(set.exitCode, set.stderr).toBe(0);
		}

		const created = await runCli(
			['backup', 'create', archivePath, '--passphrase-stdin'],
			root,
			sourceConfig,
			sourceNsec,
			`${passphrase}\n${passphrase}\n`,
		);
		expect(created.exitCode, created.stderr).toBe(0);
		expect(created.stdout).toContain('2 bundle(s), 2 secret(s)');
		const archiveBytes = new Uint8Array(await readFile(archivePath));
		expect((await stat(archivePath)).mode & 0o777).toBe(0o600);
		const archiveText = new TextDecoder().decode(archiveBytes);
		for (const forbidden of ['alpha-secret-value', 'beta-secret-value', passphrase, sourceNsec]) {
			expect(archiveText).not.toContain(forbidden);
		}
		const decoded = await decryptBackup(archiveBytes, passphrase);
		expect(decoded.contents).toEqual({
			secretState: 'current-observed',
			projectMetadata: 'identifiers-only',
			relayConfiguration: 'excluded',
			signerCredentials: 'excluded',
			historyAndTombstones: 'excluded',
		});
		const decodedText = JSON.stringify(decoded);
		for (const excluded of [sourceNsec, targetNsec, relay.url, sourceConfig, targetConfig]) {
			expect(decodedText).not.toContain(excluded);
		}

		const migrated = await runCli(
			['backup', 'restore', archivePath, '--allow-identity-change', '--passphrase-stdin'],
			root,
			targetConfig,
			targetNsec,
			`${passphrase}\n`,
		);
		expect(migrated.exitCode, migrated.stderr).toBe(0);
		expect(migrated.stdout).toContain('2 restored');
		expect(migrated.stdout).not.toContain('alpha-secret-value');
		for (const [project, environment, key, value] of secretCases) {
			const get = await runCli(
				['secrets', 'get', key, '--raw', '--project', project, '--config', environment],
				root,
				targetConfig,
				targetNsec,
			);
			expect(get.exitCode, get.stderr).toBe(0);
			expect(get.stdout).toBe(value);
		}

		const changed = await runCli(
			['secrets', 'set', 'TOKEN', 'destination-change', '--project', 'beta', '--config', 'prod'],
			root,
			targetConfig,
			targetNsec,
		);
		expect(changed.exitCode, changed.stderr).toBe(0);
		const beforeConflict = relay.publishCount;
		const conflict = await runCli(
			['backup', 'restore', archivePath, '--allow-identity-change', '--passphrase-stdin'],
			root,
			targetConfig,
			targetNsec,
			`${passphrase}\n`,
		);
		expect(conflict.exitCode).toBe(1);
		expect(conflict.stderr).toContain('beta/prod');
		expect(relay.publishCount).toBe(beforeConflict);

		const overwritten = await runCli(
			[
				'backup',
				'restore',
				archivePath,
				'--allow-identity-change',
				'--overwrite',
				'--passphrase-stdin',
			],
			root,
			targetConfig,
			targetNsec,
			`${passphrase}\n`,
		);
		expect(overwritten.exitCode, overwritten.stderr).toBe(0);
		expect(overwritten.stdout).toContain('1 restored, 1 unchanged');

		const tamperedPath = join(root, 'tampered.redshift');
		const tampered = archiveBytes.slice();
		tampered[tampered.length - 1] = (tampered.at(-1) ?? 0) ^ 1;
		await writeFile(tamperedPath, tampered, { mode: 0o600 });
		const beforeTamper = relay.publishCount;
		const tamperResult = await runCli(
			['backup', 'restore', tamperedPath, '--allow-identity-change', '--passphrase-stdin'],
			root,
			thirdConfig,
			thirdNsec,
			`${passphrase}\n`,
		);
		expect(tamperResult.exitCode).toBe(1);
		expect(tamperResult.stderr).toContain('authentication or validation failed');
		expect(relay.publishCount).toBe(beforeTamper);

		const wrongPassphrase = await runCli(
			['backup', 'restore', archivePath, '--allow-identity-change', '--passphrase-stdin'],
			root,
			thirdConfig,
			thirdNsec,
			'wrong passphrase value\n',
		);
		expect(wrongPassphrase.exitCode).toBe(1);
		expect(wrongPassphrase.stderr).not.toContain(passphrase);
		expect(relay.publishCount).toBe(beforeTamper);

		const linkPath = join(root, 'linked.redshift');
		await symlink(archivePath, linkPath);
		const linked = await runCli(
			['backup', 'restore', linkPath, '--allow-identity-change', '--passphrase-stdin'],
			root,
			thirdConfig,
			thirdNsec,
			`${passphrase}\n`,
		);
		expect(linked.exitCode).toBe(1);
		expect(linked.stderr).toContain('regular file');
		await chmod(archivePath, 0o600);
		expect((await readdir(root)).filter((name) => name.includes('.tmp'))).toEqual([]);
		expect(await lstat(archivePath)).toBeDefined();
	}, 120_000);

	it('preserves below-quorum restore state and retries the exact event only to a recovered relay', async () => {
		const root = await mkdtemp(join(tmpdir(), 'redshift-backup-recovery-'));
		roots.push(root);
		const sourceRelay = await startNostrTestRelay({ behavior: 'accept' });
		const accepted = await startNostrTestRelay({ behavior: 'accept' });
		const rejected = await startNostrTestRelay({ behavior: 'reject' });
		relays.push(sourceRelay, accepted, rejected);
		const unavailable = startUnavailableTestEndpoint();
		unavailableEndpoints.push(unavailable);
		const sourceConfig = join(root, 'source-config');
		const targetConfig = join(root, 'target-config');
		await writeRelayConfig(sourceConfig, sourceRelay.url);
		await mkdir(targetConfig, { recursive: true });
		await Bun.write(
			join(targetConfig, 'config.json'),
			JSON.stringify({ relays: [accepted.url, rejected.url, unavailable.url] }),
		);
		const sourceNsec = nip19.nsecEncode(generateSecretKey());
		const targetNsec = nip19.nsecEncode(generateSecretKey());
		const archivePath = join(root, 'snapshot.redshift');
		const set = await runCli(
			['secrets', 'set', 'API_KEY', 'recovery-secret', '--project', 'alpha', '--config', 'dev'],
			root,
			sourceConfig,
			sourceNsec,
		);
		expect(set.exitCode, set.stderr).toBe(0);
		const created = await runCli(
			['backup', 'create', archivePath, '--passphrase-stdin'],
			root,
			sourceConfig,
			sourceNsec,
			`${passphrase}\n${passphrase}\n`,
		);
		expect(created.exitCode, created.stderr).toBe(0);

		const restored = await runCli(
			['backup', 'restore', archivePath, '--allow-identity-change', '--passphrase-stdin'],
			root,
			targetConfig,
			targetNsec,
			`${passphrase}\n`,
		);
		expect(restored.exitCode).toBe(1);
		expect(restored.stderr).not.toContain('recovery-secret');
		expect(accepted.publishCount).toBe(1);
		expect(rejected.publishCount).toBe(1);
		const recoveryDir = join(targetConfig, 'recovery');
		const records = (await readdir(recoveryDir)).filter((name) => name.endsWith('.json'));
		expect(records).toHaveLength(1);
		const recordName = records[0];
		if (!recordName) throw new Error('Missing restore recovery record');
		const record = JSON.parse(await readFile(join(recoveryDir, recordName), 'utf8'));
		expect(record.report.outcomes.map(({ state }: { state: string }) => state)).toEqual([
			'accepted',
			'rejected',
			'unavailable',
		]);
		const exactEvent = accepted.publishedEvents[0];
		expect(exactEvent?.id).toBe(record.event.id);

		await unavailable.stop();
		unavailableEndpoints.splice(unavailableEndpoints.indexOf(unavailable), 1);
		const recovered = await startNostrTestRelay({ port: unavailable.port, behavior: 'accept' });
		relays.push(recovered);
		const retry = await runCli(
			['recovery', 'retry', record.event.id],
			root,
			targetConfig,
			targetNsec,
		);
		expect(retry.exitCode, retry.stderr).toBe(0);
		expect(accepted.publishCount).toBe(1);
		expect(rejected.publishCount).toBe(1);
		expect(recovered.publishCount).toBe(1);
		expect(recovered.publishedEvents[0]).toEqual(exactEvent);
	}, 120_000);
});

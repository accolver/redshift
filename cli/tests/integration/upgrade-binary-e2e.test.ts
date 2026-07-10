import { afterEach, beforeAll, describe, expect, it } from 'bun:test';
import {
	chmodSync,
	copyFileSync,
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const compiledBinary = join(import.meta.dir, '../../../dist/redshift');
const roots: string[] = [];
const servers: Array<ReturnType<typeof Bun.serve>> = [];

interface FixtureOptions {
	attestationSucceeds?: boolean;
}

async function createFixture(options: FixtureOptions = {}) {
	const root = mkdtempSync(join(tmpdir(), 'redshift-upgrade-e2e-'));
	roots.push(root);
	const installDir = join(root, 'bin');
	const toolsDir = join(root, 'tools');
	const installedBinary = join(installDir, 'redshift');
	await Bun.$`mkdir -p ${installDir} ${toolsDir}`;
	copyFileSync(compiledBinary, installedBinary);
	chmodSync(installedBinary, 0o755);
	const originalHash = new Bun.CryptoHasher('sha256')
		.update(readFileSync(installedBinary))
		.digest('hex');

	const candidate = '#!/bin/sh\nprintf "redshift v9.9.9\\n"\n';
	const candidateHash = new Bun.CryptoHasher('sha256').update(candidate).digest('hex');
	const assetName = `redshift-${process.platform === 'darwin' ? 'darwin' : 'linux'}-${process.arch}`;
	const sourceDigest = 'a'.repeat(40);
	let origin = '';
	const server = Bun.serve({
		port: 0,
		fetch(request) {
			const pathname = new URL(request.url).pathname;
			if (pathname.includes('/releases/tags/')) {
				return Response.json({
					tag_name: 'v9.9.9',
					assets: [
						{ name: assetName, browser_download_url: `${origin}/asset` },
						{ name: 'checksums.txt', browser_download_url: `${origin}/checksums.txt` },
					],
				});
			}
			if (pathname.includes('/commits/')) return Response.json({ sha: sourceDigest });
			if (pathname === '/asset') return new Response(candidate);
			if (pathname === '/checksums.txt') {
				return new Response(`${candidateHash}  ${assetName}\n`);
			}
			return new Response('not found', { status: 404 });
		},
	});
	servers.push(server);
	origin = `http://127.0.0.1:${server.port}`;

	const gh = join(toolsDir, 'gh');
	writeFileSync(gh, `#!/bin/sh\n${options.attestationSucceeds === false ? 'exit 1' : 'exit 0'}\n`);
	chmodSync(gh, 0o755);

	const run = async () => {
		const child = Bun.spawn([installedBinary, 'upgrade', '--tag', 'v9.9.9', '--force'], {
			env: {
				...process.env,
				HOME: root,
				NODE_ENV: 'test',
				REDSHIFT_ENABLE_TEST_OVERRIDES: '1',
				PATH: `${toolsDir}:${installDir}:${process.env.PATH ?? ''}`,
				REDSHIFT_TEST_GITHUB_API_BASE: origin,
			},
			stdout: 'pipe',
			stderr: 'pipe',
		});
		const [exitCode, stdout, stderr] = await Promise.all([
			child.exited,
			new Response(child.stdout).text(),
			new Response(child.stderr).text(),
		]);
		return { exitCode, stdout, stderr };
	};

	return { installedBinary, originalHash, run };
}

beforeAll(() => {
	expect(existsSync(compiledBinary), `Compiled binary required at ${compiledBinary}`).toBe(true);
});

afterEach(() => {
	for (const server of servers.splice(0)) server.stop(true);
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('compiled upgrade lifecycle', () => {
	it('verifies provenance and checksum before atomically replacing the installed binary', async () => {
		const fixture = await createFixture();
		const result = await fixture.run();

		expect(result.exitCode, result.stderr).toBe(0);
		expect(result.stdout).toContain('GitHub artifact attestation verified');
		expect(result.stdout).toContain('Checksum verified');
		expect(readFileSync(fixture.installedBinary, 'utf8')).toContain('redshift v9.9.9');
		expect(existsSync(`${fixture.installedBinary}.backup`)).toBe(false);
	});

	it('preserves the installed binary when provenance verification fails', async () => {
		const fixture = await createFixture({ attestationSucceeds: false });
		const result = await fixture.run();

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('Artifact attestation verification failed');
		const currentHash = new Bun.CryptoHasher('sha256')
			.update(readFileSync(fixture.installedBinary))
			.digest('hex');
		expect(currentHash).toBe(fixture.originalHash);
		expect(existsSync(`${fixture.installedBinary}.backup`)).toBe(false);
	});
});

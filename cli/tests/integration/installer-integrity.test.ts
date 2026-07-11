import { afterEach, describe, expect, it } from 'bun:test';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const installerPath = resolve(import.meta.dir, '../../../web/static/install');
const tempDirectories: string[] = [];

function executable(path: string, content: string) {
	writeFileSync(path, content);
	chmodSync(path, 0o755);
}

function createHarness(ghExitCode: number, executablePayload = true, checksumManifest?: string) {
	const root = mkdtempSync(join(tmpdir(), 'redshift-installer-'));
	tempDirectories.push(root);
	const bin = join(root, 'bin');
	const installDir = join(root, 'install');
	const ghLog = join(root, 'gh.log');
	const curlLog = join(root, 'curl.log');
	Bun.spawnSync(['mkdir', '-p', bin]);
	executable(
		join(bin, 'uname'),
		`#!/bin/sh\nif [ "$1" = "-s" ]; then echo Linux; else echo x86_64; fi\n`,
	);
	const artifactHash = executablePayload
		? '84a2c5cc5e7bf9dc71412f782d2a4bdb86ea5048ea8e22c0b980126f3d668da6'
		: '110a2dfc6452c9ca98122f9eb2ff9db94b51b127f537432baf82f2744fbb90d6';
	const manifest = checksumManifest ?? `${artifactHash}  redshift-linux-x64\n`;
	executable(
		join(bin, 'curl'),
		`#!/bin/sh
printf '%s\n' "$*" >> "$CURL_LOG"
case "$*" in
  *releases/latest*) printf '%s\\n' '{"tag_name":"v1.2.3"}'; exit 0 ;;
esac
dest=""
previous=""
for argument in "$@"; do
  if [ "$previous" = "-o" ]; then dest="$argument"; fi
  previous="$argument"
done
[ -n "$dest" ] || exit 2
case "$*" in
  *checksums.txt*) printf '%b' ${JSON.stringify(manifest)} > "$dest"; exit 0 ;;
esac
${
	executablePayload
		? `printf '%s\\n' '#!/bin/sh' '[ "$1" = "--version" ] || exit 2' 'echo "redshift v1.2.3"' > "$dest"`
		: `printf '%s' 'not an executable' > "$dest"`
}
`,
	);
	executable(
		join(bin, 'gh'),
		`#!/bin/sh
printf '%s\\n' "$*" >> "$GH_LOG"
if [ "$1" = "api" ]; then
  printf '%s\\n' 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  exit 0
fi
exit "$GH_EXIT"
`,
	);
	return { root, bin, installDir, ghLog, curlLog, ghExitCode };
}

async function runInstaller(
	harness: ReturnType<typeof createHarness>,
	extraEnvironment: Record<string, string> = {},
) {
	const process = Bun.spawn(['sh', installerPath], {
		env: {
			...globalThis.process.env,
			PATH: `${harness.bin}:/usr/bin:/bin`,
			HOME: harness.root,
			REDSHIFT_INSTALL_DIR: harness.installDir,
			GH_LOG: harness.ghLog,
			CURL_LOG: harness.curlLog,
			GH_EXIT: String(harness.ghExitCode),
			...extraEnvironment,
		},
		stdout: 'pipe',
		stderr: 'pipe',
	});
	const [exitCode, stdout, stderr] = await Promise.all([
		process.exited,
		new Response(process.stdout).text(),
		new Response(process.stderr).text(),
	]);
	return { exitCode, output: `${stdout}\n${stderr}` };
}

afterEach(() => {
	for (const directory of tempDirectories.splice(0)) rmSync(directory, { recursive: true });
});

describe('release installer integrity', () => {
	it('installs only after GitHub attestation verification succeeds', async () => {
		const harness = createHarness(0);
		const result = await runInstaller(harness);
		expect(result.exitCode).toBe(0);
		expect(readFileSync(join(harness.installDir, 'redshift'), 'utf8')).toContain('redshift v1.2.3');
		expect(readFileSync(harness.ghLog, 'utf8')).toContain('attestation verify');
		const verificationLog = readFileSync(harness.ghLog, 'utf8');
		expect(verificationLog).toContain('--repo accolver/redshift');
		expect(verificationLog).toContain(
			'--signer-workflow accolver/redshift/.github/workflows/release.yml',
		);
		expect(verificationLog).toContain('--source-digest aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
		expect(verificationLog).toContain('--deny-self-hosted-runners');
	});

	it('installs an explicitly pinned release without resolving latest', async () => {
		const harness = createHarness(0);
		const result = await runInstaller(harness, { REDSHIFT_VERSION: 'v1.2.3' });
		expect(result.exitCode).toBe(0);
		const curlLog = readFileSync(harness.curlLog, 'utf8');
		expect(curlLog).not.toContain('releases/latest');
		expect(curlLog).toContain('/releases/download/v1.2.3/redshift-linux-x64');
	});

	it('fails closed and preserves an existing binary when attestation verification fails', async () => {
		const harness = createHarness(1);
		Bun.spawnSync(['mkdir', '-p', harness.installDir]);
		writeFileSync(join(harness.installDir, 'redshift'), 'existing-binary');
		const result = await runInstaller(harness);
		expect(result.exitCode).not.toBe(0);
		expect(result.output).toContain('Release attestation verification failed');
		expect(readFileSync(join(harness.installDir, 'redshift'), 'utf8')).toBe('existing-binary');
		expect(
			Bun.spawnSync(['find', harness.installDir, '-name', '.redshift.*']).stdout.toString().trim(),
		).toBe('');
	});

	it('rejects a missing or duplicate exact checksum without replacing an existing binary', async () => {
		const hash = '84a2c5cc5e7bf9dc71412f782d2a4bdb86ea5048ea8e22c0b980126f3d668da6';
		for (const manifest of ['', `${hash}  redshift-linux-x64\n${hash}  redshift-linux-x64\n`]) {
			const harness = createHarness(0, true, manifest);
			Bun.spawnSync(['mkdir', '-p', harness.installDir]);
			writeFileSync(join(harness.installDir, 'redshift'), 'existing-binary');
			const result = await runInstaller(harness);
			expect(result.exitCode).not.toBe(0);
			expect(result.output).toContain('exactly one canonical checksum');
			expect(readFileSync(join(harness.installDir, 'redshift'), 'utf8')).toBe('existing-binary');
		}
	});

	it('refuses a bad smoke test without replacing an existing binary', async () => {
		const harness = createHarness(0, false);
		Bun.spawnSync(['mkdir', '-p', harness.installDir]);
		writeFileSync(join(harness.installDir, 'redshift'), 'existing-binary');
		const result = await runInstaller(harness);
		expect(result.exitCode).not.toBe(0);
		expect(result.output).toContain('Downloaded binary failed its smoke test');
		expect(readFileSync(join(harness.installDir, 'redshift'), 'utf8')).toBe('existing-binary');
	});
});

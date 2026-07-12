/**
 * Upgrade Command - Self-update the CLI binary
 *
 * Downloads the latest version from GitHub releases and replaces the current binary.
 *
 * L5: Journey-Validator - Seamless upgrade experience
 */

import { chmodSync, copyFileSync, mkdirSync, renameSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { VERSION } from '../version';

const REPO = 'accolver/redshift';
const BINARY_NAME = 'redshift';
const RELEASE_WORKFLOW = `${REPO}/.github/workflows/release.yml`;

function githubApiBase() {
	if (
		process.env.REDSHIFT_ENABLE_TEST_OVERRIDES === '1' &&
		process.env.REDSHIFT_TEST_GITHUB_API_BASE
	) {
		return process.env.REDSHIFT_TEST_GITHUB_API_BASE.replace(/\/$/, '');
	}
	return 'https://api.github.com';
}

export interface UpgradeOptions {
	force?: boolean;
	version?: string;
}

interface GitHubRelease {
	tag_name: string;
	assets: Array<{
		name: string;
		browser_download_url: string;
	}>;
}

/**
 * Get the current binary path.
 */
function getCurrentBinaryPath(): string {
	// process.execPath gives us the path to the bun/node executable when running via bun
	// For compiled binaries, we need to find where 'redshift' is installed
	const binaryPath = process.argv[1];

	// If running as compiled binary, argv[1] is the binary itself
	if (binaryPath && !binaryPath.includes('node_modules') && !binaryPath.endsWith('.ts')) {
		// Try to resolve the actual binary location
		try {
			const result = Bun.spawnSync(['which', BINARY_NAME]);
			const which = result.stdout.toString().trim();
			if (which) return which;
		} catch {
			// Fall through
		}
	}

	// Default locations
	const homeDir = process.env.HOME || process.env.USERPROFILE || '';
	return join(homeDir, '.local', 'bin', BINARY_NAME);
}

/**
 * Detect the current OS.
 */
export function detectOS(platform: NodeJS.Platform = process.platform): string {
	switch (platform) {
		case 'darwin':
			return 'darwin';
		case 'linux':
			return 'linux';
		case 'win32':
			throw new Error('Windows binaries are not currently published');
		default:
			throw new Error(`Unsupported operating system: ${platform}`);
	}
}

/**
 * Detect the current architecture.
 */
export function detectArch(): string {
	switch (process.arch) {
		case 'x64':
			return 'x64';
		case 'arm64':
			return 'arm64';
		default:
			throw new Error(`Unsupported architecture: ${process.arch}`);
	}
}

/**
 * Fetch the latest release info from GitHub.
 */
async function fetchLatestRelease(): Promise<GitHubRelease> {
	const response = await fetch(`${githubApiBase()}/repos/${REPO}/releases/latest`);

	if (!response.ok) {
		throw new Error(`Failed to fetch latest release: ${response.statusText}`);
	}

	return response.json() as Promise<GitHubRelease>;
}

/**
 * Fetch a specific release by tag.
 */
async function fetchReleaseByTag(tag: string): Promise<GitHubRelease> {
	const response = await fetch(`${githubApiBase()}/repos/${REPO}/releases/tags/${tag}`);

	if (!response.ok) {
		throw new Error(`Failed to fetch release ${tag}: ${response.statusText}`);
	}

	return response.json() as Promise<GitHubRelease>;
}

async function fetchReleaseSourceDigest(tag: string) {
	const response = await fetch(
		`${githubApiBase()}/repos/${REPO}/commits/${encodeURIComponent(tag)}`,
	);
	if (!response.ok) {
		throw new Error(`Failed to resolve source digest for release ${tag}: ${response.statusText}`);
	}
	const commit = (await response.json()) as { sha?: unknown };
	if (typeof commit.sha !== 'string' || !/^[0-9a-f]{40}([0-9a-f]{24})?$/.test(commit.sha)) {
		throw new Error(`Invalid source digest for release ${tag}`);
	}
	return commit.sha;
}

/**
 * Download a file from URL to a local path.
 */
async function downloadFile(url: string, destPath: string): Promise<void> {
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`Failed to download: ${response.statusText}`);
	}

	const buffer = await response.arrayBuffer();
	await Bun.write(destPath, buffer);
}

interface AttestationCommandResult {
	exitCode: number;
	stderr: { toString(): string };
}

type AttestationCommandRunner = (command: string[]) => AttestationCommandResult;

export function verifyArtifactAttestation(
	artifactPath: string,
	sourceDigest: string,
	run: AttestationCommandRunner = (command) => Bun.spawnSync(command),
): void {
	if (!/^[0-9a-f]{40}([0-9a-f]{24})?$/.test(sourceDigest)) {
		throw new Error('Invalid release source digest');
	}
	const result = run([
		'gh',
		'attestation',
		'verify',
		artifactPath,
		'--repo',
		REPO,
		'--signer-workflow',
		RELEASE_WORKFLOW,
		'--source-digest',
		sourceDigest,
		'--deny-self-hosted-runners',
	]);
	if (result.exitCode !== 0) {
		const detail = result.stderr.toString().trim();
		throw new Error(
			`Artifact attestation verification failed${detail ? `: ${detail}` : ''}. Install a current GitHub CLI and retry.`,
		);
	}
}

export function smokeTestDownloadedBinary(
	artifactPath: string,
	run: AttestationCommandRunner = (command) => Bun.spawnSync(command),
): void {
	const result = run([artifactPath, '--version']);
	if (result.exitCode !== 0) {
		const detail = result.stderr.toString().trim();
		throw new Error(`Downloaded binary smoke test failed${detail ? `: ${detail}` : ''}`);
	}
}

export interface AtomicReplacementOperations {
	copyFile(source: string, destination: string): void;
	rename(source: string, destination: string): void;
	unlink(path: string): void;
}

const atomicReplacementOperations: AtomicReplacementOperations = {
	copyFile: copyFileSync,
	rename: renameSync,
	unlink: unlinkSync,
};

function isMissingFileError(error: unknown) {
	return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

export function replaceBinaryAtomically(
	candidatePath: string,
	binaryPath: string,
	operations: AtomicReplacementOperations = atomicReplacementOperations,
) {
	const backupPath = `${binaryPath}.backup`;
	let hasBackup = false;
	try {
		operations.copyFile(binaryPath, backupPath);
		hasBackup = true;
	} catch (error) {
		if (!isMissingFileError(error)) throw error;
	}

	try {
		operations.rename(candidatePath, binaryPath);
	} catch (error) {
		if (hasBackup) {
			operations.rename(backupPath, binaryPath);
		}
		try {
			operations.unlink(candidatePath);
		} catch {
			// Candidate may already be absent after a failed filesystem operation.
		}
		throw error;
	}

	if (hasBackup) {
		try {
			operations.unlink(backupPath);
		} catch {
			// The installed binary is valid; a stale backup can be removed manually.
		}
	}
}

/**
 * Get current installed version from package.json.
 */
function getCurrentVersion(): string {
	return VERSION;
}

/**
 * Extract version number from a tag name.
 * Handles formats like: "v0.3.0", "redshift-v0.3.0", "vredshift-v0.3.0"
 */
export function extractVersion(tagName: string): string {
	// Match version pattern: digits.digits.digits (with optional v prefix anywhere)
	const match = tagName.match(/v?(\d+\.\d+\.\d+)/);
	if (match?.[1]) {
		return match[1];
	}
	return tagName.replace(/^v/, '');
}

export function parseTrustedChecksum(manifest: string, assetName: string) {
	const matchingHashes: string[] = [];
	for (const line of manifest.split('\n')) {
		if (!line.trim()) continue;
		const match = line.match(/^(\S+)\s+\*?(\S+)$/);
		if (match?.[2] === assetName && match[1]) matchingHashes.push(match[1]);
	}
	if (matchingHashes.length !== 1) {
		throw new Error(`Trusted manifest must contain exactly one checksum for ${assetName}`);
	}
	const hash = matchingHashes[0];
	if (!hash || !/^[0-9a-f]{64}$/.test(hash)) {
		throw new Error(`Trusted manifest checksum for ${assetName} is not canonical SHA-256`);
	}
	return hash;
}

/**
 * Execute the upgrade command.
 */
export async function upgradeCommand(options: UpgradeOptions): Promise<void> {
	const currentVersion = getCurrentVersion();
	const temporaryPaths = new Set<string>();

	console.log('Redshift CLI Upgrade');
	console.log('====================\n');
	console.log(`Current version: v${currentVersion}`);

	try {
		// Fetch release info
		console.log('Checking for updates...');
		const release = options.version
			? await fetchReleaseByTag(options.version)
			: await fetchLatestRelease();

		const latestVersion = extractVersion(release.tag_name);

		if (latestVersion === currentVersion && !options.force) {
			console.log(`\n✓ Already on the latest version (v${currentVersion})`);
			return;
		}

		if (!options.force && compareVersions(currentVersion, latestVersion) > 0) {
			console.log(
				`\n⚠️  Installed version (v${currentVersion}) is newer than latest release (v${latestVersion})`,
			);
			console.log('Use --force to downgrade.');
			return;
		}

		console.log(`Latest version: v${latestVersion}`);

		// Find the right asset for this platform
		const os = detectOS();
		const arch = detectArch();
		const assetName = `${BINARY_NAME}-${os}-${arch}`;

		const matchingAssets = release.assets.filter((asset) => asset.name === assetName);
		if (matchingAssets.length !== 1) {
			throw new Error(
				matchingAssets.length === 0
					? `No binary available for ${os}/${arch}`
					: `Release contains duplicate ${assetName} assets`,
			);
		}
		const asset = matchingAssets[0];
		if (!asset) throw new Error(`No binary available for ${os}/${arch}`);

		const sourceDigest = await fetchReleaseSourceDigest(release.tag_name);
		const binaryPath = getCurrentBinaryPath();
		const installDirectory = dirname(binaryPath);
		mkdirSync(installDirectory, { recursive: true, mode: 0o700 });
		// Keep the candidate on the destination filesystem so rename remains atomic.
		const tempPath = join(
			installDirectory,
			`.${BINARY_NAME}-${latestVersion}-${crypto.randomUUID()}`,
		);
		temporaryPaths.add(tempPath);
		console.log(`\nDownloading v${latestVersion}...`);
		await downloadFile(asset.browser_download_url, tempPath);

		try {
			verifyArtifactAttestation(tempPath, sourceDigest);
			console.log('GitHub artifact attestation verified.');
		} catch (error) {
			unlinkSync(tempPath);
			throw error;
		}

		const checksumAssets = release.assets.filter((asset) => asset.name === 'checksums.txt');
		if (checksumAssets.length !== 1 || !checksumAssets[0]) {
			throw new Error('Release must contain exactly one checksums.txt asset');
		}
		const manifestPath = `${tempPath}.checksums.txt`;
		temporaryPaths.add(manifestPath);
		await downloadFile(checksumAssets[0].browser_download_url, manifestPath);
		verifyArtifactAttestation(manifestPath, sourceDigest);
		const expectedHash = parseTrustedChecksum(await Bun.file(manifestPath).text(), assetName);
		const fileBuffer = await Bun.file(tempPath).arrayBuffer();
		const actualHash = new Bun.CryptoHasher('sha256').update(fileBuffer).digest('hex');
		if (actualHash !== expectedHash) {
			throw new Error(
				`Checksum verification failed. Expected: ${expectedHash}, Got: ${actualHash}`,
			);
		}
		unlinkSync(manifestPath);
		temporaryPaths.delete(manifestPath);
		console.log('Checksum verified.');

		// Make executable
		chmodSync(tempPath, 0o755);
		try {
			smokeTestDownloadedBinary(tempPath);
			console.log('Downloaded binary smoke test passed.');
		} catch (error) {
			unlinkSync(tempPath);
			throw error;
		}

		// Replace the current binary only after every verification succeeds.
		console.log(`Installing to ${binaryPath}...`);
		replaceBinaryAtomically(tempPath, binaryPath);
		temporaryPaths.delete(tempPath);
		console.log(`\n✓ Successfully upgraded to v${latestVersion}`);
	} catch (error) {
		for (const temporaryPath of temporaryPaths) {
			try {
				unlinkSync(temporaryPath);
			} catch {
				// Candidate was already moved or removed.
			}
		}
		console.error('\nUpgrade failed:', error instanceof Error ? error.message : error);
		console.error('\nYou can manually upgrade by running:');
		console.error('  curl -fsSL https://redshiftapp.com/install | sh');
		process.exit(1);
	}
}

/**
 * Compare two semver version strings.
 * Returns: -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareVersions(a: string, b: string): number {
	const partsA = a.split('.').map(Number);
	const partsB = b.split('.').map(Number);

	for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
		const numA = partsA[i] || 0;
		const numB = partsB[i] || 0;

		if (numA < numB) return -1;
		if (numA > numB) return 1;
	}

	return 0;
}

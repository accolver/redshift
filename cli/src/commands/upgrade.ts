/**
 * Upgrade Command - Self-update the CLI binary
 *
 * Downloads the latest version from GitHub releases and replaces the current binary.
 *
 * L5: Journey-Validator - Seamless upgrade experience
 */

import { execSync } from 'node:child_process';
import { chmodSync, copyFileSync, renameSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { VERSION } from '../version';

const REPO = 'accolver/redshift';
const BINARY_NAME = 'redshift';

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
			const which = execSync(`which ${BINARY_NAME}`, { encoding: 'utf-8' }).trim();
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
function detectOS(): string {
	switch (process.platform) {
		case 'darwin':
			return 'darwin';
		case 'linux':
			return 'linux';
		case 'win32':
			return 'windows';
		default:
			throw new Error(`Unsupported operating system: ${process.platform}`);
	}
}

/**
 * Detect the current architecture.
 */
function detectArch(): string {
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
	const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);

	if (!response.ok) {
		throw new Error(`Failed to fetch latest release: ${response.statusText}`);
	}

	return response.json() as Promise<GitHubRelease>;
}

/**
 * Fetch a specific release by tag.
 */
async function fetchReleaseByTag(tag: string): Promise<GitHubRelease> {
	const response = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/${tag}`);

	if (!response.ok) {
		throw new Error(`Failed to fetch release ${tag}: ${response.statusText}`);
	}

	return response.json() as Promise<GitHubRelease>;
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

/**
 * Get current installed version from package.json.
 */
function getCurrentVersion(): string {
	return VERSION;
}

/**
 * Execute the upgrade command.
 */
export async function upgradeCommand(options: UpgradeOptions): Promise<void> {
	const currentVersion = getCurrentVersion();

	console.log('Redshift CLI Upgrade');
	console.log('====================\n');
	console.log(`Current version: v${currentVersion}`);

	try {
		// Fetch release info
		console.log('Checking for updates...');
		const release = options.version
			? await fetchReleaseByTag(options.version)
			: await fetchLatestRelease();

		const latestVersion = release.tag_name.replace(/^v/, '');

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
		const assetName =
			os === 'windows' ? `${BINARY_NAME}-${os}-${arch}.exe` : `${BINARY_NAME}-${os}-${arch}`;

		const asset = release.assets.find((a) => a.name === assetName);
		if (!asset) {
			console.error(`\nNo binary available for ${os}/${arch}`);
			console.error('Available assets:', release.assets.map((a) => a.name).join(', '));
			process.exit(1);
		}

		// Download to temp location
		const tempPath = join(tmpdir(), `${BINARY_NAME}-${latestVersion}-${Date.now()}`);
		console.log(`\nDownloading v${latestVersion}...`);
		await downloadFile(asset.browser_download_url, tempPath);

		// Make executable
		if (os !== 'windows') {
			chmodSync(tempPath, 0o755);
		}

		// Replace the current binary
		const binaryPath = getCurrentBinaryPath();
		const backupPath = `${binaryPath}.backup`;

		console.log(`Installing to ${binaryPath}...`);

		try {
			// Backup current binary
			try {
				copyFileSync(binaryPath, backupPath);
			} catch {
				// No existing binary to backup
			}

			// Replace with new binary
			renameSync(tempPath, binaryPath);

			// Remove backup on success
			try {
				unlinkSync(backupPath);
			} catch {
				// Ignore
			}

			console.log(`\n✓ Successfully upgraded to v${latestVersion}`);
		} catch (err) {
			// Try to restore backup
			try {
				renameSync(backupPath, binaryPath);
			} catch {
				// Ignore
			}

			// Clean up temp file
			try {
				unlinkSync(tempPath);
			} catch {
				// Ignore
			}

			throw err;
		}
	} catch (error) {
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
function compareVersions(a: string, b: string): number {
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

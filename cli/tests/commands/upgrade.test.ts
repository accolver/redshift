/**
 * Tests for upgrade command pure functions
 *
 * L2: Function-Author - TDD for version comparison and extraction
 */

import { describe, expect, test } from 'bun:test';
import {
	compareVersions,
	detectArch,
	detectOS,
	extractVersion,
	parseTrustedChecksum,
	replaceBinaryAtomically,
	smokeTestDownloadedBinary,
	verifyArtifactAttestation,
} from '../../src/commands/upgrade';

describe('Upgrade Command', () => {
	describe('compareVersions', () => {
		test('returns 0 for equal versions', () => {
			expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
		});

		test('returns 0 for equal multi-digit versions', () => {
			expect(compareVersions('10.20.30', '10.20.30')).toBe(0);
		});

		test('returns -1 when first version is older (major)', () => {
			expect(compareVersions('0.3.0', '1.0.0')).toBe(-1);
		});

		test('returns -1 when first version is older (minor)', () => {
			expect(compareVersions('1.0.0', '1.1.0')).toBe(-1);
		});

		test('returns -1 when first version is older (patch)', () => {
			expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
		});

		test('returns 1 when first version is newer (major)', () => {
			expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
		});

		test('returns 1 when first version is newer (minor)', () => {
			expect(compareVersions('1.2.0', '1.1.0')).toBe(1);
		});

		test('returns 1 when first version is newer (patch)', () => {
			expect(compareVersions('1.0.2', '1.0.1')).toBe(1);
		});

		test('handles versions with different lengths', () => {
			expect(compareVersions('1.0', '1.0.0')).toBe(0);
			expect(compareVersions('1.0', '1.0.1')).toBe(-1);
			expect(compareVersions('1.1', '1.0.1')).toBe(1);
		});

		test('handles single-segment versions', () => {
			expect(compareVersions('1', '1')).toBe(0);
			expect(compareVersions('1', '2')).toBe(-1);
			expect(compareVersions('2', '1')).toBe(1);
		});

		test('compares multi-digit version numbers correctly', () => {
			expect(compareVersions('1.10.0', '1.9.0')).toBe(1);
			expect(compareVersions('1.9.0', '1.10.0')).toBe(-1);
		});
	});

	describe('extractVersion', () => {
		test('extracts version from "v0.3.0"', () => {
			expect(extractVersion('v0.3.0')).toBe('0.3.0');
		});

		test('extracts version from "redshift-v0.3.0"', () => {
			expect(extractVersion('redshift-v0.3.0')).toBe('0.3.0');
		});

		test('extracts version from bare "0.3.0"', () => {
			expect(extractVersion('0.3.0')).toBe('0.3.0');
		});

		test('extracts version from "v1.2.3"', () => {
			expect(extractVersion('v1.2.3')).toBe('1.2.3');
		});

		test('extracts version from complex prefix "my-app-v2.0.1"', () => {
			expect(extractVersion('my-app-v2.0.1')).toBe('2.0.1');
		});

		test('handles tag with no version pattern by stripping v prefix', () => {
			expect(extractVersion('vlatest')).toBe('latest');
		});

		test('returns tag as-is when no v prefix and no version pattern', () => {
			expect(extractVersion('latest')).toBe('latest');
		});
	});

	describe('artifact attestation', () => {
		test('binds verification to the release workflow and source digest', () => {
			let command: string[] = [];
			expect(() =>
				verifyArtifactAttestation('/tmp/redshift', 'a'.repeat(40), (args) => {
					command = args;
					return { exitCode: 0, stderr: Buffer.from('') };
				}),
			).not.toThrow();
			expect(command).toEqual([
				'gh',
				'attestation',
				'verify',
				'/tmp/redshift',
				'--repo',
				'accolver/redshift',
				'--signer-workflow',
				'accolver/redshift/.github/workflows/release.yml',
				'--source-digest',
				'a'.repeat(40),
				'--deny-self-hosted-runners',
			]);
		});

		test('fails closed when verification is unavailable or invalid', () => {
			expect(() =>
				verifyArtifactAttestation('/tmp/redshift', 'a'.repeat(40), () => ({
					exitCode: 1,
					stderr: Buffer.from('no attestation found'),
				})),
			).toThrow('Artifact attestation verification failed: no attestation found');
		});

		test('rejects an invalid release source digest before invoking gh', () => {
			let invoked = false;
			expect(() =>
				verifyArtifactAttestation('/tmp/redshift', 'not-a-digest', () => {
					invoked = true;
					return { exitCode: 0, stderr: Buffer.from('') };
				}),
			).toThrow('Invalid release source digest');
			expect(invoked).toBe(false);
		});

		test('requires the downloaded binary to execute successfully', () => {
			expect(() =>
				smokeTestDownloadedBinary('/tmp/redshift', () => ({
					exitCode: 126,
					stderr: Buffer.from('cannot execute'),
				})),
			).toThrow('Downloaded binary smoke test failed: cannot execute');
		});
	});

	describe('trusted checksum manifest', () => {
		test('requires one exact canonical entry for the selected asset', () => {
			const hash = 'b'.repeat(64);
			expect(parseTrustedChecksum(`${hash}  redshift-linux-x64\n`, 'redshift-linux-x64')).toBe(
				hash,
			);
			expect(() =>
				parseTrustedChecksum(`${hash}  redshift-linux-x64-extra\n`, 'redshift-linux-x64'),
			).toThrow('exactly one checksum');
			expect(() =>
				parseTrustedChecksum(
					`${hash}  redshift-linux-x64\n${'c'.repeat(64)}  redshift-linux-x64\n`,
					'redshift-linux-x64',
				),
			).toThrow('exactly one checksum');
			expect(() =>
				parseTrustedChecksum(`invalid  redshift-linux-x64\n`, 'redshift-linux-x64'),
			).toThrow('canonical SHA-256');
		});
	});

	describe('atomic replacement', () => {
		test('restores the previous binary when candidate rename fails', () => {
			const calls: string[] = [];
			let renameAttempt = 0;
			expect(() =>
				replaceBinaryAtomically('/install/.candidate', '/install/redshift', {
					copyFile: (source, destination) => calls.push(`copy:${source}:${destination}`),
					rename: (source, destination) => {
						renameAttempt += 1;
						calls.push(`rename:${source}:${destination}`);
						if (renameAttempt === 1) throw new Error('interrupted');
					},
					unlink: (path) => calls.push(`unlink:${path}`),
				}),
			).toThrow('interrupted');
			expect(calls).toContain('rename:/install/redshift.backup:/install/redshift');
			expect(calls).toContain('unlink:/install/.candidate');
		});
	});

	describe('detectOS', () => {
		test('returns a valid OS string for current platform', () => {
			const os = detectOS();
			expect(['darwin', 'linux']).toContain(os);
		});

		test('rejects Windows because no Windows release artifact is published', () => {
			expect(() => detectOS('win32')).toThrow('Windows binaries are not currently published');
		});
	});

	describe('detectArch', () => {
		test('returns a valid architecture string for current platform', () => {
			const arch = detectArch();
			expect(['x64', 'arm64']).toContain(arch);
		});
	});
});

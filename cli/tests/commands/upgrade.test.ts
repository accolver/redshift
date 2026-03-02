/**
 * Tests for upgrade command pure functions
 *
 * L2: Function-Author - TDD for version comparison and extraction
 */

import { describe, expect, test } from 'bun:test';
import { compareVersions, detectArch, detectOS, extractVersion } from '../../src/commands/upgrade';

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

	describe('detectOS', () => {
		test('returns a valid OS string for current platform', () => {
			const os = detectOS();
			expect(['darwin', 'linux', 'windows']).toContain(os);
		});
	});

	describe('detectArch', () => {
		test('returns a valid architecture string for current platform', () => {
			const arch = detectArch();
			expect(['x64', 'arm64']).toContain(arch);
		});
	});
});

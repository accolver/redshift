import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

test.use({ bypassCSP: true });

const repositoryRoot = resolve(import.meta.dirname, '../../..');
const fixture = resolve(import.meta.dirname, 'fixtures/backup-browser-entry.ts');
let temporaryDirectory = '';
let bundleSource = '';

test.beforeAll(() => {
	temporaryDirectory = mkdtempSync(resolve(tmpdir(), 'redshift-browser-backup-'));
	const bundle = resolve(temporaryDirectory, 'backup-browser.js');
	execFileSync('bun', ['build', fixture, '--target=browser', `--outfile=${bundle}`], {
		cwd: repositoryRoot,
		stdio: 'pipe',
	});
	bundleSource = readFileSync(bundle, 'utf8');
});

test.afterAll(() => {
	if (temporaryDirectory) rmSync(temporaryDirectory, { recursive: true, force: true });
});

test('shared encrypted backup format round-trips in Chromium WebCrypto', async ({ page }) => {
	await page.goto('/');
	await page.addScriptTag({ content: bundleSource });
	const restored = await page.evaluate(async () => {
		const runner = (
			globalThis as typeof globalThis & {
				runRedshiftBackupInterop?: () => Promise<unknown>;
			}
		).runRedshiftBackupInterop;
		if (!runner) throw new Error('Backup browser interoperability fixture did not load');
		return runner();
	});
	expect(restored).toMatchObject({
		schema: 'com.redshiftapp.backup',
		version: 1,
		entries: [
			{
				project: 'browser-project',
				environment: 'production',
				secrets: [['API_KEY', 'browser-secret-value']],
			},
		],
	});
});

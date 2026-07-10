import { expect, test, type Page } from '@playwright/test';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { nip19 } from 'nostr-tools';
import { generateSecretKey } from 'nostr-tools/pure';

const compiledBinary = resolve(import.meta.dirname, '../../../dist/redshift');

async function assertHydratedDashboard(page: Page, url: string, expectFrameworkCsp = false) {
	const runtimeErrors: string[] = [];
	page.on('pageerror', (error) => runtimeErrors.push(error.message));
	page.on('console', (message) => {
		if (message.type() === 'error') runtimeErrors.push(message.text());
	});
	const response = await page.goto(`${url}/admin`, { waitUntil: 'networkidle' });
	if (expectFrameworkCsp) {
		const csp = response?.headers()['content-security-policy'] ?? '';
		expect(csp).toContain("script-src 'self'");
		expect(csp).toContain("'nonce-");
		expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
	}
	await expect(page).toHaveTitle('Dashboard - Redshift Admin');
	await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Connect', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Connect to Redshift' })).toBeVisible();
	expect(runtimeErrors).toEqual([]);
}

async function getFreePort() {
	return new Promise<number>((resolvePort, reject) => {
		const server = createServer();
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => {
			const address = server.address();
			if (!address || typeof address === 'string') return reject(new Error('No TCP port'));
			server.close(() => resolvePort(address.port));
		});
	});
}

async function waitForHealth(url: string) {
	for (let attempt = 0; attempt < 80; attempt++) {
		try {
			const response = await fetch(`${url}/api/health`);
			if (response.ok) return;
		} catch {
			// Server is still starting.
		}
		await new Promise((resolveWait) => setTimeout(resolveWait, 100));
	}
	throw new Error('Embedded dashboard did not start');
}

async function waitForRelay(url: string) {
	for (let attempt = 0; attempt < 80; attempt++) {
		const connected = await new Promise<boolean>((resolveConnection) => {
			const socket = new WebSocket(url);
			const timer = setTimeout(() => resolveConnection(false), 200);
			socket.addEventListener('open', () => {
				clearTimeout(timer);
				socket.close();
				resolveConnection(true);
			});
			socket.addEventListener('error', () => {
				clearTimeout(timer);
				resolveConnection(false);
			});
		});
		if (connected) return;
		await new Promise((resolveWait) => setTimeout(resolveWait, 100));
	}
	throw new Error('Local nak relay did not start');
}

async function runCli(args: string[], env: NodeJS.ProcessEnv, cwd: string) {
	const child = spawn(compiledBinary, args, { env, cwd, stdio: ['ignore', 'pipe', 'pipe'] });
	let stdout = '';
	let stderr = '';
	child.stdout?.on('data', (chunk) => (stdout += String(chunk)));
	child.stderr?.on('data', (chunk) => (stderr += String(chunk)));
	const exitCode = await new Promise<number | null>((resolveExit) =>
		child.once('exit', resolveExit),
	);
	return { exitCode, stdout, stderr };
}

async function stopChild(child: ChildProcess | undefined) {
	if (!child || child.exitCode !== null || child.signalCode !== null) return;
	let resolveExit: (() => void) | undefined;
	const exited = new Promise<void>((resolve) => {
		resolveExit = resolve;
		child.once('exit', resolve);
	});
	child.kill('SIGTERM');
	await Promise.race([exited, new Promise<void>((resolve) => setTimeout(resolve, 1000))]);
	if (child.exitCode === null && child.signalCode === null) {
		child.kill('SIGKILL');
		await Promise.race([exited, new Promise<void>((resolve) => setTimeout(resolve, 1000))]);
	}
	if (resolveExit) child.removeListener('exit', resolveExit);
}

test('standalone dashboard hydrates and opens authentication UI', async ({ page, baseURL }) => {
	await assertHydratedDashboard(page, baseURL ?? 'http://127.0.0.1:4173', true);
});

test('embedded browser and compiled CLI share a custom local relay journey', async ({ page }) => {
	test.setTimeout(60_000);
	expect(existsSync(compiledBinary), `Compiled binary required at ${compiledBinary}`).toBe(true);
	const root = mkdtempSync(join(tmpdir(), 'redshift-browser-e2e-'));
	let relay: ChildProcess | undefined;
	let server: ChildProcess | undefined;
	try {
		const configDir = join(root, 'config');
		mkdirSync(configDir, { recursive: true });
		const relayPort = await getFreePort();
		const relayUrl = `ws://127.0.0.1:${relayPort}`;
		writeFileSync(join(configDir, 'config.json'), JSON.stringify({ relays: [relayUrl] }));
		relay = spawn('nak', ['serve', '--hostname', '127.0.0.1', '--port', String(relayPort)], {
			stdio: ['ignore', 'ignore', 'pipe'],
		});
		await waitForRelay(relayUrl);

		const port = await getFreePort();
		const url = `http://127.0.0.1:${port}`;
		server = spawn(compiledBinary, ['serve', '--port', String(port)], {
			env: { ...process.env, BROWSER: 'none', REDSHIFT_CONFIG_DIR: configDir },
			stdio: ['ignore', 'ignore', 'pipe'],
		});
		await page.route('https://relay.redshiftapp.com/api/check-payment**', (route) =>
			route.fulfill({ status: 200, contentType: 'application/json', body: '{"paid":false}' }),
		);
		await waitForHealth(url);
		const response = await page.request.get(`${url}/admin`);
		const csp = response.headers()['content-security-policy'] ?? '';
		expect(csp).toContain("script-src 'self' 'nonce-");
		expect(csp).toContain(relayUrl);
		expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");

		await assertHydratedDashboard(page, url);
		const nsec = nip19.nsecEncode(generateSecretKey());
		await page.getByRole('button', { name: /Private Key \(nsec\)/ }).click();
		await page.getByPlaceholder('nsec1...').fill(nsec);
		await page.getByRole('dialog').getByRole('button', { name: 'Connect', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Connect to Redshift' })).toBeHidden();

		await page.getByRole('button', { name: 'New Project' }).click();
		await page.getByLabel('Display Name').fill('Browser Project');
		await page.getByRole('button', { name: 'Create Project', exact: true }).click();
		const projectLink = page.getByRole('link', { name: /Browser Project/ });
		await expect(projectLink).toBeVisible();
		await projectLink.click();
		await page.waitForURL(/\/admin\/projects\/browser-project\/dev$/);

		await page.getByRole('button', { name: 'Add Secret', exact: true }).click();
		await page.getByPlaceholder('SECRET_NAME').fill('E2E_SECRET');
		await page.getByPlaceholder('Value').fill('browser-secret-value');
		await page
			.locator('[data-add-secret-row]')
			.getByRole('button', { name: 'Save', exact: true })
			.click();
		await expect(page.locator('[data-secret-key="E2E_SECRET"]')).toBeVisible();
		await page.reload({ waitUntil: 'networkidle' });
		await expect(page.locator('[data-secret-key="E2E_SECRET"]')).toBeVisible();

		const runtimeRelays = await page.evaluate(() => window.__REDSHIFT_RUNTIME_CONFIG__?.relays);
		expect(runtimeRelays).toEqual([`${relayUrl}/`]);
		const cli = await runCli(
			[
				'--config-dir',
				configDir,
				'secrets',
				'get',
				'E2E_SECRET',
				'--raw',
				'--project',
				'browser-project',
				'--config',
				'dev',
			],
			{ ...process.env, REDSHIFT_NSEC: nsec },
			root,
		);
		expect(cli.exitCode, cli.stderr).toBe(0);
		expect(cli.stdout).toBe('browser-secret-value');
	} finally {
		await Promise.all([stopChild(server), stopChild(relay)]);
		rmSync(root, { recursive: true, force: true });
	}
});

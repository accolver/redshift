import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { type Server as HttpServer, createServer as createHttpServer } from 'node:http';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { type Page, expect, test } from '@playwright/test';
import { nip19 } from 'nostr-tools';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
const compiledBinary = resolve(import.meta.dirname, '../../../dist/redshift');
const relayProcessScript = resolve(
	import.meta.dirname,
	'../../../tests/helpers/nostr-test-relay-process.ts',
);

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

async function startUnavailableEndpoint() {
	const server = createHttpServer((_request, response) => {
		response.writeHead(503, { 'Content-Type': 'text/plain' });
		response.end('temporarily unavailable');
	});
	await new Promise<void>((resolveListen, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', resolveListen);
	});
	const address = server.address();
	if (!address || typeof address === 'string') throw new Error('No unavailable endpoint port');
	return { server, port: address.port, url: `ws://127.0.0.1:${address.port}/` };
}

async function stopHttpServer(server: HttpServer | undefined) {
	if (!server?.listening) return;
	await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
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

function captureChildDiagnostics(child: ChildProcess, label: string) {
	let output = '';
	const append = (message: string) => {
		output = `${output}${message}`.slice(-8192);
	};
	child.stderr?.on('data', (chunk) => append(String(chunk)));
	child.once('error', (error) => append(`\n${label} error: ${error.message}`));
	child.once('exit', (code, signal) => append(`\n${label} exited: code=${code} signal=${signal}`));
	return () => output;
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

interface RelayProcess {
	child: ChildProcess;
	port: number;
	url: string;
}

interface RelayProcessStats {
	publishCount: number;
	publishedEvents: Array<Record<string, unknown>>;
	events: Array<Record<string, unknown>>;
}

async function startRelayProcess(
	port: number,
	behavior: 'accept' | 'reject',
): Promise<RelayProcess> {
	const child = spawn('bun', [relayProcessScript, '--port', String(port), '--behavior', behavior], {
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	const diagnostics = captureChildDiagnostics(child, `${behavior} relay ${port}`);
	let stdout = '';
	const boundPort = await new Promise<number>((resolvePort, reject) => {
		const timer = setTimeout(() => reject(new Error('Relay process readiness timed out')), 5000);
		const onData = (chunk: Buffer) => {
			stdout += String(chunk);
			const match = stdout.match(/ready:(\d+)/);
			if (!match?.[1]) return;
			clearTimeout(timer);
			child.stdout?.off('data', onData);
			resolvePort(Number(match[1]));
		};
		child.stdout?.on('data', onData);
		child.once('error', (error) => {
			clearTimeout(timer);
			reject(error);
		});
		child.once('exit', (code) => {
			if (!stdout.includes('ready:')) {
				clearTimeout(timer);
				reject(new Error(`Relay exited before readiness (${code})`));
			}
		});
	}).catch(async (error) => {
		await stopChild(child);
		throw new Error(`${String(error)}\n${diagnostics()}`);
	});
	const url = `ws://127.0.0.1:${boundPort}/`;
	try {
		await waitForRelay(url);
	} catch (error) {
		await stopChild(child);
		throw new Error(`${String(error)}\n${diagnostics()}`);
	}
	return { child, port: boundPort, url };
}

async function relayStats(relay: RelayProcess): Promise<RelayProcessStats> {
	const response = await fetch(`http://127.0.0.1:${relay.port}/stats`);
	if (!response.ok) throw new Error(`Relay stats failed: ${response.status}`);
	return (await response.json()) as RelayProcessStats;
}

async function openRecoveryDetails(page: Page) {
	const button = page.getByRole('button', { name: 'Details' });
	if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click();
}

test('standalone dashboard hydrates and offers secure fallback when NIP-07 is unavailable', async ({
	page,
	baseURL,
}) => {
	await assertHydratedDashboard(page, baseURL ?? 'http://127.0.0.1:4173', true);
	const extension = page.getByRole('button', { name: /Browser Extension/ });
	await expect(extension).toBeDisabled();
	await expect(extension).toContainText('No extension detected');
	await expect(page.getByRole('button', { name: /Private Key \(nsec\)/ })).toBeEnabled();
	await expect(page.getByRole('button', { name: /Bunker URL \(NIP-46\)/ })).toBeEnabled();
});

test('browser exposes degraded relay state and retries only the unavailable relay with the exact event', async ({
	page,
}) => {
	test.setTimeout(120_000);
	expect(existsSync(compiledBinary), `Compiled binary required at ${compiledBinary}`).toBe(true);
	const root = mkdtempSync(join(tmpdir(), 'redshift-browser-recovery-e2e-'));
	const relayProcesses: RelayProcess[] = [];
	let recovered: RelayProcess | undefined;
	let unavailableServer: HttpServer | undefined;
	let server: ChildProcess | undefined;
	try {
		const accepting: RelayProcess[] = [];
		for (let index = 0; index < 3; index++) {
			const relay = await startRelayProcess(0, 'accept');
			accepting.push(relay);
			relayProcesses.push(relay);
		}
		const rejected = await startRelayProcess(0, 'reject');
		relayProcesses.push(rejected);
		const unavailableEndpoint = await startUnavailableEndpoint();
		unavailableServer = unavailableEndpoint.server;
		const offlinePort = unavailableEndpoint.port;
		const offlineUrl = unavailableEndpoint.url;
		const configDir = join(root, 'config');
		mkdirSync(configDir, { recursive: true });
		writeFileSync(
			join(configDir, 'config.json'),
			JSON.stringify({ relays: [...accepting.map(({ url }) => url), rejected.url, offlineUrl] }),
		);

		const port = await getFreePort();
		const url = `http://127.0.0.1:${port}`;
		server = spawn(compiledBinary, ['serve', '--port', String(port)], {
			env: { ...process.env, BROWSER: 'none', REDSHIFT_CONFIG_DIR: configDir },
			stdio: ['ignore', 'ignore', 'pipe'],
		});
		const serverDiagnostics = captureChildDiagnostics(server, 'recovery embedded server');
		await page.route('https://relay.redshiftapp.com/api/check-payment**', (route) =>
			route.fulfill({ status: 200, contentType: 'application/json', body: '{"paid":false}' }),
		);
		try {
			await waitForHealth(url);
		} catch (error) {
			throw new Error(`${String(error)}\n${serverDiagnostics()}`);
		}

		await assertHydratedDashboard(page, url);
		const secretKey = generateSecretKey();
		const nsec = nip19.nsecEncode(secretKey);
		const npub = nip19.npubEncode(getPublicKey(secretKey));
		await page.getByRole('button', { name: /Private Key \(nsec\)/ }).click();
		await page.getByPlaceholder('nsec1...').fill(nsec);
		await page.getByRole('dialog').getByRole('button', { name: 'Connect', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Connect to Redshift' })).toBeHidden();

		await page.getByRole('button', { name: 'New Project' }).click();
		await page.getByLabel('Display Name').fill('Recovery Project');
		await page.getByRole('button', { name: 'Create Project', exact: true }).click();
		await expect(page.getByTestId('publication-recovery-panel')).toBeHidden();

		await page.getByRole('link', { name: /Recovery Project/ }).click();
		await page.waitForURL(/\/admin\/projects\/recovery-project\/dev$/);
		await page.getByRole('button', { name: 'Add Secret', exact: true }).click();
		await page.getByPlaceholder('SECRET_NAME').fill('RECOVERY_SECRET');
		await page.getByPlaceholder('Value').fill('relay-recovery-value');
		await page
			.locator('[data-add-secret-row]')
			.getByRole('button', { name: 'Save', exact: true })
			.click();
		await expect(page.locator('[data-secret-key="RECOVERY_SECRET"]')).toBeVisible({
			timeout: 30_000,
		});
		await expect(page.getByText('Saved with degraded relay redundancy')).toBeVisible();
		await openRecoveryDetails(page);
		await expect(page.getByText('accepted', { exact: true })).toHaveCount(3);
		await expect(page.getByText('rejected', { exact: true })).toHaveCount(1);
		await expect(page.getByText('unavailable', { exact: true })).toHaveCount(1);

		const stored = await page.evaluate(() => {
			const raw = sessionStorage.getItem('redshift_publication_recovery_v1');
			if (!raw) throw new Error('Missing browser recovery record');
			return JSON.parse(raw).records[0];
		});
		const eventId = stored.event.id as string;
		const exactEvent = stored.event;
		const countsBeforeRetry = (await Promise.all(accepting.map(relayStats))).map(
			({ publishCount }) => publishCount,
		);
		const rejectedCountBeforeRetry = (await relayStats(rejected)).publishCount;

		await page.reload({ waitUntil: 'networkidle' });
		await expect(page.getByTestId('publication-recovery-panel')).toBeVisible();
		await stopHttpServer(unavailableServer);
		unavailableServer = undefined;
		recovered = await startRelayProcess(offlinePort, 'accept');
		relayProcesses.push(recovered);
		await openRecoveryDetails(page);
		await page.getByRole('button', { name: 'Retry unavailable relays' }).click();
		await expect
			.poll(async () => (recovered ? (await relayStats(recovered)).publishCount : 0))
			.toBe(1);
		await expect(page.getByText('unavailable', { exact: true })).toHaveCount(0);
		await expect(page.getByText('rejected', { exact: true })).toHaveCount(1);
		expect(
			(await Promise.all(accepting.map(relayStats))).map(({ publishCount }) => publishCount),
		).toEqual(countsBeforeRetry);
		expect((await relayStats(rejected)).publishCount).toBe(rejectedCountBeforeRetry);
		const recoveredStats = await relayStats(recovered);
		expect(recoveredStats.publishedEvents[0]).toEqual(exactEvent);
		expect(recoveredStats.events.find(({ id }) => id === eventId)).toEqual(exactEvent);

		const recoveredConfigDir = join(root, 'recovered-config');
		mkdirSync(recoveredConfigDir, { recursive: true });
		writeFileSync(
			join(recoveredConfigDir, 'config.json'),
			JSON.stringify({ relays: [offlineUrl] }),
		);
		const cli = await runCli(
			[
				'--config-dir',
				recoveredConfigDir,
				'secrets',
				'get',
				'RECOVERY_SECRET',
				'--raw',
				'--project',
				'recovery-project',
				'--config',
				'dev',
			],
			{ ...process.env, REDSHIFT_NSEC: nsec },
			root,
		);
		expect(cli.exitCode, cli.stderr).toBe(0);
		expect(cli.stdout).toBe('relay-recovery-value');

		const profileLabel = `${npub.slice(0, 8)}...${npub.slice(-6)}`;
		await page.locator('header button').filter({ hasText: profileLabel }).click();
		await page.getByRole('button', { name: 'Disconnect' }).click();
		await page.waitForURL(`${url}/`);
		expect(
			await page.evaluate(() => sessionStorage.getItem('redshift_publication_recovery_v1')),
		).toBeNull();
	} finally {
		await stopHttpServer(unavailableServer);
		await stopChild(server);
		await Promise.all(relayProcesses.map(({ child }) => stopChild(child)));
		rmSync(root, { recursive: true, force: true });
	}
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
		const relayDiagnostics = captureChildDiagnostics(relay, 'nak relay');
		try {
			await waitForRelay(relayUrl);
		} catch (error) {
			throw new Error(`${String(error)}\n${relayDiagnostics()}`);
		}

		const port = await getFreePort();
		const url = `http://127.0.0.1:${port}`;
		server = spawn(compiledBinary, ['serve', '--port', String(port)], {
			env: { ...process.env, BROWSER: 'none', REDSHIFT_CONFIG_DIR: configDir },
			stdio: ['ignore', 'ignore', 'pipe'],
		});
		const serverDiagnostics = captureChildDiagnostics(server, 'embedded server');
		await page.route('https://relay.redshiftapp.com/api/check-payment**', (route) =>
			route.fulfill({ status: 200, contentType: 'application/json', body: '{"paid":false}' }),
		);
		try {
			await waitForHealth(url);
		} catch (error) {
			throw new Error(`${String(error)}\n${serverDiagnostics()}`);
		}
		const response = await page.request.get(`${url}/admin`);
		const csp = response.headers()['content-security-policy'] ?? '';
		expect(csp).toContain("script-src 'self' 'nonce-");
		expect(csp).toContain(relayUrl);
		expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");

		await assertHydratedDashboard(page, url);
		const secretKey = generateSecretKey();
		const nsec = nip19.nsecEncode(secretKey);
		const npub = nip19.npubEncode(getPublicKey(secretKey));
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

		page.once('dialog', (dialog) => dialog.accept());
		const secretRow = page.locator('[data-secret-key="E2E_SECRET"]');
		await secretRow.getByRole('button').last().click();
		await page.getByRole('menuitem', { name: 'Delete' }).click();
		await expect(secretRow).toBeHidden();
		const deleted = await runCli(
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
		expect(deleted.exitCode).toBe(1);
		expect(deleted.stderr).toContain("Secret 'E2E_SECRET' not found");

		expect(
			await page.evaluate(() =>
				Object.keys(sessionStorage).some((key) => key.startsWith('redshift_encrypted_')),
			),
		).toBe(true);
		const profileLabel = `${npub.slice(0, 8)}...${npub.slice(-6)}`;
		await page.locator('header button').filter({ hasText: profileLabel }).click();
		await page.getByRole('button', { name: 'Disconnect' }).click();
		await page.waitForURL(`${url}/`);
		expect(
			await page.evaluate(() =>
				Object.keys(sessionStorage).some((key) => key.startsWith('redshift_encrypted_')),
			),
		).toBe(false);
		const remainingKeys = await page.evaluate(
			() =>
				new Promise<number>((resolveCount, reject) => {
					const request = indexedDB.open('redshift-secure', 1);
					request.onerror = () => reject(request.error);
					request.onsuccess = () => {
						const db = request.result;
						const transaction = db.transaction('keys', 'readonly');
						const count = transaction.objectStore('keys').count();
						count.onerror = () => reject(count.error);
						count.onsuccess = () => resolveCount(count.result);
						transaction.oncomplete = () => db.close();
					};
				}),
		);
		expect(remainingKeys).toBe(0);
	} finally {
		await Promise.all([stopChild(server), stopChild(relay)]);
		rmSync(root, { recursive: true, force: true });
	}
});

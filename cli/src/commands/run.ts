/**
 * Run Command - Execute commands with secrets injected
 *
 * L5: Journey-Validator - Secret injection workflow
 */

import { spawn } from 'node:child_process';
import { existsSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { getRelays, loadProjectConfig } from '../lib/config';
import { SecretManager, injectSecrets } from '../lib/secret-manager';
import { redactValue } from '../lib/validation';
import { requireAuth } from './login';
import { formatSecretsAsEnv, formatSecretsAsJson } from './secrets';

export interface RunOptions {
	/** Command and arguments to execute */
	command: string[];
	/** Override project ID */
	project?: string;
	/** Override environment */
	environment?: string;
	/** Preserve color output */
	preserveColor?: boolean;
	/** Path to write secrets file (mount) */
	mount?: string;
	/** Format for the mounted secrets file (default: 'env') */
	mountFormat?: 'env' | 'json';
	/** Path to fallback file for offline mode */
	fallback?: string;
	/** Skip relay entirely, read secrets from fallback file */
	fallbackOnly?: boolean;
	/** Read fallback on relay failure, but never write to it */
	fallbackReadonly?: boolean;
	/** Disable all fallback behavior */
	noFallback?: boolean;
}

/**
 * Parse command tokens from an array of strings, handling quoted substrings.
 *
 * When the user passes a single string like `"echo 'hello world'"`, we need to
 * split it into `["echo", "hello world"]` rather than `["echo", "'hello", "world'"]`.
 * Multiple tokens are joined first, then re-split respecting single and double quotes.
 */
function parseCommandTokens(parts: string[]): string[] {
	const input = parts.join(' ');
	const tokens: string[] = [];
	let current = '';
	let inSingle = false;
	let inDouble = false;
	let escaped = false;

	for (let i = 0; i < input.length; i++) {
		const ch = input[i];

		if (escaped) {
			current += ch;
			escaped = false;
			continue;
		}

		if (ch === '\\' && !inSingle) {
			escaped = true;
			continue;
		}

		if (ch === "'" && !inDouble) {
			inSingle = !inSingle;
			continue;
		}

		if (ch === '"' && !inSingle) {
			inDouble = !inDouble;
			continue;
		}

		if (ch === ' ' && !inSingle && !inDouble) {
			if (current.length > 0) {
				tokens.push(current);
				current = '';
			}
			continue;
		}

		current += ch;
	}

	if (current.length > 0) {
		tokens.push(current);
	}

	return tokens;
}

/**
 * Write secrets to a file in the specified format.
 */
export async function writeMountFile(
	secrets: Record<string, unknown>,
	mountPath: string,
	format: 'env' | 'json' = 'env',
) {
	const content = format === 'json' ? formatSecretsAsJson(secrets) : formatSecretsAsEnv(secrets);
	await Bun.write(mountPath, content);
}

/**
 * Remove a mount file, ignoring errors if it doesn't exist.
 */
export function cleanupMountFile(mountPath: string) {
	try {
		unlinkSync(mountPath);
	} catch {
		/* ignore if already deleted */
	}
}

/**
 * Write secrets to a fallback file as JSON.
 */
export async function writeFallbackFile(
	secrets: Record<string, string>,
	path: string,
): Promise<void> {
	await Bun.write(path, JSON.stringify(secrets));
}

/**
 * Read and parse secrets from a fallback file.
 * Throws if the file doesn't exist or contains invalid JSON.
 */
export async function readFallbackFile(path: string): Promise<Record<string, string>> {
	if (!existsSync(path)) {
		throw new Error(`Fallback file not found: ${path}`);
	}
	const file = Bun.file(path);
	const content = await file.text();
	const parsed: unknown = JSON.parse(content);
	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		throw new Error(`Fallback file does not contain a JSON object: ${path}`);
	}
	return parsed as Record<string, string>;
}

/**
 * Find and delete *.fallback.json files in the given directory.
 * Returns the list of deleted filenames.
 */
export function cleanFallbackFiles(configDir: string): string[] {
	if (!existsSync(configDir)) {
		return [];
	}
	const entries = readdirSync(configDir);
	const deleted: string[] = [];
	for (const entry of entries) {
		if (entry.endsWith('.fallback.json')) {
			unlinkSync(join(configDir, entry));
			deleted.push(entry);
		}
	}
	return deleted;
}

/**
 * Execute a command with secrets injected into the environment.
 */
export async function runCommand(options: RunOptions): Promise<void> {
	if (options.command.length === 0) {
		console.error('Error: No command specified.');
		console.error('Usage: redshift run -- <command> [args...]');
		process.exit(1);
	}

	// Load project config
	const cwd = process.cwd();
	const projectConfig = await loadProjectConfig(cwd);

	const projectId = options.project || projectConfig?.project;
	const environment = options.environment || projectConfig?.environment;

	if (!projectId || !environment) {
		console.error('Error: No project configured.');
		console.error('Run `redshift setup` first or specify --project and --environment.');
		process.exit(1);
	}

	// Handle --fallback-only: skip relay entirely
	if (options.fallbackOnly) {
		if (!options.fallback) {
			console.error('Error: --fallback-only requires --fallback <path>');
			process.exit(1);
		}
		console.error(`Using fallback file: ${options.fallback}`);
	}

	let secrets: Record<string, string> | null = null;
	let manager: SecretManager | undefined;

	if (options.fallbackOnly && options.fallback) {
		// Skip relay, read directly from fallback
		secrets = await readFallbackFile(options.fallback);
	} else {
		// Require authentication and connect to relays
		const auth = await requireAuth();
		const relays = projectConfig?.relays || (await getRelays());
		manager = new SecretManager(auth.signer);
		manager.connect(relays);
	}

	try {
		if (!options.fallbackOnly && manager) {
			console.error(`Fetching secrets for ${projectId}/${environment}...`);

			// Fetch secrets from relay, with fallback on failure
			try {
				secrets = await manager.fetchSecrets(projectId, environment);

				// Write fallback on success (unless noFallback or fallbackReadonly)
				if (secrets && options.fallback && !options.noFallback && !options.fallbackReadonly) {
					await writeFallbackFile(secrets, options.fallback);
				}
			} catch (relayError) {
				// Try fallback on relay failure
				if (options.fallback && !options.noFallback) {
					console.error(`Relay fetch failed, using fallback: ${options.fallback}`);
					secrets = await readFallbackFile(options.fallback);
				} else {
					throw relayError;
				}
			}
		}

		if (!secrets) {
			console.error(`Warning: No secrets found for ${projectId}/${environment}`);
			console.error('Running command without secrets...\n');
		}

		// Inject secrets into environment
		const env = injectSecrets(process.env as Record<string, string>, secrets || {});

		// Write secrets to mount file if requested
		let mountFilePath: string | undefined;
		if (options.mount) {
			await writeMountFile(secrets || {}, options.mount, options.mountFormat || 'env');
			mountFilePath = options.mount;
			env.REDSHIFT_CLI_SECRETS_PATH = mountFilePath;
		}

		// Execute the command
		// Parse command tokens, respecting quoted strings to avoid shell injection
		const tokens = parseCommandTokens(options.command);
		const [cmd, ...args] = tokens;

		if (!cmd) {
			console.error('Error: No command specified.');
			process.exit(1);
		}

		console.error(`Running: ${options.command.join(' ')}\n`);

		try {
			const child = spawn(cmd, args, {
				env,
				stdio: 'inherit',
				// Only use shell on Windows where it's needed for .cmd/.bat resolution
				shell: process.platform === 'win32',
			});

			// Wrap the child process in a Promise so we can await its completion
			// before disconnecting from relays. Without this, manager.disconnect()
			// in the finally block would fire while the child is still running.
			const exitCode = await new Promise<number>((resolve, reject) => {
				child.on('error', (err) => {
					reject(new Error(`Failed to start command: ${err.message}`));
				});

				child.on('close', (code) => {
					resolve(code ?? 0);
				});
			});

			manager?.disconnect();
			process.exit(exitCode);
		} finally {
			if (mountFilePath) {
				cleanupMountFile(mountFilePath);
			}
		}
	} catch (error) {
		manager?.disconnect();
		if (error instanceof Error && error.message.startsWith('Failed to start command:')) {
			console.error(error.message);
		} else {
			console.error('Error fetching secrets:', error);
		}
		process.exit(1);
	}
}

/**
 * Dry run - show what would be injected without executing.
 */
export async function runDryCommand(options: RunOptions): Promise<void> {
	// Load project config
	const cwd = process.cwd();
	const projectConfig = await loadProjectConfig(cwd);

	const projectId = options.project || projectConfig?.project;
	const environment = options.environment || projectConfig?.environment;

	if (!projectId || !environment) {
		console.error('Error: No project configured.');
		process.exit(1);
	}

	// Require authentication
	const auth = await requireAuth();

	// Connect to relays
	const relays = projectConfig?.relays || (await getRelays());
	const manager = new SecretManager(auth.signer);
	manager.connect(relays);

	try {
		const secrets = await manager.fetchSecrets(projectId, environment);

		console.log(`Secrets for ${projectId}/${environment}:`);
		console.log('');

		if (!secrets || Object.keys(secrets).length === 0) {
			console.log('  (no secrets configured)');
		} else {
			for (const [key, value] of Object.entries(secrets)) {
				console.log(`  ${key} = ${redactValue(value)}`);
			}
		}

		console.log('');
		console.log("Values redacted for security. Use 'secrets list' to view.");
		console.log('');
		console.log(`Would execute: ${options.command.join(' ')}`);
	} finally {
		manager.disconnect();
	}
}

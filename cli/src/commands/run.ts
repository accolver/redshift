/**
 * Run Command - Execute commands with secrets injected
 *
 * L5: Journey-Validator - Secret injection workflow
 */

import { spawn } from 'node:child_process';
import { getRelays, loadProjectConfig } from '../lib/config';
import { SecretManager, injectSecrets } from '../lib/secret-manager';
import { redactValue } from '../lib/validation';
import { requireAuth } from './login';

export interface RunOptions {
	/** Command and arguments to execute */
	command: string[];
	/** Override project ID */
	project?: string;
	/** Override environment */
	environment?: string;
	/** Preserve color output */
	preserveColor?: boolean;
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

	// Require authentication
	const auth = await requireAuth();

	// Connect to relays
	const relays = projectConfig?.relays || (await getRelays());
	const manager = new SecretManager(auth.privateKey ?? auth.signer!);
	manager.connect(relays);

	try {
		console.error(`Fetching secrets for ${projectId}/${environment}...`);

		// Fetch secrets
		const secrets = await manager.fetchSecrets(projectId, environment);

		if (!secrets) {
			console.error(`Warning: No secrets found for ${projectId}/${environment}`);
			console.error('Running command without secrets...\n');
		}

		// Inject secrets into environment
		const env = injectSecrets(process.env as Record<string, string>, secrets || {});

		// Execute the command
		// Parse command tokens, respecting quoted strings to avoid shell injection
		const tokens = parseCommandTokens(options.command);
		const [cmd, ...args] = tokens;

		if (!cmd) {
			console.error('Error: No command specified.');
			process.exit(1);
		}

		console.error(`Running: ${options.command.join(' ')}\n`);

		const child = spawn(cmd, args, {
			env,
			stdio: 'inherit',
			// Only use shell on Windows where it's needed for .cmd/.bat resolution
			shell: process.platform === 'win32',
		});

		// Wrap the child process in a Promise so we can await its completion
		// before disconnecting from relays. Without this, manager.close()
		// in the finally block would fire while the child is still running.
		const exitCode = await new Promise<number>((resolve, reject) => {
			child.on('error', (err) => {
				reject(new Error(`Failed to start command: ${err.message}`));
			});

			child.on('close', (code) => {
				resolve(code ?? 0);
			});
		});

		await manager.close();
		process.exit(exitCode);
	} catch (error) {
		await manager.close();
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
	const manager = new SecretManager(auth.privateKey ?? auth.signer!);
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
		await manager.close();
	}
}

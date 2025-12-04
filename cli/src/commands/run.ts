/**
 * Run Command - Execute commands with secrets injected
 *
 * L5: Journey-Validator - Secret injection workflow
 */

import { spawn } from 'node:child_process';
import { getRelays, loadProjectConfig } from '../lib/config';
import { SecretManager, injectSecrets } from '../lib/secret-manager';
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
	const manager = new SecretManager(auth.privateKey);
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
		const [cmd, ...args] = options.command;

		if (!cmd) {
			console.error('Error: No command specified.');
			process.exit(1);
		}

		console.error(`Running: ${options.command.join(' ')}\n`);

		const child = spawn(cmd, args, {
			env,
			stdio: 'inherit',
			shell: true,
		});

		child.on('error', (err) => {
			console.error(`Failed to start command: ${err.message}`);
			process.exit(1);
		});

		child.on('close', (code) => {
			process.exit(code ?? 0);
		});
	} catch (error) {
		console.error('Error fetching secrets:', error);
		process.exit(1);
	} finally {
		manager.disconnect();
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
	const manager = new SecretManager(auth.privateKey);
	manager.connect(relays);

	try {
		const secrets = await manager.fetchSecrets(projectId, environment);

		console.log(`Secrets for ${projectId}/${environment}:`);
		console.log('');

		if (!secrets || Object.keys(secrets).length === 0) {
			console.log('  (no secrets configured)');
		} else {
			for (const [key, value] of Object.entries(secrets)) {
				const displayValue =
					typeof value === 'string' && value.length > 20
						? `${value.substring(0, 20)}...`
						: JSON.stringify(value);
				console.log(`  ${key}=${displayValue}`);
			}
		}

		console.log('');
		console.log(`Would execute: ${options.command.join(' ')}`);
	} finally {
		manager.disconnect();
	}
}

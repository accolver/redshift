/**
 * Run Command - execute an exact argv or explicit shell command with secrets.
 */

import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { constants as osConstants } from 'node:os';
import { getRelays, loadProjectConfig } from '../lib/config';
import { ValidationError } from '../lib/errors';
import { SecretManager, injectSecrets } from '../lib/secret-manager';
import { redactValue } from '../lib/validation';
import { requireAuth } from './login';

const ENVIRONMENT_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const FORWARDED_SIGNALS: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP'];

export interface RunOptions {
	/** Exact executable and arguments supplied after `run --`. */
	command: string[];
	/** Explicit shell program supplied through `run --command`. */
	shellCommand?: string;
	/** Override project ID. */
	project?: string;
	/** Override environment. */
	environment?: string;
	/** Existing environment names that take precedence over fetched secrets. */
	preserveEnv?: string[];
}

export interface ResolvedChildCommand {
	executable: string;
	args: string[];
}

export function resolveChildCommand(
	options: Pick<RunOptions, 'command' | 'shellCommand'>,
	platform: NodeJS.Platform = process.platform,
): ResolvedChildCommand {
	if (options.shellCommand !== undefined) {
		if (options.shellCommand.length === 0) {
			throw new ValidationError('No command specified for --command.');
		}
		if (options.command.length > 0) {
			throw new ValidationError('Use either --command or positional argv after --, not both.');
		}
		if (platform === 'win32') {
			return {
				executable: process.env.ComSpec || 'cmd.exe',
				args: ['/d', '/s', '/c', options.shellCommand],
			};
		}
		return { executable: '/bin/sh', args: ['-c', options.shellCommand] };
	}

	const [executable, ...args] = options.command;
	if (!executable) {
		throw new ValidationError('No command specified after --.');
	}
	return { executable, args };
}

export function applyPreserveEnvironment(
	baseEnv: Record<string, string | undefined>,
	injectedEnv: Record<string, string>,
	preserveNames: string[],
): Record<string, string> {
	const result = { ...injectedEnv };
	for (const name of preserveNames) {
		if (!ENVIRONMENT_NAME.test(name)) {
			throw new ValidationError(`Invalid --preserve-env name: ${name}`);
		}
		const existing = baseEnv[name];
		if (existing !== undefined) {
			result[name] = existing;
		}
	}
	return result;
}

function signalExitCode(signal: NodeJS.Signals | null) {
	if (!signal) return 1;
	return 128 + (osConstants.signals[signal] ?? 1);
}

async function waitForChild(child: ChildProcess) {
	const forwarders = new Map<NodeJS.Signals, () => void>();
	for (const signal of FORWARDED_SIGNALS) {
		const forward = () => {
			if (!child.killed) child.kill(signal);
		};
		forwarders.set(signal, forward);
		process.on(signal, forward);
	}

	const cleanup = () => {
		for (const [signal, forward] of forwarders) {
			process.off(signal, forward);
		}
	};

	try {
		return await new Promise<number>((resolve, reject) => {
			child.once('error', (error) => {
				reject(new Error(`Failed to start command: ${error.message}`, { cause: error }));
			});
			child.once('close', (code, signal) => {
				resolve(code ?? signalExitCode(signal));
			});
		});
	} finally {
		cleanup();
	}
}

/** Execute a command with secrets injected into a hardened child environment. */
export async function runCommand(options: RunOptions): Promise<number> {
	const childCommand = resolveChildCommand(options);
	const cwd = process.cwd();
	const projectConfig = await loadProjectConfig(cwd);
	const projectId = options.project || projectConfig?.project;
	const environment = options.environment || projectConfig?.environment;

	if (!projectId || !environment) {
		throw new ValidationError(
			'No project configured. Run `redshift setup` or specify --project and --environment.',
		);
	}

	const auth = await requireAuth();
	const relays = projectConfig?.relays || (await getRelays());
	const manager = new SecretManager(auth.privateKey ?? auth.signer!);
	manager.connect(relays);

	try {
		console.error(`Fetching secrets for ${projectId}/${environment}...`);
		const secrets = await manager.fetchSecrets(projectId, environment);
		if (!secrets) {
			console.error(`Warning: No secrets found for ${projectId}/${environment}`);
			console.error('Running command without secrets...\n');
		}

		const injectedEnv = injectSecrets(
			process.env as Record<string, string | undefined>,
			secrets || {},
		);
		const env = applyPreserveEnvironment(process.env, injectedEnv, options.preserveEnv ?? []);
		console.error(`Running: ${childCommand.executable} ${childCommand.args.join(' ')}\n`);

		const child = spawn(childCommand.executable, childCommand.args, {
			env,
			stdio: 'inherit',
			shell: false,
		});
		return await waitForChild(child);
	} finally {
		await manager.close();
	}
}

/** Dry run - show what would be injected without executing. */
export async function runDryCommand(options: RunOptions): Promise<void> {
	resolveChildCommand(options);
	const cwd = process.cwd();
	const projectConfig = await loadProjectConfig(cwd);
	const projectId = options.project || projectConfig?.project;
	const environment = options.environment || projectConfig?.environment;

	if (!projectId || !environment) {
		throw new ValidationError('No project configured.');
	}

	const auth = await requireAuth();
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
		const childCommand = resolveChildCommand(options);
		console.log(`Would execute: ${childCommand.executable} ${childCommand.args.join(' ')}`);
	} finally {
		await manager.close();
	}
}

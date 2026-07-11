#!/usr/bin/env bun
/**
 * Redshift CLI Entry Point
 *
 * Decentralized, censorship-resistant secret management.
 * Doppler-compatible CLI interface using Nostr protocol.
 *
 * L7: Insight-Synthesizer - Doppler-compatible DX
 * L9: Telos-Guardian - User sovereignty through decentralization
 */

import { type ParsedArgs, createCLI } from './lib/cli';
import { VERSION } from './version';

// Import command handlers
import { backupCommand } from './commands/backup';
import { bunkerCommand } from './commands/bunker';
import { loginCommand, logoutCommand } from './commands/login';
import { recoveryCommand } from './commands/recovery';
import { runCommand } from './commands/run';
import { type SecretsSubcommand, secretsCommand } from './commands/secrets';
import { serveCommand } from './commands/serve';
import { setupCommand } from './commands/setup';
import { upgradeCommand } from './commands/upgrade';

// Create and configure CLI
const cli = createCLI(VERSION);

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
	const args = process.argv.slice(2);
	let parsed: ParsedArgs;
	try {
		parsed = cli.parse(args);
	} catch (error) {
		console.error('Error:', error instanceof Error ? error.message : String(error));
		process.exitCode = 2;
		return;
	}

	// Handle global flags first
	if (parsed.globalFlags.version) {
		console.log(`redshift v${VERSION}`);
		return;
	}

	// Handle help requests
	if (parsed.helpRequested) {
		if (parsed.command) {
			console.log(cli.generateCommandHelp(parsed.command, parsed.subcommand));
		} else {
			console.log(cli.generateMainHelp());
		}
		return;
	}

	// No command provided - show help
	if (!parsed.command) {
		console.log(cli.generateMainHelp());
		return;
	}

	// Check for unknown commands
	const cmd = cli.getCommand(parsed.command);
	if (!cmd) {
		console.error(`Unknown command: ${parsed.command}`);
		console.log('');
		console.log(cli.generateMainHelp());
		process.exitCode = 2;
		return;
	}

	// Set global config dir if provided
	if (parsed.globalFlags.configDir) {
		process.env.REDSHIFT_CONFIG_DIR = parsed.globalFlags.configDir;
	}

	// Execute the command
	try {
		await executeCommand(parsed);
	} catch (error) {
		console.error('Error:', error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}

/**
 * Execute a command based on parsed arguments
 */
async function executeCommand(parsed: ParsedArgs): Promise<void> {
	switch (parsed.command) {
		case 'login':
			return handleLoginCommand(parsed);
		case 'logout':
			return logoutCommand();
		case 'setup':
			return handleSetupCommand(parsed);
		case 'run':
			return handleRunCommand(parsed);
		case 'secrets':
			return handleSecretsCommand(parsed);
		case 'backup': {
			const file = parsed.positionals[0];
			if (!file) throw new Error('Backup file path is required');
			return backupCommand({
				subcommand: (parsed.subcommand ?? 'create') as 'create' | 'restore',
				file,
				force: parsed.flags.force === true,
				overwrite: parsed.flags.overwrite === true,
				allowIdentityChange: parsed.flags['allow-identity-change'] === true,
				passphraseStdin: parsed.flags['passphrase-stdin'] === true,
			});
		}
		case 'recovery':
			return recoveryCommand({
				subcommand: (parsed.subcommand ?? 'list') as 'list' | 'show' | 'retry' | 'remove',
				...(parsed.positionals[0] ? { eventId: parsed.positionals[0] } : {}),
				json: parsed.globalFlags.json,
			});
		case 'serve':
			return handleServeCommand(parsed);
		case 'bunker':
			return handleBunkerCommand(parsed);
		case 'configure':
			return handleConfigureCommand(parsed.subcommand, parsed.positionals, parsed.flags);
		case 'me':
			return handleMeCommand(parsed.flags);
		case 'upgrade':
			return handleUpgradeCommand(parsed);
		default:
			console.error(`Unknown command: ${parsed.command}`);
			process.exit(1);
	}
}

/**
 * Handle the bunker command
 */
async function handleBunkerCommand(parsed: ParsedArgs): Promise<void> {
	const relayFlag = parsed.flags.relay;
	const relays =
		typeof relayFlag === 'string'
			? relayFlag
					.split(',')
					.map((relay) => relay.trim())
					.filter(Boolean)
			: undefined;
	await bunkerCommand({
		subcommand: parsed.subcommand === 'status' ? 'status' : 'start',
		insecurePlaintextKeys: parsed.flags['insecure-plaintext-keys'] === true,
		...(relays ? { relays } : {}),
	});
}

/**
 * Handle the login command
 */
async function handleLoginCommand(parsed: ParsedArgs): Promise<void> {
	if (parsed.subcommand === 'revoke') {
		// Revoke is essentially logout
		await logoutCommand();
		return;
	}
	const nsec = typeof parsed.flags.nsec === 'string' ? parsed.flags.nsec : undefined;
	const bunker = typeof parsed.flags.bunker === 'string' ? parsed.flags.bunker : undefined;
	await loginCommand({
		bunkerStdin: parsed.flags['bunker-stdin'] === true,
		connect: parsed.flags.connect === true,
		force: parsed.flags.overwrite === true,
		...(nsec ? { nsec } : {}),
		...(bunker ? { bunker } : {}),
	});
}

/**
 * Handle the setup command
 */
async function handleSetupCommand(parsed: ParsedArgs): Promise<void> {
	const project = typeof parsed.flags.project === 'string' ? parsed.flags.project : undefined;
	const environment = typeof parsed.flags.config === 'string' ? parsed.flags.config : undefined;
	await setupCommand({
		force: parsed.flags.force === true,
		interactive: parsed.flags['no-interactive'] !== true,
		...(project ? { project } : {}),
		...(environment ? { environment } : {}),
	});
}

/**
 * Handle the run command
 */
async function handleRunCommand(parsed: ParsedArgs): Promise<void> {
	const preserveEnv =
		typeof parsed.flags['preserve-env'] === 'string'
			? parsed.flags['preserve-env']
					.split(',')
					.map((name) => name.trim())
					.filter(Boolean)
			: undefined;
	const shellCommand = typeof parsed.flags.command === 'string' ? parsed.flags.command : undefined;
	const project = typeof parsed.flags.project === 'string' ? parsed.flags.project : undefined;
	const environment = typeof parsed.flags.config === 'string' ? parsed.flags.config : undefined;
	const exitCode = await runCommand({
		command: parsed.positionals,
		...(shellCommand !== undefined ? { shellCommand } : {}),
		...(project ? { project } : {}),
		...(environment ? { environment } : {}),
		...(preserveEnv ? { preserveEnv } : {}),
	});
	if (exitCode !== 0) process.exitCode = exitCode;
}

/**
 * Handle the secrets command
 */
async function handleSecretsCommand(parsed: ParsedArgs): Promise<void> {
	// Default to listing if no subcommand
	const secretsSubcommand = (parsed.subcommand || 'list') as SecretsSubcommand;

	// Build options based on subcommand
	const secretsOpts: Parameters<typeof secretsCommand>[0] = {
		subcommand: secretsSubcommand,
		raw: parsed.flags.raw === true,
	};
	if (typeof parsed.flags.project === 'string') secretsOpts.project = parsed.flags.project;
	if (typeof parsed.flags.config === 'string') secretsOpts.environment = parsed.flags.config;
	if (parsed.flags.json === true) secretsOpts.format = 'json';

	// Handle positionals based on subcommand
	switch (secretsSubcommand) {
		case 'get':
			// First positional is the key
			if (parsed.positionals[0]) {
				secretsOpts.key = parsed.positionals[0];
			}
			break;
		case 'set': {
			// Support both "set KEY VALUE" and "set KEY=VALUE".
			const [first, second] = parsed.positionals;
			if (first !== undefined && second !== undefined) {
				secretsOpts.key = first;
				secretsOpts.value = second;
			} else if (first?.includes('=')) {
				const separator = first.indexOf('=');
				secretsOpts.key = first.slice(0, separator);
				secretsOpts.value = first.slice(separator + 1);
			} else if (first) {
				secretsOpts.key = first;
				// Value might be provided interactively.
			}
			break;
		}
		case 'delete':
			if (parsed.positionals[0]) {
				secretsOpts.key = parsed.positionals[0];
			}
			break;
		case 'download':
		case 'upload':
			if (parsed.positionals[0]) {
				secretsOpts.key = parsed.positionals[0]; // filepath
			}
			break;
	}

	await secretsCommand(secretsOpts);
}

/**
 * Handle the serve command
 */
async function handleServeCommand(parsed: ParsedArgs): Promise<void> {
	const port =
		typeof parsed.flags.port === 'string' ? Number.parseInt(parsed.flags.port, 10) : 3000;

	await serveCommand({
		port,
		host: typeof parsed.flags.host === 'string' ? parsed.flags.host : '127.0.0.1',
		open: parsed.flags.open === true,
	});
}

/**
 * Handle the upgrade command
 */
async function handleUpgradeCommand(parsed: ParsedArgs): Promise<void> {
	const version = typeof parsed.flags.tag === 'string' ? parsed.flags.tag : undefined;
	await upgradeCommand({
		force: parsed.flags.force === true,
		...(version ? { version } : {}),
	});
}

/**
 * Handle the configure command
 */
async function handleConfigureCommand(
	subcommand: string | undefined,
	positionals: string[],
	flags: Record<string, string | boolean | undefined>,
): Promise<void> {
	const {
		getConfigDir,
		getRelayConfigStatus,
		loadConfig,
		normalizeRelayUrls,
		redactConfig,
		resetConfig,
		saveConfig,
	} = await import('./lib/config');

	const SENSITIVE_KEYS = new Set(['nsec', 'bunker', 'authMethod', 'clientSecretKey']);
	const RELAY_USAGE_LINES = [
		'Set relays: redshift configure set relays=\'["wss://relay.example"]\'',
		'Or CSV:     redshift configure set relays=wss://relay1.example,wss://relay2.example',
		'Reset:      redshift configure unset relays',
	];

	switch (subcommand) {
		case 'relays': {
			const status = await getRelayConfigStatus();
			console.log(`Relay source: ${status.source}`);
			for (const [index, relay] of status.relays.entries()) {
				console.log(`  ${index + 1}. ${relay}`);
			}
			console.log('');
			for (const line of RELAY_USAGE_LINES) {
				console.log(line);
			}
			break;
		}

		case 'get': {
			const config = redactConfig(await loadConfig());
			if (positionals.length === 0) {
				console.log(JSON.stringify(config, null, 2));
			} else {
				for (const key of positionals) {
					const value = config[key];
					if (value !== undefined) {
						console.log(`${key}: ${JSON.stringify(value)}`);
					} else {
						console.log(`${key}: (not set)`);
					}
				}
			}
			break;
		}

		case 'set': {
			const allowedConfigKeys = new Set(['relays', 'defaultProject', 'defaultEnvironment']);
			if (positionals.length === 0) throw new Error('configure set requires key=value');
			const config = await loadConfig();
			const updates: Array<{ key: string; value: string | string[] }> = [];
			for (const arg of positionals) {
				const separator = arg.indexOf('=');
				if (separator <= 0) throw new Error(`Invalid configuration assignment: ${arg}`);
				const key = arg.slice(0, separator);
				const value = arg.slice(separator + 1);
				if (SENSITIVE_KEYS.has(key)) {
					throw new Error(`Cannot set '${key}' via configure. Use 'redshift login' instead.`);
				}
				if (!allowedConfigKeys.has(key)) {
					throw new Error(
						`Unknown config key '${key}'. Allowed: ${[...allowedConfigKeys].join(', ')}`,
					);
				}
				updates.push({
					key,
					value:
						key === 'relays'
							? normalizeRelayUrls(parseRelayConfigValue(value), 'configured relay')
							: value,
				});
			}
			for (const update of updates) {
				(config as Record<string, unknown>)[update.key] = update.value;
			}
			await saveConfig(config);
			for (const update of updates) console.log(`Set ${update.key}`);
			break;
		}

		case 'unset': {
			const allowedConfigKeys = new Set(['relays', 'defaultProject', 'defaultEnvironment']);
			if (positionals.length === 0) throw new Error('configure unset requires a key');
			for (const key of positionals) {
				if (SENSITIVE_KEYS.has(key)) {
					throw new Error(`Cannot unset '${key}' via configure. Use 'redshift logout' instead.`);
				}
				if (!allowedConfigKeys.has(key)) throw new Error(`Unknown config key '${key}'`);
			}
			const config = await loadConfig();
			const next = Object.fromEntries(
				Object.entries(config).filter(([key]) => !positionals.includes(key)),
			);
			await saveConfig(next);
			for (const key of positionals) console.log(`Unset ${key}`);
			break;
		}

		case 'reset': {
			if (flags.yes !== true) {
				throw new Error('Configuration reset requires --yes confirmation');
			}
			await resetConfig();
			console.log('Configuration reset.');
			break;
		}

		default: {
			// Show current config
			const configDir = getConfigDir();
			const config = await loadConfig();

			if (flags.all === true) {
				console.log(`Config directory: ${configDir}`);
				console.log('');
				console.log(JSON.stringify(redactConfig(config), null, 2));
			} else {
				const relayStatus = await getRelayConfigStatus();
				console.log(`Config directory: ${configDir}`);
				console.log('');
				// Show key settings
				if (config.authMethod) {
					console.log(`Auth method: ${config.authMethod}`);
				}
				if (config.defaultProject) {
					console.log(`Default project: ${config.defaultProject}`);
				}
				console.log(`Relays (${relayStatus.source}): ${relayStatus.relays.join(', ')}`);
				console.log('Run `redshift configure relays` for relay configuration help.');
			}
			break;
		}
	}
}

function parseRelayConfigValue(value: string): string[] {
	try {
		const parsed: unknown = JSON.parse(value);
		if (Array.isArray(parsed) && parsed.every((relay) => typeof relay === 'string')) {
			return parsed.map((relay) => relay.trim()).filter((relay) => relay.length > 0);
		}
	} catch {
		// Fall through to comma-separated parsing.
	}

	return value
		.split(',')
		.map((relay) => relay.trim())
		.filter((relay) => relay.length > 0);
}

/**
 * Handle the me/whoami command
 */
async function handleMeCommand(flags: Record<string, string | boolean | undefined>): Promise<void> {
	const { getAuth } = await import('./lib/config');
	const { decodeNsec } = await import('./lib/crypto');
	const { getPublicKey } = await import('nostr-tools/pure');
	const { npubEncode } = await import('nostr-tools/nip19');
	const auth = await getAuth();

	if (!auth) {
		console.log(
			flags.json === true
				? JSON.stringify({ authenticated: false })
				: 'Not logged in.\nRun `redshift login` to authenticate.',
		);
		process.exitCode = 1;
		return;
	}

	if (auth.method === 'nsec' && auth.nsec) {
		const privateKeyBytes = decodeNsec(auth.nsec);
		const pubkey = getPublicKey(privateKeyBytes);
		const npub = npubEncode(pubkey);
		if (flags.json === true) {
			console.log(
				JSON.stringify({ authenticated: true, method: 'nsec', npub, pubkey, source: auth.source }),
			);
		} else {
			console.log('Authenticated');
			console.log(`  Method: ${auth.method}`);
			console.log(`  Public key: ${npub}`);
			console.log(`  Source: ${auth.source}`);
		}
		return;
	}

	if (auth.method === 'bunker' && auth.bunker) {
		if (flags.json === true) {
			console.log(
				JSON.stringify({
					authenticated: true,
					method: 'bunker',
					bunkerPubkey: auth.bunker.bunkerPubkey,
					relays: auth.bunker.relays,
					source: auth.source,
				}),
			);
		} else {
			console.log('Authenticated via bunker');
			console.log(`  Bunker: ${auth.bunker.bunkerPubkey.substring(0, 16)}...`);
			console.log(`  Relays: ${auth.bunker.relays.join(', ')}`);
			console.log(`  Source: ${auth.source}`);
		}
		return;
	}

	console.log(
		flags.json === true
			? JSON.stringify({ authenticated: false })
			: 'Authentication method not fully configured.',
	);
	process.exitCode = 1;
}

main().catch((error: unknown) => {
	console.error('Fatal error:', error);
	process.exit(1);
});

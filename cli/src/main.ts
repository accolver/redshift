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

import { bunkerCommand } from './commands/bunker-cmd';
// Import command handlers
import { loginCommand, logoutCommand } from './commands/login';
import { runCommand } from './commands/run';
import { type SecretsSubcommand, secretsCommand } from './commands/secrets';
import { serveCommand } from './commands/serve';
import { setupCommand } from './commands/setup';
import { type TeamsSubcommand, teamsCommand } from './commands/teams';
import { upgradeCommand } from './commands/upgrade';

// Create and configure CLI
const cli = createCLI(VERSION);

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const parsed = cli.parse(args);

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
		process.exit(1);
	}

	// Set global config dir if provided
	if (parsed.globalFlags.configDir) {
		process.env.REDSHIFT_CONFIG_DIR = parsed.globalFlags.configDir;
	}

	// Execute the command
	try {
		await executeCommand(parsed);
	} catch (error) {
		if (!parsed.globalFlags.silent) {
			if (parsed.globalFlags.debug) {
				console.error('Error:', error);
			} else {
				console.error('Error:', error instanceof Error ? error.message : String(error));
			}
		}
		process.exit(1);
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
		case 'serve':
			return handleServeCommand(parsed);
		case 'configure':
			return handleConfigureCommand(parsed.subcommand, parsed.positionals, parsed.flags);
		case 'me':
			return handleMeCommand(parsed.globalFlags);
		case 'upgrade':
			return handleUpgradeCommand(parsed);
		case 'teams':
			return handleTeamsCommand(parsed);
		case 'bunker':
			return bunkerCommand(parsed);
		default:
			console.error(`Unknown command: ${parsed.command}`);
			process.exit(1);
	}
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
	await loginCommand({
		nsec: typeof parsed.flags.nsec === 'string' ? parsed.flags.nsec : undefined,
		bunker: typeof parsed.flags.bunker === 'string' ? parsed.flags.bunker : undefined,
		connect: parsed.flags.connect === true,
		force: parsed.flags.overwrite === true,
	});
}

/**
 * Handle the setup command
 */
async function handleSetupCommand(parsed: ParsedArgs): Promise<void> {
	await setupCommand({
		project: typeof parsed.flags.project === 'string' ? parsed.flags.project : undefined,
		// Map 'config' to 'environment' for Doppler compatibility
		environment: typeof parsed.flags.config === 'string' ? parsed.flags.config : undefined,
		force: parsed.flags['no-interactive'] !== true,
	});
}

/**
 * Handle the run command
 */
async function handleRunCommand(parsed: ParsedArgs): Promise<void> {
	let commandToRun: string[] = [];

	if (typeof parsed.flags.command === 'string') {
		// Treat as shell command - wrap in sh -c for proper parsing
		commandToRun = ['sh', '-c', parsed.flags.command];
	} else if (parsed.positionals.length > 0) {
		// -- echo hi style
		commandToRun = parsed.positionals;
	}

	if (commandToRun.length === 0) {
		console.error('Error: No command specified after --');
		console.error('Usage: redshift run -- <command>');
		console.error('   or: redshift run --command "your command"');
		process.exit(1);
	}

	await runCommand({
		command: commandToRun,
		project: typeof parsed.flags.project === 'string' ? parsed.flags.project : undefined,
		environment: typeof parsed.flags.config === 'string' ? parsed.flags.config : undefined,
	});
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
		project: typeof parsed.flags.project === 'string' ? parsed.flags.project : undefined,
		environment: typeof parsed.flags.config === 'string' ? parsed.flags.config : undefined,
		format: parsed.globalFlags.json ? 'json' : undefined,
		team: typeof parsed.flags.team === 'string' ? parsed.flags.team : undefined,
	};

	// Handle positionals based on subcommand
	switch (secretsSubcommand) {
		case 'get':
			// First positional is the key
			if (parsed.positionals[0]) {
				secretsOpts.key = parsed.positionals[0];
			}
			break;
		case 'set':
			// Support both "set KEY VALUE" and "set KEY=VALUE"
			if (parsed.positionals.length >= 2) {
				secretsOpts.key = parsed.positionals[0];
				secretsOpts.value = parsed.positionals[1];
			} else if (parsed.positionals[0]?.includes('=')) {
				const [key, ...valueParts] = parsed.positionals[0].split('=');
				secretsOpts.key = key;
				secretsOpts.value = valueParts.join('=');
			} else if (parsed.positionals[0]) {
				secretsOpts.key = parsed.positionals[0];
				// Value might be provided interactively
			}
			break;
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
 * Handle the teams command
 */
async function handleTeamsCommand(parsed: ParsedArgs): Promise<void> {
	const teamsSubcommand = (parsed.subcommand || 'list') as TeamsSubcommand;

	await teamsCommand({
		subcommand: teamsSubcommand,
		positionals: parsed.positionals,
		slug: typeof parsed.flags.slug === 'string' ? parsed.flags.slug : undefined,
		email: typeof parsed.flags.email === 'string' ? parsed.flags.email : undefined,
		pubkey: typeof parsed.flags.pubkey === 'string' ? parsed.flags.pubkey : undefined,
		role: typeof parsed.flags.role === 'string' ? parsed.flags.role : undefined,
		json: parsed.globalFlags.json,
		actor: typeof parsed.flags.actor === 'string' ? parsed.flags.actor : undefined,
		action: typeof parsed.flags.action === 'string' ? parsed.flags.action : undefined,
		since:
			typeof parsed.flags.since === 'string' ? Number.parseInt(parsed.flags.since, 10) : undefined,
		until:
			typeof parsed.flags.until === 'string' ? Number.parseInt(parsed.flags.until, 10) : undefined,
		limit:
			typeof parsed.flags.limit === 'string' ? Number.parseInt(parsed.flags.limit, 10) : undefined,
		offset:
			typeof parsed.flags.offset === 'string'
				? Number.parseInt(parsed.flags.offset, 10)
				: undefined,
	});
}

/**
 * Handle the upgrade command
 */
async function handleUpgradeCommand(parsed: ParsedArgs): Promise<void> {
	await upgradeCommand({
		force: parsed.flags.force === true,
		version: typeof parsed.flags.tag === 'string' ? parsed.flags.tag : undefined,
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
	const { loadConfig, saveConfig, getConfigDir } = await import('./lib/config');

	switch (subcommand) {
		case 'get': {
			const config = await loadConfig();
			if (positionals.length === 0) {
				// Show all options
				console.log(JSON.stringify(config, null, 2));
			} else {
				// Show specific options
				for (const key of positionals) {
					const value = config[key as keyof typeof config];
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
			const ALLOWED_CONFIG_KEYS = new Set([
				'relays',
				'defaultProject',
				'defaultEnvironment',
				'bunkerUrl',
			]);
			const SENSITIVE_KEYS = new Set(['nsec', 'bunker', 'authMethod', 'clientSecretKey']);
			const config = await loadConfig();
			for (const arg of positionals) {
				const [key, ...valueParts] = arg.split('=');
				if (key && valueParts.length > 0) {
					if (SENSITIVE_KEYS.has(key)) {
						console.error(`Cannot set '${key}' via configure. Use 'redshift login' instead.`);
						continue;
					}
					if (!ALLOWED_CONFIG_KEYS.has(key)) {
						console.error(
							`Unknown config key '${key}'. Allowed: ${[...ALLOWED_CONFIG_KEYS].join(', ')}`,
						);
						continue;
					}
					const value = valueParts.join('=');
					// Try to parse as JSON, fall back to string
					try {
						(config as Record<string, unknown>)[key] = JSON.parse(value);
					} catch {
						(config as Record<string, unknown>)[key] = value;
					}
					console.log(`Set ${key}`);
				}
			}
			await saveConfig(config);
			break;
		}

		case 'unset': {
			const config = await loadConfig();
			for (const key of positionals) {
				delete (config as Record<string, unknown>)[key];
				console.log(`Unset ${key}`);
			}
			await saveConfig(config);
			break;
		}

		case 'reset': {
			if (flags.yes !== true) {
				console.log('This will reset all CLI configuration.');
				console.log('Use --yes to confirm.');
				return;
			}
			const { clearAuth } = await import('./lib/config');
			await clearAuth();
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
				console.log(JSON.stringify(config, null, 2));
			} else {
				console.log(`Config directory: ${configDir}`);
				console.log('');
				// Show key settings
				if (config.authMethod) {
					console.log(`Auth method: ${config.authMethod}`);
				}
				if (config.defaultProject) {
					console.log(`Default project: ${config.defaultProject}`);
				}
				if (config.relays && config.relays.length > 0) {
					console.log(`Relays: ${config.relays.join(', ')}`);
				}
			}
			break;
		}
	}
}

/**
 * Handle the me/whoami command
 */
async function handleMeCommand(globalFlags: { json: boolean; silent: boolean }): Promise<void> {
	const { getAuth } = await import('./lib/config');
	const { decodeNsec } = await import('./lib/crypto');
	const { getPublicKey } = await import('nostr-tools/pure');
	const { npubEncode } = await import('nostr-tools/nip19');

	const auth = await getAuth();

	if (!auth) {
		if (globalFlags.json) {
			console.log(JSON.stringify({ authenticated: false }));
		} else {
			console.log('Not logged in.');
			console.log('Run `redshift login` to authenticate.');
		}
		return;
	}

	if (auth.method === 'nsec' && auth.nsec) {
		const privateKeyBytes = decodeNsec(auth.nsec);
		const pubkey = getPublicKey(privateKeyBytes);
		const npub = npubEncode(pubkey);

		if (globalFlags.json) {
			console.log(
				JSON.stringify({
					authenticated: true,
					method: 'nsec',
					npub,
					pubkey,
					source: auth.source,
				}),
			);
		} else {
			console.log('Authenticated');
			console.log(`  Method: ${auth.method}`);
			console.log(`  Public key: ${npub}`);
			console.log(`  Source: ${auth.source}`);
		}
	} else if (auth.method === 'bunker' && auth.bunker) {
		if (globalFlags.json) {
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
	} else {
		if (globalFlags.json) {
			console.log(JSON.stringify({ authenticated: false }));
		} else {
			console.log('Authentication method not fully configured.');
		}
	}
}

main().catch((error: unknown) => {
	console.error('Fatal error:', error);
	process.exit(1);
});

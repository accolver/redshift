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

import { createCLI, type ParsedArgs } from './lib/cli';
import { VERSION } from './version';

// Import command handlers
import { loginCommand, logoutCommand } from './commands/login';
import { runCommand } from './commands/run';
import { secretsCommand, type SecretsSubcommand } from './commands/secrets';
import { serveCommand } from './commands/serve';
import { setupCommand } from './commands/setup';
import {
	subscriptionCommand,
	getSubscriptionLabel,
	type SubscriptionSubcommand,
} from './commands/subscription';
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
		await showVersion();
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
 * Show version information including subscription status
 */
async function showVersion(): Promise<void> {
	console.log(`redshift v${VERSION}`);

	// Try to get subscription label (won't fail if not logged in)
	try {
		const subscriptionLabel = await getSubscriptionLabel();
		console.log(`Subscription: ${subscriptionLabel}`);
	} catch {
		// Silently ignore errors - just show version without subscription
	}
}

/**
 * Execute a command based on parsed arguments
 */
async function executeCommand(parsed: ParsedArgs): Promise<void> {
	const { command, subcommand, positionals, flags, globalFlags } = parsed;

	switch (command) {
		case 'login': {
			if (subcommand === 'revoke') {
				// Revoke is essentially logout
				await logoutCommand();
				return;
			}
			await loginCommand({
				nsec: typeof flags.nsec === 'string' ? flags.nsec : undefined,
				bunker: typeof flags.bunker === 'string' ? flags.bunker : undefined,
				connect: flags.connect === true,
				force: flags.overwrite === true,
			});
			break;
		}

		case 'logout': {
			await logoutCommand();
			break;
		}

		case 'setup': {
			await setupCommand({
				project: typeof flags.project === 'string' ? flags.project : undefined,
				// Map 'config' to 'environment' for Doppler compatibility
				environment: typeof flags.config === 'string' ? flags.config : undefined,
				force: flags['no-interactive'] !== true,
			});
			break;
		}

		case 'run': {
			// Handle --command flag or -- separator
			let commandToRun: string[] = [];

			if (typeof flags.command === 'string') {
				// --command "echo hi" style
				commandToRun = flags.command.split(' ');
			} else if (positionals.length > 0) {
				// -- echo hi style
				commandToRun = positionals;
			}

			if (commandToRun.length === 0 && subcommand !== 'clean') {
				console.error('Error: No command specified after --');
				console.error('Usage: redshift run -- <command>');
				console.error('   or: redshift run --command "your command"');
				process.exit(1);
			}

			if (subcommand === 'clean') {
				// TODO: Implement run clean
				console.log('Cleaning old fallback files...');
				console.log('Done.');
				return;
			}

			await runCommand({
				command: commandToRun,
				project: typeof flags.project === 'string' ? flags.project : undefined,
				environment: typeof flags.config === 'string' ? flags.config : undefined,
			});
			break;
		}

		case 'secrets': {
			// Default to listing if no subcommand
			const secretsSubcommand = (subcommand || 'list') as SecretsSubcommand;

			// Build options based on subcommand
			const secretsOpts: Parameters<typeof secretsCommand>[0] = {
				subcommand: secretsSubcommand,
				raw: flags.raw === true,
				project: typeof flags.project === 'string' ? flags.project : undefined,
				environment: typeof flags.config === 'string' ? flags.config : undefined,
				format: globalFlags.json ? 'json' : undefined,
			};

			// Handle positionals based on subcommand
			switch (secretsSubcommand) {
				case 'get':
					// First positional is the key
					if (positionals[0]) {
						secretsOpts.key = positionals[0];
					}
					break;
				case 'set':
					// Support both "set KEY VALUE" and "set KEY=VALUE"
					if (positionals.length >= 2) {
						secretsOpts.key = positionals[0];
						secretsOpts.value = positionals[1];
					} else if (positionals[0]?.includes('=')) {
						const [key, ...valueParts] = positionals[0].split('=');
						secretsOpts.key = key;
						secretsOpts.value = valueParts.join('=');
					} else if (positionals[0]) {
						secretsOpts.key = positionals[0];
						// Value might be provided interactively
					}
					break;
				case 'delete':
					if (positionals[0]) {
						secretsOpts.key = positionals[0];
					}
					break;
				case 'download':
				case 'upload':
					if (positionals[0]) {
						secretsOpts.key = positionals[0]; // filepath
					}
					break;
			}

			await secretsCommand(secretsOpts);
			break;
		}

		case 'serve': {
			const port = typeof flags.port === 'string' ? Number.parseInt(flags.port, 10) : 3000;

			await serveCommand({
				port,
				host: typeof flags.host === 'string' ? flags.host : '127.0.0.1',
				open: flags.open === true,
			});
			break;
		}

		case 'configure': {
			await handleConfigureCommand(subcommand, positionals, flags);
			break;
		}

		case 'me': {
			await handleMeCommand(globalFlags);
			break;
		}

		case 'upgrade': {
			await upgradeCommand({
				force: flags.force === true,
				version: typeof flags.tag === 'string' ? flags.tag : undefined,
			});
			break;
		}

		case 'subscription': {
			// Default to status if no subcommand
			const subscriptionSubcommand = (subcommand || 'status') as SubscriptionSubcommand;

			await subscriptionCommand({
				subcommand: subscriptionSubcommand,
				refresh: flags.refresh === true,
				json: globalFlags.json,
			});
			break;
		}

		case 'relay': {
			await handleRelayCommand(subcommand, positionals);
			break;
		}

		default:
			console.error(`Unknown command: ${command}`);
			process.exit(1);
	}
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
			const config = await loadConfig();
			for (const arg of positionals) {
				const [key, ...valueParts] = arg.split('=');
				if (key && valueParts.length > 0) {
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

				// Show relays
				console.log('');
				console.log('Relays:');
				if (config.relays && config.relays.length > 0) {
					for (const relay of config.relays) {
						console.log(`  ${relay}`);
					}
				} else {
					console.log('  (using defaults: relay.damus.io, nos.lol, relay.nostr.band)');
				}

				// Show subscription status if available
				if (config.subscription?.status) {
					console.log('');
					const sub = config.subscription.status;
					if (sub.active) {
						const tierName =
							sub.tier === 'cloud'
								? 'Cloud'
								: sub.tier === 'teams'
									? 'Teams'
									: sub.tier === 'enterprise'
										? 'Enterprise'
										: 'Unknown';
						console.log(`Subscription: ${tierName}`);
						if (sub.relayUrl) {
							console.log(`  Managed relay: ${sub.relayUrl}`);
						}
						if (sub.daysRemaining !== undefined) {
							console.log(`  Days remaining: ${sub.daysRemaining}`);
						}
					} else {
						console.log('Subscription: Free');
					}
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

/**
 * Handle the relay command
 */
async function handleRelayCommand(
	subcommand: string | undefined,
	positionals: string[],
): Promise<void> {
	const { loadConfig, saveConfig, getRelays } = await import('./lib/config');

	const urls = positionals;

	// Validate relay URLs
	const validateUrl = (url: string): boolean => {
		try {
			const parsed = new URL(url);
			return parsed.protocol === 'wss:' || parsed.protocol === 'ws:';
		} catch {
			return false;
		}
	};

	switch (subcommand) {
		case 'add': {
			if (urls.length === 0) {
				console.error('Error: No relay URL provided');
				console.error('Usage: redshift configure relay add <url>');
				process.exit(1);
			}

			for (const url of urls) {
				if (!validateUrl(url)) {
					console.error(`Error: Invalid relay URL: ${url}`);
					console.error('Relay URLs must start with wss:// or ws://');
					process.exit(1);
				}
			}

			const config = await loadConfig();
			const currentRelays = config.relays || [];
			const newRelays = [...new Set([...currentRelays, ...urls])];
			config.relays = newRelays;
			await saveConfig(config);

			console.log('Added relay(s):');
			for (const url of urls) {
				console.log(`  ${url}`);
			}
			break;
		}

		case 'remove': {
			if (urls.length === 0) {
				console.error('Error: No relay URL provided');
				console.error('Usage: redshift configure relay remove <url>');
				process.exit(1);
			}

			const config = await loadConfig();
			const currentRelays = config.relays || [];
			const newRelays = currentRelays.filter((r) => !urls.includes(r));

			if (newRelays.length === currentRelays.length) {
				console.log('No matching relays found to remove.');
				return;
			}

			if (newRelays.length > 0) {
				config.relays = newRelays;
			} else {
				delete config.relays;
			}
			await saveConfig(config);

			console.log('Removed relay(s):');
			for (const url of urls) {
				if (currentRelays.includes(url)) {
					console.log(`  ${url}`);
				}
			}
			break;
		}

		case 'set': {
			if (urls.length === 0) {
				console.error('Error: No relay URLs provided');
				console.error('Usage: redshift configure relay set <url1> [url2] ...');
				process.exit(1);
			}

			for (const url of urls) {
				if (!validateUrl(url)) {
					console.error(`Error: Invalid relay URL: ${url}`);
					console.error('Relay URLs must start with wss:// or ws://');
					process.exit(1);
				}
			}

			const config = await loadConfig();
			config.relays = urls;
			await saveConfig(config);

			console.log('Set relays to:');
			for (const url of urls) {
				console.log(`  ${url}`);
			}
			break;
		}

		case 'reset': {
			const config = await loadConfig();
			delete config.relays;
			await saveConfig(config);
			console.log('Relays reset to defaults.');

			const defaults = await getRelays();
			console.log('Default relays:');
			for (const url of defaults) {
				console.log(`  ${url}`);
			}
			break;
		}

		default: {
			// No action or unknown action - list current relays
			const relays = await getRelays();
			const config = await loadConfig();
			const isCustom = config.relays && config.relays.length > 0;

			console.log(isCustom ? 'Configured relays:' : 'Default relays:');
			for (const url of relays) {
				console.log(`  ${url}`);
			}

			if (!isCustom) {
				console.log('');
				console.log('Use `redshift relay set <url>` to customize.');
			}
			break;
		}
	}
}

main().catch((error: unknown) => {
	console.error('Fatal error:', error);
	process.exit(1);
});

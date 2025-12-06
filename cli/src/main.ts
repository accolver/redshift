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

import { loginCommand, logoutCommand } from './commands/login';
import { parseCommand } from './commands/parser';
import { runCommand } from './commands/run';
import { type SecretsSubcommand, secretsCommand } from './commands/secrets';
import { serveCommand } from './commands/serve';
import { setupCommand } from './commands/setup';

const VERSION = '0.1.0';

const HELP_TEXT = `
Redshift - Decentralized Secret Management

Usage: redshift <command> [options]

Commands:
  login              Authenticate with your Nostr identity
  logout             Clear stored credentials
  setup              Configure project and environment for current directory
  run -- <command>   Run a command with secrets injected
  secrets            Manage secrets (list, set, get, delete)
  serve              Start the web administration UI

Options:
  -h, --help         Show this help message
  -v, --version      Show version number

Login Options:
  login                            Interactive login (choose method)
  login --nsec <nsec>              Login with private key directly
  login --bunker <url>             Login via NIP-46 bunker URL
  login --connect                  Generate NostrConnect QR for bunker

Secrets Subcommands:
  secrets list                     List all secrets
  secrets get <KEY>                Get a specific secret
  secrets set <KEY> <VALUE>        Set a secret value
  secrets delete <KEY>             Delete a secret
  secrets download                 Download secrets as .env format
  secrets upload [file]            Upload secrets from .env file (default: .env)

Examples:
  redshift login
  redshift login --bunker bunker://pubkey?relay=wss://relay.example
  redshift setup
  redshift run -- npm start
  redshift secrets set API_KEY sk_live_xxx
  redshift secrets list --raw
  redshift serve --port 3000

Environment Variables:
  REDSHIFT_NSEC        Private key for CI/CD (bypasses login)
  REDSHIFT_BUNKER      Bunker URL for CI/CD (alternative to nsec)
  REDSHIFT_CONFIG_DIR  Override config directory (~/.redshift)

Documentation: https://redshiftapp.com/docs
`;

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const { command, args: cmdArgs, flags } = parseCommand(args);

	switch (command) {
		case 'help':
			console.log(HELP_TEXT);
			break;

		case 'version':
			console.log(`redshift v${VERSION}`);
			break;

		case 'login': {
			const loginOpts: import('./commands/login').LoginOptions = {
				connect: flags.connect === true,
				force: flags.force === true,
			};
			if (typeof flags.nsec === 'string') loginOpts.nsec = flags.nsec;
			if (typeof flags.bunker === 'string') loginOpts.bunker = flags.bunker;
			await loginCommand(loginOpts);
			break;
		}

		case 'logout':
			await logoutCommand();
			break;

		case 'setup': {
			const setupOpts: import('./commands/setup').SetupOptions = {
				force: flags.force === true,
			};
			if (typeof flags.project === 'string') setupOpts.project = flags.project;
			if (typeof flags.environment === 'string') setupOpts.environment = flags.environment;
			await setupCommand(setupOpts);
			break;
		}

		case 'run': {
			if (cmdArgs.length === 0) {
				console.error('Error: No command specified after --');
				console.error('Usage: redshift run -- <command>');
				process.exit(1);
			}
			const runOpts: import('./commands/run').RunOptions = {
				command: cmdArgs,
			};
			if (typeof flags.project === 'string') runOpts.project = flags.project;
			if (typeof flags.environment === 'string') runOpts.environment = flags.environment;
			await runCommand(runOpts);
			break;
		}

		case 'secrets': {
			const subcommand = (cmdArgs[0] as SecretsSubcommand) || 'list';
			const validSubcommands = ['list', 'get', 'set', 'delete', 'download', 'upload'];

			if (!validSubcommands.includes(subcommand)) {
				console.error(`Unknown secrets subcommand: ${subcommand}`);
				console.error(`Available: ${validSubcommands.join(', ')}`);
				process.exit(1);
			}

			const secretsOpts: import('./commands/secrets').SecretsOptions = {
				subcommand,
				raw: flags.raw === true,
			};
			if (cmdArgs[1]) secretsOpts.key = cmdArgs[1];
			if (cmdArgs[2]) secretsOpts.value = cmdArgs[2];
			if (typeof flags.project === 'string') secretsOpts.project = flags.project;
			if (typeof flags.environment === 'string') secretsOpts.environment = flags.environment;
			if (flags.format === 'json' || flags.format === 'env' || flags.format === 'table') {
				secretsOpts.format = flags.format;
			}
			await secretsCommand(secretsOpts);
			break;
		}

		case 'serve': {
			const port =
				typeof flags.port === 'string'
					? Number.parseInt(flags.port, 10)
					: typeof flags.port === 'number'
						? flags.port
						: 3000;

			await serveCommand({
				port,
				host: typeof flags.host === 'string' ? flags.host : '127.0.0.1',
				open: flags.open === true,
			});
			break;
		}

		default:
			console.error(`Unknown command: ${command}`);
			console.log(HELP_TEXT);
			process.exit(1);
	}
}

main().catch((error: unknown) => {
	console.error('Fatal error:', error);
	process.exit(1);
});

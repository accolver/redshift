/**
 * CLI Framework - Doppler-compatible command structure
 *
 * This is the AUTHORITATIVE CLI parser used by main.ts.
 * It supersedes the legacy parser in src/commands/parser.ts.
 *
 * Provides a declarative way to define commands with:
 * - Global flags that apply to all commands
 * - Command-specific flags
 * - Subcommand support with their own flags
 * - Automatic help generation for any command/subcommand
 *
 * L2: Function-Author - CLI framework functions
 * L4: Integration-Contractor - Doppler-compatible interface
 */

import { parseArgs } from 'node:util';

/**
 * Flag definition for CLI parsing
 */
export interface FlagDef {
	type: 'string' | 'boolean';
	short?: string;
	description: string;
	default?: string | boolean;
	/** Example value shown in help (e.g., "dev" for --config) */
	placeholder?: string;
	/** If set, this flag is an alias for another flag (value will be merged) */
	aliasOf?: string;
	/** Hide from help output (useful for aliases) */
	hidden?: boolean;
}

/**
 * Command definition
 */
export interface CommandDef {
	name: string;
	description: string;
	/** Detailed usage examples */
	examples?: string[];
	/** Aliases for the command (e.g., ['whoami'] for 'me') */
	aliases?: string[];
	/** Command-specific flags */
	flags?: Record<string, FlagDef>;
	/** Subcommands */
	subcommands?: Record<string, SubcommandDef>;
	/** Handler function */
	handler?: CommandHandler;
	/** Whether this command accepts positional arguments */
	positionals?: {
		name: string;
		description: string;
		required?: boolean;
		variadic?: boolean;
	}[];
}

/**
 * Subcommand definition
 */
export interface SubcommandDef {
	name: string;
	description: string;
	examples?: string[];
	flags?: Record<string, FlagDef>;
	handler?: CommandHandler;
	positionals?: {
		name: string;
		description: string;
		required?: boolean;
		variadic?: boolean;
	}[];
}

/**
 * Parsed command result
 */
export interface ParsedArgs {
	command: string;
	subcommand?: string | undefined;
	positionals: string[];
	flags: Record<string, string | boolean | undefined>;
	globalFlags: GlobalFlags;
	/** Whether help was requested */
	helpRequested: boolean;
}

/**
 * Global flags available to all commands
 */
export interface GlobalFlags {
	help: boolean;
	version: boolean;
	json: boolean;
	silent: boolean;
	debug: boolean;
	configDir?: string | undefined;
}

/**
 * Command handler function
 */
export type CommandHandler = (args: ParsedArgs) => Promise<void>;

/**
 * Global flags definition
 */
export const GLOBAL_FLAGS: Record<string, FlagDef> = {
	help: {
		type: 'boolean',
		short: 'h',
		description: 'help for redshift',
	},
	version: {
		type: 'boolean',
		short: 'v',
		description: 'Get the version of the Redshift CLI',
	},
	'config-dir': {
		type: 'string',
		description: 'config directory',
		default: '~/.redshift',
		placeholder: 'path',
	},
};

/**
 * CLI class for managing commands and parsing
 */
export class CLI {
	private commands: Map<string, CommandDef> = new Map();
	private aliases: Map<string, string> = new Map();
	public name = 'redshift';
	public description = 'Decentralized Secret Management';
	public version = '0.0.0';

	/**
	 * Register a command
	 */
	registerCommand(cmd: CommandDef): void {
		this.commands.set(cmd.name, cmd);
		if (cmd.aliases) {
			for (const alias of cmd.aliases) {
				this.aliases.set(alias, cmd.name);
			}
		}
	}

	/**
	 * Get a command by name (resolving aliases)
	 */
	getCommand(name: string): CommandDef | undefined {
		const resolvedName = this.aliases.get(name) || name;
		return this.commands.get(resolvedName);
	}

	/**
	 * Get all registered commands
	 */
	getCommands(): CommandDef[] {
		return Array.from(this.commands.values());
	}

	/**
	 * Parse command line arguments
	 */
	parse(argv: string[]): ParsedArgs {
		if (argv[0] === '--config-dir') {
			const configDir = argv[1];
			if (!configDir || configDir.startsWith('-')) {
				throw new Error('Option --config-dir requires a value');
			}
			const parsed = this.parse(argv.slice(2));
			parsed.globalFlags.configDir = configDir;
			return parsed;
		}

		// Handle empty args or global help/version
		if (argv.length === 0) {
			return {
				command: '',
				positionals: [],
				flags: {},
				globalFlags: { help: true, version: false, json: false, silent: false, debug: false },
				helpRequested: true,
			};
		}

		// Check for global flags first
		if (argv[0] === '-h' || argv[0] === '--help' || argv[0] === 'help') {
			// Check if this is `help <command>`
			if (argv[0] === 'help' && argv[1]) {
				const helpTarget = argv[1];
				const helpCommand = this.getCommand(helpTarget);
				if (!helpCommand) {
					throw new Error(`Unknown command: ${helpTarget}`);
				}
				const helpSubcommand = argv[2];
				if (helpSubcommand && !helpCommand.subcommands?.[helpSubcommand]) {
					throw new Error(`Unknown subcommand "${helpSubcommand}" for ${helpCommand.name}`);
				}
				return {
					command: helpCommand.name,
					subcommand: helpSubcommand,
					positionals: [],
					flags: {},
					globalFlags: { help: true, version: false, json: false, silent: false, debug: false },
					helpRequested: true,
				};
			}
			return {
				command: '',
				positionals: [],
				flags: {},
				globalFlags: { help: true, version: false, json: false, silent: false, debug: false },
				helpRequested: true,
			};
		}

		if (argv[0] === '-v' || argv[0] === '--version') {
			return {
				command: '',
				positionals: [],
				flags: {},
				globalFlags: { help: false, version: true, json: false, silent: false, debug: false },
				helpRequested: false,
			};
		}

		// Get command name (resolve aliases)
		const inputCommand = argv[0]!;
		const resolvedName = this.aliases.get(inputCommand) || inputCommand;
		const cmd = this.commands.get(resolvedName);

		if (!cmd) {
			// Unknown command - return with the command name for error handling
			return {
				command: inputCommand,
				positionals: [],
				flags: {},
				globalFlags: { help: false, version: false, json: false, silent: false, debug: false },
				helpRequested: false,
			};
		}

		const commandName = resolvedName;

		// Check if second arg is a subcommand
		const restArgs = argv.slice(1);
		let subcommand: SubcommandDef | undefined;
		let argsToProcess = restArgs;

		if (cmd.subcommands && restArgs[0] && !restArgs[0].startsWith('-')) {
			const subCmd = cmd.subcommands[restArgs[0]];
			if (!subCmd) {
				throw new Error(`Unknown subcommand "${restArgs[0]}" for ${commandName}`);
			}
			subcommand = subCmd;
			argsToProcess = restArgs.slice(1);
		}

		// A child --help after `run --` belongs to the child, not Redshift.
		const childBoundary = commandName === 'run' ? argsToProcess.indexOf('--') : -1;
		const helpArgs = childBoundary >= 0 ? argsToProcess.slice(0, childBoundary) : argsToProcess;
		if (helpArgs.includes('-h') || helpArgs.includes('--help')) {
			return {
				command: commandName,
				subcommand: subcommand?.name,
				positionals: [],
				flags: {},
				globalFlags: { help: true, version: false, json: false, silent: false, debug: false },
				helpRequested: true,
			};
		}

		// Build options for parseArgs
		const options: Record<string, { type: 'string' | 'boolean'; short?: string }> = {};
		// Collect all flag definitions for alias resolution
		const allFlagDefs: Record<string, FlagDef> = {};

		// Helper to add flag definition
		const addFlag = (name: string, def: FlagDef) => {
			const opt: { type: 'string' | 'boolean'; short?: string } = { type: def.type };
			if (def.short) {
				opt.short = def.short;
			}
			options[name] = opt;
			allFlagDefs[name] = def;
		};

		// Add global flags
		for (const [name, def] of Object.entries(GLOBAL_FLAGS)) {
			addFlag(name, def);
		}

		// Add command flags
		if (cmd.flags) {
			for (const [name, def] of Object.entries(cmd.flags)) {
				addFlag(name, def);
			}
		}

		// Add subcommand flags
		if (subcommand?.flags) {
			for (const [name, def] of Object.entries(subcommand.flags)) {
				addFlag(name, def);
			}
		}

		// Special handling for 'run' command - everything after '--' is the command
		if (commandName === 'run') {
			const dashDashIndex = argsToProcess.indexOf('--');
			if (dashDashIndex !== -1) {
				const flagArgs = argsToProcess.slice(0, dashDashIndex);
				const commandArgs = argsToProcess.slice(dashDashIndex + 1);

				const { values, positionals } = parseArgs({
					args: flagArgs,
					options,
					allowPositionals: true,
					strict: true,
				});

				const globalFlags = extractGlobalFlags(values);
				const rawFlags = extractCommandFlags(values, GLOBAL_FLAGS);
				const flags = resolveFlagAliases(rawFlags, allFlagDefs);

				return {
					command: commandName,
					positionals: [...positionals, ...commandArgs],
					flags,
					globalFlags,
					helpRequested: false,
				};
			}
		}

		const { values, positionals } = parseArgs({
			args: argsToProcess,
			options,
			allowPositionals: true,
			strict: true,
		});
		validatePositionals(commandName, subcommand?.positionals ?? cmd.positionals, positionals);

		const globalFlags = extractGlobalFlags(values);
		const rawFlags = extractCommandFlags(values, GLOBAL_FLAGS);
		const flags = resolveFlagAliases(rawFlags, allFlagDefs);

		return {
			command: commandName,
			subcommand: subcommand?.name,
			positionals,
			flags,
			globalFlags,
			helpRequested: globalFlags.help,
		};
	}

	/**
	 * Generate help text for the main CLI
	 */
	generateMainHelp(): string {
		const lines: string[] = [];

		lines.push(`${this.description}`);
		lines.push('');
		lines.push('Usage:');
		lines.push(`  ${this.name} [flags]`);
		lines.push(`  ${this.name} [command]`);
		lines.push('');
		lines.push('Available Commands:');

		// Get max command name length for alignment
		const commands = this.getCommands();
		const maxLen = Math.max(...commands.map((c) => c.name.length));

		for (const cmd of commands.sort((a, b) => a.name.localeCompare(b.name))) {
			lines.push(`  ${cmd.name.padEnd(maxLen + 2)}${cmd.description}`);
		}

		lines.push('');
		lines.push('Flags:');
		lines.push(formatFlags(GLOBAL_FLAGS));

		lines.push('');
		lines.push(`Use "${this.name} [command] --help" for more information about a command.`);

		return lines.join('\n');
	}

	/**
	 * Generate help text for a specific command
	 */
	generateCommandHelp(cmdName: string, subCmdName?: string): string {
		const cmd = this.getCommand(cmdName);
		if (!cmd) {
			return `Unknown command: ${cmdName}`;
		}

		// If subcommand specified, generate subcommand help
		if (subCmdName && cmd.subcommands) {
			const subCmd = cmd.subcommands[subCmdName];
			if (subCmd) {
				return this.generateSubcommandHelp(cmd, subCmd);
			}
		}

		const lines: string[] = [];

		lines.push(cmd.description);
		lines.push('');
		lines.push('Usage:');

		if (cmd.subcommands && Object.keys(cmd.subcommands).length > 0) {
			lines.push(`  ${this.name} ${cmd.name} [flags]`);
			lines.push(`  ${this.name} ${cmd.name} [command]`);
		} else if (cmd.positionals && cmd.positionals.length > 0) {
			const posStr = cmd.positionals
				.map((p) => (p.variadic ? `[${p.name}...]` : p.required ? `<${p.name}>` : `[${p.name}]`))
				.join(' ');
			lines.push(`  ${this.name} ${cmd.name} ${posStr} [flags]`);
		} else {
			lines.push(`  ${this.name} ${cmd.name} [flags]`);
		}

		// Show subcommands
		if (cmd.subcommands && Object.keys(cmd.subcommands).length > 0) {
			lines.push('');
			lines.push('Available Commands:');
			const subCmds = Object.values(cmd.subcommands);
			const maxLen = Math.max(...subCmds.map((s) => s.name.length));
			for (const sub of subCmds.sort((a, b) => a.name.localeCompare(b.name))) {
				lines.push(`  ${sub.name.padEnd(maxLen + 2)}${sub.description}`);
			}
		}

		// Show examples
		if (cmd.examples && cmd.examples.length > 0) {
			lines.push('');
			lines.push('Examples:');
			for (const ex of cmd.examples) {
				lines.push(`  ${ex}`);
			}
		}

		// Show command flags
		if (cmd.flags && Object.keys(cmd.flags).length > 0) {
			lines.push('');
			lines.push('Flags:');
			lines.push(formatFlags(cmd.flags));
		}

		// Show global flags
		lines.push('');
		lines.push('Global Flags:');
		lines.push(formatFlags(GLOBAL_FLAGS));

		if (cmd.subcommands && Object.keys(cmd.subcommands).length > 0) {
			lines.push('');
			lines.push(
				`Use "${this.name} ${cmd.name} [command] --help" for more information about a command.`,
			);
		}

		return lines.join('\n');
	}

	/**
	 * Generate help text for a subcommand
	 */
	private generateSubcommandHelp(cmd: CommandDef, subCmd: SubcommandDef): string {
		const lines: string[] = [];

		lines.push(subCmd.description);
		lines.push('');
		lines.push('Usage:');

		if (subCmd.positionals && subCmd.positionals.length > 0) {
			const posStr = subCmd.positionals
				.map((p) => (p.variadic ? `[${p.name}...]` : p.required ? `<${p.name}>` : `[${p.name}]`))
				.join(' ');
			lines.push(`  ${this.name} ${cmd.name} ${subCmd.name} ${posStr} [flags]`);
		} else {
			lines.push(`  ${this.name} ${cmd.name} ${subCmd.name} [flags]`);
		}

		// Show examples
		if (subCmd.examples && subCmd.examples.length > 0) {
			lines.push('');
			lines.push('Examples:');
			for (const ex of subCmd.examples) {
				lines.push(`  ${ex}`);
			}
		}

		// Show subcommand flags
		if (subCmd.flags && Object.keys(subCmd.flags).length > 0) {
			lines.push('');
			lines.push('Flags:');
			lines.push(formatFlags(subCmd.flags));
		}

		// Show command flags (inherited)
		if (cmd.flags && Object.keys(cmd.flags).length > 0) {
			lines.push('');
			lines.push('Inherited Flags:');
			lines.push(formatFlags(cmd.flags));
		}

		// Show global flags
		lines.push('');
		lines.push('Global Flags:');
		lines.push(formatFlags(GLOBAL_FLAGS));

		return lines.join('\n');
	}
}

/**
 * Extract global flags from parsed values
 */
function validatePositionals(
	commandName: string,
	definitions: CommandDef['positionals'],
	positionals: string[],
): void {
	if (!definitions || definitions.length === 0) {
		if (positionals.length > 0) {
			throw new Error(`Unexpected positional argument "${positionals[0]}" for ${commandName}`);
		}
		return;
	}

	const required = definitions.filter((definition) => definition.required).length;
	if (positionals.length < required) {
		throw new Error(`Missing required positional argument for ${commandName}`);
	}
	if (
		!definitions.some((definition) => definition.variadic) &&
		positionals.length > definitions.length
	) {
		throw new Error(`Too many positional arguments for ${commandName}`);
	}
}

function extractGlobalFlags(values: Record<string, string | boolean | undefined>): GlobalFlags {
	return {
		help: values.help === true,
		version: values.version === true,
		json: values.json === true,
		silent: values.silent === true,
		debug: values.debug === true,
		configDir: typeof values['config-dir'] === 'string' ? values['config-dir'] : undefined,
	};
}

/**
 * Extract command-specific flags (excluding global flags)
 */
function extractCommandFlags(
	values: Record<string, string | boolean | undefined>,
	globalFlagDefs: Record<string, FlagDef>,
): Record<string, string | boolean | undefined> {
	const result: Record<string, string | boolean | undefined> = {};
	for (const [key, value] of Object.entries(values)) {
		if (!(key in globalFlagDefs)) {
			result[key] = value;
		}
	}
	return result;
}

/**
 * Resolve flag aliases - merge aliased flag values into their primary flags
 */
function resolveFlagAliases(
	flags: Record<string, string | boolean | undefined>,
	flagDefs: Record<string, FlagDef>,
): Record<string, string | boolean | undefined> {
	const result = { ...flags };

	for (const [name, def] of Object.entries(flagDefs)) {
		if (def.aliasOf && result[name] !== undefined) {
			// If alias has a value and primary doesn't, copy it over
			if (result[def.aliasOf] === undefined) {
				result[def.aliasOf] = result[name];
			}
			// Remove the alias from results
			delete result[name];
		}
	}

	return result;
}

/**
 * Format flags for help output
 */
function formatFlags(flags: Record<string, FlagDef>): string {
	const lines: string[] = [];
	const entries = Object.entries(flags);

	// Calculate max width for alignment
	let maxFlagWidth = 0;
	const formattedEntries: Array<{ flagStr: string; desc: string }> = [];

	for (const [name, def] of entries) {
		// Skip hidden flags (typically aliases)
		if (def.hidden) {
			continue;
		}

		let flagStr = '      ';
		if (def.short) {
			flagStr = `  -${def.short}, `;
		}

		if (def.type === 'string') {
			const placeholder = def.placeholder || 'string';
			flagStr += `--${name} ${placeholder}`;
		} else {
			flagStr += `--${name}`;
		}

		let desc = def.description;
		if (def.default !== undefined) {
			desc += ` (default "${def.default}")`;
		}

		maxFlagWidth = Math.max(maxFlagWidth, flagStr.length);
		formattedEntries.push({ flagStr, desc });
	}

	for (const { flagStr, desc } of formattedEntries) {
		lines.push(`${flagStr.padEnd(maxFlagWidth + 2)}${desc}`);
	}

	return lines.join('\n');
}

/**
 * Create and configure the CLI instance with all commands
 */
export function createCLI(version: string): CLI {
	const cli = new CLI();
	cli.version = version;

	// Register all commands
	cli.registerCommand(createLoginCommand());
	cli.registerCommand(createLogoutCommand());
	cli.registerCommand(createSetupCommand());
	cli.registerCommand(createRunCommand());
	cli.registerCommand(createSecretsCommand());
	cli.registerCommand(createBackupCommand());
	cli.registerCommand(createHistoryCommand());
	cli.registerCommand(createRecoveryCommand());
	cli.registerCommand(createServeCommand());
	cli.registerCommand(createBunkerCommand());
	cli.registerCommand(createConfigureCommand());
	cli.registerCommand(createMeCommand());
	cli.registerCommand(createUpgradeCommand());

	return cli;
}

// ============================================================================
// Command Definitions
// ============================================================================

function createLoginCommand(): CommandDef {
	return {
		name: 'login',
		description: 'Authenticate to Redshift',
		examples: [
			'redshift login',
			'redshift login --nsec nsec1...',
			'redshift login --bunker "bunker://pubkey?relay=wss://relay.example"',
			'redshift login --connect',
		],
		flags: {
			nsec: {
				type: 'string',
				description: 'Nostr private key (nsec1...)',
				placeholder: 'nsec',
			},
			bunker: {
				type: 'string',
				short: 'b',
				description: 'secret-free NIP-46 bunker pointer (pairing secrets are rejected)',
				placeholder: 'url',
			},
			'bunker-stdin': {
				type: 'boolean',
				description: 'read a NIP-46 bunker URL from hidden stdin',
			},
			connect: {
				type: 'boolean',
				short: 'c',
				description: 'Generate NostrConnect QR for bunker',
			},
			overwrite: {
				type: 'boolean',
				description: 'overwrite existing token if one exists',
			},
			force: {
				type: 'boolean',
				description: 'alias for --overwrite',
				aliasOf: 'overwrite',
			},
		},
		subcommands: {
			revoke: {
				name: 'revoke',
				description: 'Revoke stored authentication immediately',
			},
		},
	};
}

function createBunkerCommand(): CommandDef {
	return {
		name: 'bunker',
		description: 'Run a local NIP-46 bunker prototype',
		examples: [
			'redshift bunker start --insecure-plaintext-keys',
			'redshift bunker start --insecure-plaintext-keys --relay wss://relay.damus.io,wss://nos.lol',
			'redshift bunker status',
		],
		flags: {
			relay: {
				type: 'string',
				description: 'Comma-separated relay URLs for NIP-46 communication',
				placeholder: 'urls',
			},
			'insecure-plaintext-keys': {
				type: 'boolean',
				description: 'Acknowledge prototype local keys will be stored in a 0600 plaintext file',
			},
		},
		subcommands: {
			start: {
				name: 'start',
				description: 'Start the local bunker prototype',
				flags: {
					relay: {
						type: 'string',
						description: 'Comma-separated relay URLs for NIP-46 communication',
						placeholder: 'urls',
					},
					'insecure-plaintext-keys': {
						type: 'boolean',
						description: 'Acknowledge prototype local keys will be stored in a 0600 plaintext file',
					},
				},
			},
			status: {
				name: 'status',
				description: 'Show local bunker prototype status and connection URI',
				flags: {
					relay: {
						type: 'string',
						description: 'Override comma-separated relay URLs in displayed connection URI',
						placeholder: 'urls',
					},
				},
			},
		},
	};
}

function createLogoutCommand(): CommandDef {
	return {
		name: 'logout',
		description: 'Remove stored authentication immediately',
		examples: ['redshift logout'],
	};
}

function createSetupCommand(): CommandDef {
	return {
		name: 'setup',
		description: 'Setup the Redshift CLI for managing secrets',
		examples: ['redshift setup', 'redshift setup --project backend --config dev'],
		flags: {
			project: {
				type: 'string',
				short: 'p',
				description: 'project (e.g. backend)',
				placeholder: 'name',
			},
			config: {
				type: 'string',
				short: 'c',
				description: 'config/environment (e.g. dev)',
				placeholder: 'name',
			},
			environment: {
				type: 'string',
				short: 'e',
				description: 'alias for --config',
				placeholder: 'name',
				aliasOf: 'config',
				hidden: true,
			},
			force: {
				type: 'boolean',
				short: 'f',
				description: 'overwrite an existing redshift.yaml',
			},
			'no-interactive': {
				type: 'boolean',
				description: 'do not prompt; fail if project or environment cannot be resolved',
			},
		},
	};
}

function createRunCommand(): CommandDef {
	return {
		name: 'run',
		description: 'Run a command with secrets injected into the environment',
		examples: [
			'redshift run -- YOUR_COMMAND --YOUR-FLAG',
			'redshift run --command "YOUR_COMMAND && YOUR_OTHER_COMMAND"',
			'redshift run --preserve-env PATH,HOME -- npm start',
		],
		flags: {
			command: {
				type: 'string',
				description: 'command to execute (e.g. "echo hi")',
				placeholder: 'cmd',
			},
			project: {
				type: 'string',
				short: 'p',
				description: 'project (e.g. backend)',
				placeholder: 'name',
			},
			config: {
				type: 'string',
				short: 'c',
				description: 'config/environment (e.g. dev)',
				placeholder: 'name',
			},
			environment: {
				type: 'string',
				short: 'e',
				description: 'alias for --config',
				placeholder: 'name',
				aliasOf: 'config',
				hidden: true,
			},
			'preserve-env': {
				type: 'string',
				description:
					'comma separated list of secrets for which the existing env value takes precedence',
				placeholder: 'list',
			},
		},
		positionals: [
			{
				name: 'command',
				description: 'Command to run (after --)',
				variadic: true,
			},
		],
	};
}

function createBackupCommand(): CommandDef {
	const filePosition = [
		{
			name: 'file',
			description: 'encrypted Redshift backup archive path',
			required: true,
		},
	];
	const passphraseStdin = {
		type: 'boolean' as const,
		description: 'read exact passphrase line(s) from stdin instead of prompting',
	};
	return {
		name: 'backup',
		description: 'Create or restore a passphrase-encrypted local snapshot',
		examples: [
			'redshift backup create secrets.redshift',
			'redshift backup restore secrets.redshift',
			'redshift backup restore secrets.redshift --allow-identity-change',
		],
		subcommands: {
			create: {
				name: 'create',
				description: 'Create an encrypted snapshot of current observed secret state',
				positionals: filePosition,
				flags: {
					force: {
						type: 'boolean',
						description: 'atomically replace an existing regular archive',
					},
					'passphrase-stdin': passphraseStdin,
				},
			},
			restore: {
				name: 'restore',
				description: 'Restore encrypted state under the authenticated signer',
				positionals: filePosition,
				flags: {
					overwrite: {
						type: 'boolean',
						description: 'replace conflicting destination bundles without merging',
					},
					'allow-identity-change': {
						type: 'boolean',
						description: 'authorize migration to a different authenticated signer',
					},
					'passphrase-stdin': passphraseStdin,
				},
			},
		},
	};
}

function createHistoryCommand(): CommandDef {
	const commonFlags: Record<string, FlagDef> = {
		project: {
			type: 'string',
			short: 'p',
			description: 'project (e.g. backend)',
			placeholder: 'name',
		},
		config: {
			type: 'string',
			short: 'c',
			description: 'config/environment (e.g. dev)',
			placeholder: 'name',
		},
		environment: {
			type: 'string',
			short: 'e',
			description: 'alias for --config',
			placeholder: 'name',
			aliasOf: 'config',
			hidden: true,
		},
		json: {
			type: 'boolean',
			description: 'output machine-readable metadata without secret values',
		},
	};
	const eventIdPosition = {
		name: 'event-id',
		description: '64-character authenticated outer event ID',
		required: true,
	};
	return {
		name: 'history',
		description: 'Inspect, compare, and restore bounded authenticated secret history',
		examples: [
			'redshift history list --project backend --config prod',
			'redshift history compare <from-event-id> <to-event-id>',
			'redshift history restore <event-id> --yes',
		],
		flags: commonFlags,
		subcommands: {
			list: {
				name: 'list',
				description: 'List metadata for bounded owner-authenticated observed versions',
				flags: {
					limit: {
						type: 'string',
						description: 'versions per page (1-100)',
						placeholder: 'count',
					},
					cursor: {
						type: 'string',
						description: 'exact opaque cursor from a previous page',
						placeholder: 'cursor',
					},
				},
				positionals: [],
			},
			compare: {
				name: 'compare',
				description: 'Compare key metadata for two authenticated versions',
				positionals: [
					{ ...eventIdPosition, name: 'from-event-id' },
					{ ...eventIdPosition, name: 'to-event-id' },
				],
			},
			restore: {
				name: 'restore',
				description: 'Publish a selected historical bundle as a new authorized version',
				positionals: [eventIdPosition],
				flags: {
					yes: {
						type: 'boolean',
						description: 'confirm complete-bundle replacement or logical deletion',
					},
					'overwrite-current': {
						type: 'boolean',
						description: 'proceed if current changed during immediate restore preflight',
					},
				},
			},
		},
	};
}

function createRecoveryCommand(): CommandDef {
	const eventIdPosition = [
		{
			name: 'event-id',
			description: '64-character pending publication event ID',
			required: true,
		},
	];
	return {
		name: 'recovery',
		description: 'Inspect and retry incomplete relay publications',
		examples: [
			'redshift recovery list',
			'redshift recovery show <event-id>',
			'redshift recovery retry <event-id>',
			'redshift recovery remove <event-id>',
		],
		subcommands: {
			list: {
				name: 'list',
				description: 'List incomplete relay publications',
			},
			show: {
				name: 'show',
				description: 'Show classified per-relay publication outcomes',
				positionals: eventIdPosition,
			},
			retry: {
				name: 'retry',
				description: 'Retry the exact signed event only to unavailable relays',
				positionals: eventIdPosition,
			},
			remove: {
				name: 'remove',
				description: 'Remove only the local recovery record',
				positionals: eventIdPosition,
			},
		},
	};
}

function createSecretsCommand(): CommandDef {
	return {
		name: 'secrets',
		description: 'Manage secrets',
		examples: [
			'redshift secrets',
			'redshift secrets --raw',
			'redshift secrets get API_KEY --raw',
			'redshift secrets set API_KEY sk_live_xxx',
		],
		flags: {
			json: {
				type: 'boolean',
				description: 'output machine-readable JSON',
			},
			project: {
				type: 'string',
				short: 'p',
				description: 'project (e.g. backend)',
				placeholder: 'name',
			},
			config: {
				type: 'string',
				short: 'c',
				description: 'config/environment (e.g. dev)',
				placeholder: 'name',
			},
			environment: {
				type: 'string',
				short: 'e',
				description: 'alias for --config',
				placeholder: 'name',
				aliasOf: 'config',
				hidden: true,
			},
			raw: {
				type: 'boolean',
				description: 'reveal exact plaintext values (unsafe for logs)',
			},
		},
		subcommands: {
			get: {
				name: 'get',
				description: 'Get the value of one secret',
				examples: ['redshift secrets get API_KEY', 'redshift secrets get API_KEY --raw'],
				positionals: [
					{
						name: 'secret',
						description: 'Secret name to retrieve',
					},
				],
			},
			set: {
				name: 'set',
				description: 'Set the value of one secret',
				examples: ["redshift secrets set API_KEY '123'", "redshift secrets set API_KEY='123'"],
				positionals: [
					{
						name: 'secret',
						description: 'Secret name or KEY=value assignment',
					},
					{
						name: 'value',
						description: 'Secret value when the first argument is a key',
						required: false,
					},
				],
			},
			delete: {
				name: 'delete',
				description: 'Delete one secret immediately',
				examples: ['redshift secrets delete API_KEY'],
				positionals: [
					{
						name: 'secret',
						description: 'Secret name to delete',
					},
				],
			},
			download: {
				name: 'download',
				description: "Download a config's secrets for later use",
				examples: [
					'redshift secrets download --raw /root/secrets.env',
					'redshift secrets download --raw',
				],
				positionals: [
					{
						name: 'filepath',
						description: 'Path to save secrets',
						required: false,
					},
				],
			},
			upload: {
				name: 'upload',
				description: 'Upload a secrets file',
				examples: ['redshift secrets upload secrets.env'],
				positionals: [
					{
						name: 'filepath',
						description: 'Path to secrets file (default: .env)',
					},
				],
			},
		},
	};
}

function createServeCommand(): CommandDef {
	return {
		name: 'serve',
		description: 'Start the web administration UI',
		examples: [
			'redshift serve',
			'redshift serve --port 8080',
			'redshift serve --host 0.0.0.0 --open',
		],
		flags: {
			port: {
				type: 'string',
				short: 'p',
				description: 'port to listen on',
				default: '3000',
				placeholder: 'port',
			},
			host: {
				type: 'string',
				short: 'H',
				description: 'host to bind to',
				default: '127.0.0.1',
				placeholder: 'host',
			},
			open: {
				type: 'boolean',
				short: 'o',
				description: 'open browser automatically',
			},
		},
	};
}

function createConfigureCommand(): CommandDef {
	return {
		name: 'configure',
		description: 'View the config file',
		examples: [
			'redshift configure',
			'redshift configure --all',
			'redshift configure relays',
			'redshift configure set relays=\'["wss://relay.example"]\'',
		],
		flags: {
			all: {
				type: 'boolean',
				description: 'print all saved options',
			},
		},
		subcommands: {
			relays: {
				name: 'relays',
				description: 'Show active relay URLs and how to modify them',
			},
			get: {
				name: 'get',
				description: 'Get the value of one or more options in the config file',
				positionals: [
					{
						name: 'options',
						description: 'Option names to get',
						variadic: true,
					},
				],
			},
			set: {
				name: 'set',
				description: 'Set the value of one or more options in the config file',
				positionals: [
					{
						name: 'options',
						description: 'Options to set (key=value)',
						variadic: true,
					},
				],
			},
			unset: {
				name: 'unset',
				description: 'Unset the value of one or more options in the config file',
				positionals: [
					{
						name: 'options',
						description: 'Option names to unset',
						variadic: true,
					},
				],
			},
			reset: {
				name: 'reset',
				description: 'Reset local CLI configuration to a clean initial state',
				flags: {
					yes: {
						type: 'boolean',
						short: 'y',
						description: 'proceed without confirmation',
					},
				},
			},
		},
	};
}

function createMeCommand(): CommandDef {
	return {
		name: 'me',
		description: 'Get info about the currently authenticated entity',
		aliases: ['whoami'],
		examples: ['redshift me', 'redshift me --json', 'redshift whoami'],
		flags: {
			json: {
				type: 'boolean',
				description: 'output machine-readable JSON',
			},
		},
	};
}

function createUpgradeCommand(): CommandDef {
	return {
		name: 'upgrade',
		description: 'Update the Redshift CLI',
		aliases: ['update'],
		examples: ['redshift upgrade', 'redshift upgrade --force', 'redshift upgrade --tag v0.3.0'],
		flags: {
			force: {
				type: 'boolean',
				short: 'f',
				description: "install the latest CLI regardless of whether there's an update available",
			},
			tag: {
				type: 'string',
				short: 't',
				description: 'install a specific version (e.g., v0.2.0)',
				placeholder: 'version',
			},
		},
	};
}

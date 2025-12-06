/**
 * CLI argument parser for Redshift
 * Uses Bun's native util.parseArgs
 *
 * L2: Function-Author - CLI parsing functions
 * L4: Integration-Contractor - Doppler-compatible command interface
 */

import { parseArgs } from 'node:util';
import type { CommandName, ParsedCommand, SecretBundle } from '../lib/types';

/**
 * Parse command line arguments into a structured command.
 *
 * @param argv - Command line arguments (without 'bun' and script name)
 * @returns Parsed command with name, args, and flags
 */
export function parseCommand(argv: string[]): ParsedCommand {
	// Handle global flags first
	if (argv.length === 0 || argv[0] === '-h' || argv[0] === '--help' || argv[0] === 'help') {
		return { command: 'help', args: [], flags: {} };
	}

	if (argv[0] === '-v' || argv[0] === '--version' || argv[0] === 'version') {
		return { command: 'version', args: [], flags: {} };
	}

	const command = argv[0] as CommandName;
	const restArgs = argv.slice(1);

	// Handle 'run' command specially - everything after '--' is the command to execute
	if (command === 'run') {
		const dashDashIndex = restArgs.indexOf('--');
		if (dashDashIndex !== -1) {
			const flagArgs = restArgs.slice(0, dashDashIndex);
			const commandArgs = restArgs.slice(dashDashIndex + 1);

			const { values } = parseArgs({
				args: flagArgs,
				options: {
					env: { type: 'string', short: 'e' },
					fallback: { type: 'boolean', short: 'f' },
					timeout: { type: 'string', short: 't' },
				},
				allowPositionals: true,
			});

			return {
				command: 'run',
				args: commandArgs,
				flags: values as Record<string, string | boolean>,
			};
		}
	}

	// Handle 'secrets' subcommands
	if (command === 'secrets') {
		const subcommand = restArgs[0]; // 'set', 'get', 'list', etc.

		if (subcommand === 'set') {
			const key = restArgs[1];
			const value = restArgs[2];
			const { values } = parseArgs({
				args: restArgs.slice(3),
				options: {
					env: { type: 'string', short: 'e' },
					json: { type: 'boolean', short: 'j' },
				},
				allowPositionals: false,
			});

			return {
				command: 'secrets',
				args: ['set', key ?? '', value ?? ''],
				flags: values as Record<string, string | boolean>,
			};
		}

		// Default secrets command (list, get, delete, download, upload)
		const { values, positionals } = parseArgs({
			args: restArgs.slice(1),
			options: {
				env: { type: 'string', short: 'e' },
				environment: { type: 'string' },
				project: { type: 'string', short: 'p' },
				format: { type: 'string', short: 'f' },
				raw: { type: 'boolean', short: 'r' },
			},
			allowPositionals: true,
		});

		return {
			command: 'secrets',
			args: [subcommand ?? 'list', ...positionals],
			flags: values as Record<string, string | boolean>,
		};
	}

	// Handle 'serve' command
	if (command === 'serve') {
		const { values } = parseArgs({
			args: restArgs,
			options: {
				port: { type: 'string', short: 'p' },
				host: { type: 'string', short: 'h' },
				open: { type: 'boolean', short: 'o' },
			},
			allowPositionals: false,
		});

		return {
			command: 'serve',
			args: [],
			flags: values as Record<string, string | boolean>,
		};
	}

	// Handle 'login' command
	if (command === 'login') {
		const { values } = parseArgs({
			args: restArgs,
			options: {
				nsec: { type: 'string' },
				bunker: { type: 'string', short: 'b' },
				connect: { type: 'boolean', short: 'c' },
				force: { type: 'boolean', short: 'f' },
			},
			allowPositionals: false,
		});

		return {
			command: 'login',
			args: [],
			flags: values as Record<string, string | boolean>,
		};
	}

	// Handle 'logout' command
	if (command === 'logout') {
		return {
			command: 'logout' as CommandName,
			args: [],
			flags: {},
		};
	}

	// Handle 'setup' command
	if (command === 'setup') {
		const { values } = parseArgs({
			args: restArgs,
			options: {
				project: { type: 'string', short: 'p' },
				env: { type: 'string', short: 'e' },
				yes: { type: 'boolean', short: 'y' },
			},
			allowPositionals: false,
		});

		return {
			command: 'setup',
			args: [],
			flags: values as Record<string, string | boolean>,
		};
	}

	// Default: help or version
	return {
		command: command as CommandName,
		args: restArgs,
		flags: {},
	};
}

/**
 * Format secrets for display (with values masked).
 *
 * @param secrets - The secrets to format
 * @param showValues - Whether to show actual values (default: false)
 * @returns Formatted string for display
 */
export function formatSecrets(secrets: SecretBundle, showValues = false): string {
	const lines: string[] = [];

	for (const [key, value] of Object.entries(secrets)) {
		if (showValues) {
			const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
			lines.push(`${key}=${displayValue}`);
		} else {
			// Mask the value
			const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
			const masked = valueStr.length > 4 ? `${valueStr.slice(0, 2)}${'*'.repeat(6)}` : '****';
			lines.push(`${key}=${masked}`);
		}
	}

	return lines.join('\n');
}

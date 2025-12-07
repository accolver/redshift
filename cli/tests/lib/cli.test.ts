/**
 * CLI Framework Tests - TDD Phase
 *
 * L2: Function-Author - Tests written before implementation
 * L4: Integration-Contractor - Doppler-compatible CLI interface
 */

import { describe, expect, it, beforeEach } from 'bun:test';
import { CLI, createCLI, type CommandDef, type ParsedArgs } from '../../src/lib/cli';

describe('CLI Framework', () => {
	let cli: CLI;

	beforeEach(() => {
		cli = createCLI('1.0.0');
	});

	describe('parse() - global flags', () => {
		it('returns help when no args provided', () => {
			const result = cli.parse([]);

			expect(result.helpRequested).toBe(true);
			expect(result.globalFlags.help).toBe(true);
		});

		it('parses --help flag', () => {
			const result = cli.parse(['--help']);

			expect(result.helpRequested).toBe(true);
			expect(result.globalFlags.help).toBe(true);
		});

		it('parses -h flag', () => {
			const result = cli.parse(['-h']);

			expect(result.helpRequested).toBe(true);
			expect(result.globalFlags.help).toBe(true);
		});

		it('parses help command', () => {
			const result = cli.parse(['help']);

			expect(result.helpRequested).toBe(true);
		});

		it('parses help <command>', () => {
			const result = cli.parse(['help', 'secrets']);

			expect(result.helpRequested).toBe(true);
			expect(result.command).toBe('secrets');
		});

		it('parses help <command> <subcommand>', () => {
			const result = cli.parse(['help', 'secrets', 'get']);

			expect(result.helpRequested).toBe(true);
			expect(result.command).toBe('secrets');
			expect(result.subcommand).toBe('get');
		});

		it('parses --version flag', () => {
			const result = cli.parse(['--version']);

			expect(result.globalFlags.version).toBe(true);
		});

		it('parses -v flag', () => {
			const result = cli.parse(['-v']);

			expect(result.globalFlags.version).toBe(true);
		});

		it('parses --json flag', () => {
			const result = cli.parse(['secrets', '--json']);

			expect(result.command).toBe('secrets');
			expect(result.globalFlags.json).toBe(true);
		});

		it('parses --silent flag', () => {
			const result = cli.parse(['run', '--silent', '--', 'echo', 'hi']);

			expect(result.globalFlags.silent).toBe(true);
		});

		it('parses --debug flag', () => {
			const result = cli.parse(['login', '--debug']);

			expect(result.globalFlags.debug).toBe(true);
		});

		it('parses --config-dir flag', () => {
			const result = cli.parse(['secrets', '--config-dir', '/custom/path']);

			expect(result.globalFlags.configDir).toBe('/custom/path');
		});
	});

	describe('parse() - command help', () => {
		it('parses <command> --help', () => {
			const result = cli.parse(['secrets', '--help']);

			expect(result.command).toBe('secrets');
			expect(result.helpRequested).toBe(true);
		});

		it('parses <command> -h', () => {
			const result = cli.parse(['run', '-h']);

			expect(result.command).toBe('run');
			expect(result.helpRequested).toBe(true);
		});

		it('parses <command> <subcommand> --help', () => {
			const result = cli.parse(['secrets', 'get', '--help']);

			expect(result.command).toBe('secrets');
			expect(result.subcommand).toBe('get');
			expect(result.helpRequested).toBe(true);
		});
	});

	describe('parse() - secrets command', () => {
		it('parses secrets with no args (list)', () => {
			const result = cli.parse(['secrets']);

			expect(result.command).toBe('secrets');
			expect(result.subcommand).toBeUndefined();
		});

		it('parses secrets get <key>', () => {
			const result = cli.parse(['secrets', 'get', 'API_KEY']);

			expect(result.command).toBe('secrets');
			expect(result.subcommand).toBe('get');
			expect(result.positionals).toEqual(['API_KEY']);
		});

		it('parses secrets get multiple keys', () => {
			const result = cli.parse(['secrets', 'get', 'API_KEY', 'CRYPTO_KEY']);

			expect(result.command).toBe('secrets');
			expect(result.subcommand).toBe('get');
			expect(result.positionals).toEqual(['API_KEY', 'CRYPTO_KEY']);
		});

		it('parses secrets set KEY VALUE', () => {
			const result = cli.parse(['secrets', 'set', 'API_KEY', 'sk_test_123']);

			expect(result.command).toBe('secrets');
			expect(result.subcommand).toBe('set');
			expect(result.positionals).toEqual(['API_KEY', 'sk_test_123']);
		});

		it('parses secrets set KEY=VALUE format', () => {
			const result = cli.parse(['secrets', 'set', 'API_KEY=sk_test_123']);

			expect(result.command).toBe('secrets');
			expect(result.subcommand).toBe('set');
			expect(result.positionals).toEqual(['API_KEY=sk_test_123']);
		});

		it('parses secrets delete <key>', () => {
			const result = cli.parse(['secrets', 'delete', 'API_KEY']);

			expect(result.command).toBe('secrets');
			expect(result.subcommand).toBe('delete');
			expect(result.positionals).toEqual(['API_KEY']);
		});

		it('parses secrets download with filepath', () => {
			const result = cli.parse(['secrets', 'download', '/tmp/secrets.json']);

			expect(result.command).toBe('secrets');
			expect(result.subcommand).toBe('download');
			expect(result.positionals).toEqual(['/tmp/secrets.json']);
		});

		it('parses secrets download with --format flag', () => {
			const result = cli.parse(['secrets', 'download', '--format', 'env']);

			expect(result.command).toBe('secrets');
			expect(result.subcommand).toBe('download');
			expect(result.flags.format).toBe('env');
		});

		it('parses secrets download with --no-file flag', () => {
			const result = cli.parse(['secrets', 'download', '--no-file']);

			expect(result.command).toBe('secrets');
			expect(result.subcommand).toBe('download');
			expect(result.flags['no-file']).toBe(true);
		});

		it('parses secrets upload with filepath', () => {
			const result = cli.parse(['secrets', 'upload', 'secrets.env']);

			expect(result.command).toBe('secrets');
			expect(result.subcommand).toBe('upload');
			expect(result.positionals).toEqual(['secrets.env']);
		});

		it('parses secrets with --project and --config flags', () => {
			const result = cli.parse(['secrets', '-p', 'myapp', '-c', 'production']);

			expect(result.command).toBe('secrets');
			expect(result.flags.project).toBe('myapp');
			expect(result.flags.config).toBe('production');
		});

		it('parses secrets with --raw flag', () => {
			const result = cli.parse(['secrets', '--raw']);

			expect(result.command).toBe('secrets');
			expect(result.flags.raw).toBe(true);
		});

		it('parses secrets with --only-names flag', () => {
			const result = cli.parse(['secrets', '--only-names']);

			expect(result.command).toBe('secrets');
			expect(result.flags['only-names']).toBe(true);
		});

		it('parses secrets get with --plain flag', () => {
			const result = cli.parse(['secrets', 'get', 'API_KEY', '--plain']);

			expect(result.command).toBe('secrets');
			expect(result.subcommand).toBe('get');
			expect(result.flags.plain).toBe(true);
		});

		it('parses secrets delete with --yes flag', () => {
			const result = cli.parse(['secrets', 'delete', 'API_KEY', '-y']);

			expect(result.command).toBe('secrets');
			expect(result.subcommand).toBe('delete');
			expect(result.flags.yes).toBe(true);
		});
	});

	describe('parse() - run command', () => {
		it('parses run command with -- separator', () => {
			const result = cli.parse(['run', '--', 'echo', 'hello']);

			expect(result.command).toBe('run');
			expect(result.positionals).toEqual(['echo', 'hello']);
		});

		it('parses run with flags before --', () => {
			const result = cli.parse(['run', '-p', 'myapp', '-c', 'dev', '--', 'npm', 'start']);

			expect(result.command).toBe('run');
			expect(result.flags.project).toBe('myapp');
			expect(result.flags.config).toBe('dev');
			expect(result.positionals).toEqual(['npm', 'start']);
		});

		it('parses run with --command flag', () => {
			const result = cli.parse(['run', '--command', 'echo hi && echo bye']);

			expect(result.command).toBe('run');
			expect(result.flags.command).toBe('echo hi && echo bye');
		});

		it('parses run with --mount flag', () => {
			const result = cli.parse(['run', '--mount', 'secrets.json', '--', 'cat', 'secrets.json']);

			expect(result.command).toBe('run');
			expect(result.flags.mount).toBe('secrets.json');
			expect(result.positionals).toEqual(['cat', 'secrets.json']);
		});

		it('parses run with --mount-format flag', () => {
			const result = cli.parse([
				'run',
				'--mount',
				'secrets.env',
				'--mount-format',
				'env',
				'--',
				'sh',
				'-c',
				'cat secrets.env',
			]);

			expect(result.command).toBe('run');
			expect(result.flags.mount).toBe('secrets.env');
			expect(result.flags['mount-format']).toBe('env');
		});

		it('parses run with --fallback flag', () => {
			const result = cli.parse(['run', '--fallback', '/tmp/fallback.json', '--', 'npm', 'start']);

			expect(result.command).toBe('run');
			expect(result.flags.fallback).toBe('/tmp/fallback.json');
		});

		it('parses run with --fallback-only flag', () => {
			const result = cli.parse(['run', '--fallback-only', '--', 'npm', 'start']);

			expect(result.command).toBe('run');
			expect(result.flags['fallback-only']).toBe(true);
		});

		it('parses run with --no-fallback flag', () => {
			const result = cli.parse(['run', '--no-fallback', '--', 'npm', 'start']);

			expect(result.command).toBe('run');
			expect(result.flags['no-fallback']).toBe(true);
		});

		it('parses run with --preserve-env flag', () => {
			const result = cli.parse(['run', '--preserve-env', 'PATH,HOME', '--', 'npm', 'start']);

			expect(result.command).toBe('run');
			expect(result.flags['preserve-env']).toBe('PATH,HOME');
		});
	});

	describe('parse() - login command', () => {
		it('parses login with no args (interactive)', () => {
			const result = cli.parse(['login']);

			expect(result.command).toBe('login');
		});

		it('parses login with --nsec flag', () => {
			const result = cli.parse(['login', '--nsec', 'nsec1...']);

			expect(result.command).toBe('login');
			expect(result.flags.nsec).toBe('nsec1...');
		});

		it('parses login with --bunker flag', () => {
			const result = cli.parse(['login', '--bunker', 'bunker://pubkey?relay=wss://relay.example']);

			expect(result.command).toBe('login');
			expect(result.flags.bunker).toBe('bunker://pubkey?relay=wss://relay.example');
		});

		it('parses login with -b short flag', () => {
			const result = cli.parse(['login', '-b', 'bunker://pubkey']);

			expect(result.command).toBe('login');
			expect(result.flags.bunker).toBe('bunker://pubkey');
		});

		it('parses login with --connect flag', () => {
			const result = cli.parse(['login', '--connect']);

			expect(result.command).toBe('login');
			expect(result.flags.connect).toBe(true);
		});

		it('parses login with -c short flag', () => {
			const result = cli.parse(['login', '-c']);

			expect(result.command).toBe('login');
			expect(result.flags.connect).toBe(true);
		});

		it('parses login with --overwrite flag', () => {
			const result = cli.parse(['login', '--overwrite']);

			expect(result.command).toBe('login');
			expect(result.flags.overwrite).toBe(true);
		});

		it('parses login revoke subcommand', () => {
			const result = cli.parse(['login', 'revoke']);

			expect(result.command).toBe('login');
			expect(result.subcommand).toBe('revoke');
		});

		it('parses login revoke with --yes flag', () => {
			const result = cli.parse(['login', 'revoke', '-y']);

			expect(result.command).toBe('login');
			expect(result.subcommand).toBe('revoke');
			expect(result.flags.yes).toBe(true);
		});
	});

	describe('parse() - logout command', () => {
		it('parses logout', () => {
			const result = cli.parse(['logout']);

			expect(result.command).toBe('logout');
		});

		it('parses logout with --yes flag', () => {
			const result = cli.parse(['logout', '-y']);

			expect(result.command).toBe('logout');
			expect(result.flags.yes).toBe(true);
		});
	});

	describe('parse() - setup command', () => {
		it('parses setup with no args (interactive)', () => {
			const result = cli.parse(['setup']);

			expect(result.command).toBe('setup');
		});

		it('parses setup with --project flag', () => {
			const result = cli.parse(['setup', '--project', 'myapp']);

			expect(result.command).toBe('setup');
			expect(result.flags.project).toBe('myapp');
		});

		it('parses setup with -p short flag', () => {
			const result = cli.parse(['setup', '-p', 'myapp']);

			expect(result.command).toBe('setup');
			expect(result.flags.project).toBe('myapp');
		});

		it('parses setup with --config flag', () => {
			const result = cli.parse(['setup', '--config', 'production']);

			expect(result.command).toBe('setup');
			expect(result.flags.config).toBe('production');
		});

		it('parses setup with -c short flag', () => {
			const result = cli.parse(['setup', '-c', 'dev']);

			expect(result.command).toBe('setup');
			expect(result.flags.config).toBe('dev');
		});

		it('parses setup with --no-interactive flag', () => {
			const result = cli.parse(['setup', '-p', 'myapp', '-c', 'dev', '--no-interactive']);

			expect(result.command).toBe('setup');
			expect(result.flags['no-interactive']).toBe(true);
		});
	});

	describe('parse() - configure command', () => {
		it('parses configure with no args', () => {
			const result = cli.parse(['configure']);

			expect(result.command).toBe('configure');
		});

		it('parses configure with --all flag', () => {
			const result = cli.parse(['configure', '--all']);

			expect(result.command).toBe('configure');
			expect(result.flags.all).toBe(true);
		});

		it('parses configure get subcommand', () => {
			const result = cli.parse(['configure', 'get', 'project']);

			expect(result.command).toBe('configure');
			expect(result.subcommand).toBe('get');
			expect(result.positionals).toEqual(['project']);
		});

		it('parses configure set subcommand', () => {
			const result = cli.parse(['configure', 'set', 'project=myapp']);

			expect(result.command).toBe('configure');
			expect(result.subcommand).toBe('set');
			expect(result.positionals).toEqual(['project=myapp']);
		});

		it('parses configure unset subcommand', () => {
			const result = cli.parse(['configure', 'unset', 'project']);

			expect(result.command).toBe('configure');
			expect(result.subcommand).toBe('unset');
			expect(result.positionals).toEqual(['project']);
		});

		it('parses configure reset subcommand', () => {
			const result = cli.parse(['configure', 'reset']);

			expect(result.command).toBe('configure');
			expect(result.subcommand).toBe('reset');
		});

		it('parses configure reset with --yes flag', () => {
			const result = cli.parse(['configure', 'reset', '-y']);

			expect(result.command).toBe('configure');
			expect(result.subcommand).toBe('reset');
			expect(result.flags.yes).toBe(true);
		});
	});

	describe('parse() - me/whoami command', () => {
		it('parses me command', () => {
			const result = cli.parse(['me']);

			expect(result.command).toBe('me');
		});

		it('parses whoami alias', () => {
			const result = cli.parse(['whoami']);

			expect(result.command).toBe('me');
		});
	});

	describe('parse() - serve command', () => {
		it('parses serve with no args', () => {
			const result = cli.parse(['serve']);

			expect(result.command).toBe('serve');
		});

		it('parses serve with --port flag', () => {
			const result = cli.parse(['serve', '--port', '8080']);

			expect(result.command).toBe('serve');
			expect(result.flags.port).toBe('8080');
		});

		it('parses serve with -p short flag', () => {
			const result = cli.parse(['serve', '-p', '3001']);

			expect(result.command).toBe('serve');
			expect(result.flags.port).toBe('3001');
		});

		it('parses serve with --host flag', () => {
			const result = cli.parse(['serve', '--host', '0.0.0.0']);

			expect(result.command).toBe('serve');
			expect(result.flags.host).toBe('0.0.0.0');
		});

		it('parses serve with -H short flag', () => {
			const result = cli.parse(['serve', '-H', 'localhost']);

			expect(result.command).toBe('serve');
			expect(result.flags.host).toBe('localhost');
		});

		it('parses serve with --open flag', () => {
			const result = cli.parse(['serve', '--open']);

			expect(result.command).toBe('serve');
			expect(result.flags.open).toBe(true);
		});

		it('parses serve with -o short flag', () => {
			const result = cli.parse(['serve', '-o']);

			expect(result.command).toBe('serve');
			expect(result.flags.open).toBe(true);
		});
	});

	describe('parse() - upgrade command', () => {
		it('parses upgrade with no args', () => {
			const result = cli.parse(['upgrade']);

			expect(result.command).toBe('upgrade');
		});

		it('parses update alias', () => {
			const result = cli.parse(['update']);

			expect(result.command).toBe('upgrade');
		});

		it('parses upgrade with --force flag', () => {
			const result = cli.parse(['upgrade', '--force']);

			expect(result.command).toBe('upgrade');
			expect(result.flags.force).toBe(true);
		});

		it('parses upgrade with -f short flag', () => {
			const result = cli.parse(['upgrade', '-f']);

			expect(result.command).toBe('upgrade');
			expect(result.flags.force).toBe(true);
		});

		it('parses upgrade with --tag flag', () => {
			const result = cli.parse(['upgrade', '--tag', 'v0.3.0']);

			expect(result.command).toBe('upgrade');
			expect(result.flags.tag).toBe('v0.3.0');
		});

		it('parses upgrade with -t short flag', () => {
			const result = cli.parse(['upgrade', '-t', 'v0.2.0']);

			expect(result.command).toBe('upgrade');
			expect(result.flags.tag).toBe('v0.2.0');
		});
	});

	describe('parse() - unknown commands', () => {
		it('returns unknown command name', () => {
			const result = cli.parse(['nonexistent']);

			expect(result.command).toBe('nonexistent');
		});
	});

	describe('generateMainHelp()', () => {
		it('includes description', () => {
			const help = cli.generateMainHelp();

			expect(help).toContain('Decentralized Secret Management');
		});

		it('includes usage', () => {
			const help = cli.generateMainHelp();

			expect(help).toContain('Usage:');
			expect(help).toContain('redshift [flags]');
			expect(help).toContain('redshift [command]');
		});

		it('includes available commands', () => {
			const help = cli.generateMainHelp();

			expect(help).toContain('Available Commands:');
			expect(help).toContain('login');
			expect(help).toContain('logout');
			expect(help).toContain('setup');
			expect(help).toContain('run');
			expect(help).toContain('secrets');
			expect(help).toContain('serve');
			expect(help).toContain('configure');
			expect(help).toContain('me');
			expect(help).toContain('upgrade');
		});

		it('includes global flags', () => {
			const help = cli.generateMainHelp();

			expect(help).toContain('Flags:');
			expect(help).toContain('--help');
			expect(help).toContain('--version');
			expect(help).toContain('--json');
			expect(help).toContain('--silent');
			expect(help).toContain('--debug');
			expect(help).toContain('--config-dir');
		});

		it('includes usage hint', () => {
			const help = cli.generateMainHelp();

			expect(help).toContain('Use "redshift [command] --help"');
		});
	});

	describe('generateCommandHelp()', () => {
		it('generates help for secrets command', () => {
			const help = cli.generateCommandHelp('secrets');

			expect(help).toContain('Manage secrets');
			expect(help).toContain('Usage:');
			expect(help).toContain('redshift secrets');
			expect(help).toContain('Available Commands:');
			expect(help).toContain('get');
			expect(help).toContain('set');
			expect(help).toContain('delete');
			expect(help).toContain('download');
			expect(help).toContain('upload');
			expect(help).toContain('Flags:');
			expect(help).toContain('--project');
			expect(help).toContain('--config');
			expect(help).toContain('Global Flags:');
		});

		it('generates help for secrets get subcommand', () => {
			const help = cli.generateCommandHelp('secrets', 'get');

			expect(help).toContain('Get the value of one or more secrets');
			expect(help).toContain('Usage:');
			expect(help).toContain('redshift secrets get');
			expect(help).toContain('Flags:');
			expect(help).toContain('--plain');
			expect(help).toContain('--copy');
		});

		it('generates help for run command', () => {
			const help = cli.generateCommandHelp('run');

			expect(help).toContain('Run a command with secrets injected');
			expect(help).toContain('Examples:');
			expect(help).toContain('redshift run -- YOUR_COMMAND');
			expect(help).toContain('--mount');
			expect(help).toContain('--fallback');
		});

		it('generates help for login command', () => {
			const help = cli.generateCommandHelp('login');

			expect(help).toContain('Authenticate to Redshift');
			expect(help).toContain('--nsec');
			expect(help).toContain('--bunker');
			expect(help).toContain('--connect');
		});

		it('returns error for unknown command', () => {
			const help = cli.generateCommandHelp('nonexistent');

			expect(help).toContain('Unknown command');
		});
	});

	describe('command registration', () => {
		it('allows registering custom commands', () => {
			const customCli = new CLI();
			customCli.registerCommand({
				name: 'custom',
				description: 'A custom command',
				flags: {
					foo: {
						type: 'string',
						description: 'A foo option',
					},
				},
			});

			const cmd = customCli.getCommand('custom');
			expect(cmd).toBeDefined();
			expect(cmd?.name).toBe('custom');
		});

		it('supports command aliases', () => {
			const customCli = new CLI();
			customCli.registerCommand({
				name: 'primary',
				description: 'Primary command',
				aliases: ['p', 'alias'],
			});

			expect(customCli.getCommand('primary')).toBeDefined();
			expect(customCli.getCommand('p')).toBeDefined();
			expect(customCli.getCommand('alias')).toBeDefined();
			expect(customCli.getCommand('p')?.name).toBe('primary');
		});
	});
});

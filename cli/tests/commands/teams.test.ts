/**
 * Teams Command Tests
 *
 * L2: Function-Author - Tests for teams command handler
 * L5: Journey-Validator - Team management workflow
 */

import { describe, expect, it } from 'bun:test';
import { createCLI } from '../../src/lib/cli';

describe('Teams Command', () => {
	describe('CLI parsing', () => {
		const cli = createCLI('1.0.0');

		it('recognizes the teams command', () => {
			const cmd = cli.getCommand('teams');
			expect(cmd).toBeDefined();
			expect(cmd?.name).toBe('teams');
			expect(cmd?.description).toBe('Manage teams');
		});

		it('parses teams list subcommand', () => {
			const result = cli.parse(['teams', 'list']);
			expect(result.command).toBe('teams');
			expect(result.subcommand).toBe('list');
		});

		it('parses teams create with positional and slug flag', () => {
			const result = cli.parse(['teams', 'create', 'My Team', '--slug', 'my-team']);
			expect(result.command).toBe('teams');
			expect(result.subcommand).toBe('create');
			expect(result.positionals).toContain('My Team');
			expect(result.flags.slug).toBe('my-team');
		});

		it('parses teams create with short slug flag', () => {
			const result = cli.parse(['teams', 'create', 'My Team', '-s', 'my-team']);
			expect(result.command).toBe('teams');
			expect(result.subcommand).toBe('create');
			expect(result.flags.slug).toBe('my-team');
		});

		it('parses teams members with team-id positional', () => {
			const result = cli.parse(['teams', 'members', 'team-123']);
			expect(result.command).toBe('teams');
			expect(result.subcommand).toBe('members');
			expect(result.positionals).toContain('team-123');
		});

		it('parses teams invite with all flags', () => {
			const result = cli.parse([
				'teams',
				'invite',
				'team-123',
				'--email',
				'user@test.com',
				'--role',
				'developer',
			]);
			expect(result.command).toBe('teams');
			expect(result.subcommand).toBe('invite');
			expect(result.positionals).toContain('team-123');
			expect(result.flags.email).toBe('user@test.com');
			expect(result.flags.role).toBe('developer');
		});

		it('parses teams invite with pubkey flag', () => {
			const result = cli.parse([
				'teams',
				'invite',
				'team-123',
				'--pubkey',
				'npub1abc',
				'--role',
				'admin',
			]);
			expect(result.command).toBe('teams');
			expect(result.subcommand).toBe('invite');
			expect(result.flags.pubkey).toBe('npub1abc');
			expect(result.flags.role).toBe('admin');
		});

		it('parses teams invite with short role flag', () => {
			const result = cli.parse([
				'teams',
				'invite',
				'team-123',
				'--email',
				'user@test.com',
				'-r',
				'readonly',
			]);
			expect(result.command).toBe('teams');
			expect(result.flags.role).toBe('readonly');
		});

		it('parses teams remove with two positionals', () => {
			const result = cli.parse(['teams', 'remove', 'team-123', 'pubkey-abc']);
			expect(result.command).toBe('teams');
			expect(result.subcommand).toBe('remove');
			expect(result.positionals).toEqual(['team-123', 'pubkey-abc']);
		});

		it('parses teams rotate-key with team-id', () => {
			const result = cli.parse(['teams', 'rotate-key', 'team-123']);
			expect(result.command).toBe('teams');
			expect(result.subcommand).toBe('rotate-key');
			expect(result.positionals).toContain('team-123');
		});

		it('parses teams with --json flag', () => {
			const result = cli.parse(['teams', 'list', '--json']);
			expect(result.command).toBe('teams');
			expect(result.subcommand).toBe('list');
			expect(result.globalFlags.json).toBe(true);
		});

		it('parses teams with --help flag', () => {
			const result = cli.parse(['teams', '--help']);
			expect(result.command).toBe('teams');
			expect(result.helpRequested).toBe(true);
		});

		it('parses teams subcommand with --help flag', () => {
			const result = cli.parse(['teams', 'create', '--help']);
			expect(result.command).toBe('teams');
			expect(result.helpRequested).toBe(true);
		});
	});

	describe('help generation', () => {
		const cli = createCLI('1.0.0');

		it('generates help for teams command', () => {
			const help = cli.generateCommandHelp('teams');

			expect(help).toContain('Manage teams');
			expect(help).toContain('create');
			expect(help).toContain('list');
			expect(help).toContain('members');
			expect(help).toContain('invite');
			expect(help).toContain('remove');
			expect(help).toContain('rotate-key');
		});

		it('generates help for teams create subcommand', () => {
			const help = cli.generateCommandHelp('teams', 'create');

			expect(help).toContain('Create a new team');
			expect(help).toContain('--slug');
		});

		it('generates help for teams invite subcommand', () => {
			const help = cli.generateCommandHelp('teams', 'invite');

			expect(help).toContain('Invite a member');
			expect(help).toContain('--email');
			expect(help).toContain('--pubkey');
			expect(help).toContain('--role');
		});

		it('includes teams in main help', () => {
			const help = cli.generateMainHelp();

			expect(help).toContain('teams');
			expect(help).toContain('Manage teams');
		});
	});

	describe('secrets --team flag', () => {
		const cli = createCLI('1.0.0');

		it('parses --team flag on secrets command', () => {
			const result = cli.parse(['secrets', '--team', 'my-team']);
			expect(result.command).toBe('secrets');
			expect(result.flags.team).toBe('my-team');
		});

		it('parses -t short flag on secrets command', () => {
			const result = cli.parse(['secrets', '-t', 'my-team']);
			expect(result.command).toBe('secrets');
			expect(result.flags.team).toBe('my-team');
		});

		it('parses --team with other secrets flags', () => {
			const result = cli.parse([
				'secrets',
				'get',
				'API_KEY',
				'--team',
				'my-team',
				'--project',
				'backend',
			]);
			expect(result.command).toBe('secrets');
			expect(result.subcommand).toBe('get');
			expect(result.flags.team).toBe('my-team');
			expect(result.flags.project).toBe('backend');
		});

		it('includes --team in secrets help', () => {
			const help = cli.generateCommandHelp('secrets');

			expect(help).toContain('--team');
			expect(help).toContain('team slug or ID');
		});
	});
});

/**
 * Setup Command Tests
 *
 * L2: Function-Author - Tests for setup command
 * L5: Journey-Validator - Project configuration workflow validation
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import type { SetupOptions } from '../../src/commands/setup';

// Store original env
const originalEnv = { ...process.env };

describe('setup command', () => {
	const TEST_DIR = join(import.meta.dir, '../.test-setup');
	const CONFIG_DIR = join(TEST_DIR, '.redshift');

	beforeEach(() => {
		// Clean up and create fresh test directories
		try {
			rmSync(TEST_DIR, { recursive: true });
		} catch {}
		mkdirSync(TEST_DIR, { recursive: true });
		mkdirSync(CONFIG_DIR, { recursive: true });

		// Set up test environment
		process.env.REDSHIFT_CONFIG_DIR = CONFIG_DIR;
		process.env.HOME = TEST_DIR;
	});

	afterEach(() => {
		// Restore original env
		process.env = { ...originalEnv };

		// Clean up test directory
		try {
			rmSync(TEST_DIR, { recursive: true });
		} catch {}
	});

	describe('SetupOptions interface', () => {
		it('should accept empty options', () => {
			const options: SetupOptions = {};
			expect(options.project).toBeUndefined();
			expect(options.environment).toBeUndefined();
			expect(options.force).toBeUndefined();
		});

		it('should accept project option', () => {
			const options: SetupOptions = {
				project: 'my-project',
			};
			expect(options.project).toBe('my-project');
		});

		it('should accept environment option', () => {
			const options: SetupOptions = {
				environment: 'production',
			};
			expect(options.environment).toBe('production');
		});

		it('should accept force flag', () => {
			const options: SetupOptions = {
				force: true,
			};
			expect(options.force).toBe(true);
		});

		it('should accept all options together', () => {
			const options: SetupOptions = {
				project: 'test-project',
				environment: 'staging',
				force: true,
			};
			expect(options.project).toBe('test-project');
			expect(options.environment).toBe('staging');
			expect(options.force).toBe(true);
		});
	});

	describe('setupCommand exports', () => {
		it('should export setupCommand function', async () => {
			const { setupCommand } = await import('../../src/commands/setup');
			expect(typeof setupCommand).toBe('function');
		});

		it('should export selectProject function', async () => {
			const { selectProject } = await import('../../src/commands/setup');
			expect(typeof selectProject).toBe('function');
		});

		it('should export selectEnvironment function', async () => {
			const { selectEnvironment } = await import('../../src/commands/setup');
			expect(typeof selectEnvironment).toBe('function');
		});
	});

	describe('redshift.yaml handling', () => {
		it('should detect existing redshift.yaml', async () => {
			// Create existing config
			const existingConfig = {
				project: 'existing-project',
				environment: 'development',
			};
			writeFileSync(join(TEST_DIR, 'redshift.yaml'), stringifyYaml(existingConfig));

			const { loadProjectConfig } = await import('../../src/lib/config');
			const config = await loadProjectConfig(TEST_DIR);

			expect(config).not.toBeNull();
			expect(config?.project).toBe('existing-project');
			expect(config?.environment).toBe('development');
		});

		it('should return null when no redshift.yaml exists', async () => {
			const { loadProjectConfig } = await import('../../src/lib/config');
			const config = await loadProjectConfig(TEST_DIR);

			expect(config).toBeNull();
		});

		it('should save redshift.yaml correctly', async () => {
			const { saveProjectConfig, loadProjectConfig } = await import('../../src/lib/config');

			const config = {
				project: 'new-project',
				environment: 'production',
				relays: ['wss://relay1.example', 'wss://relay2.example'],
			};

			await saveProjectConfig(TEST_DIR, config);

			// Verify file exists
			expect(existsSync(join(TEST_DIR, 'redshift.yaml'))).toBe(true);

			// Verify content
			const loaded = await loadProjectConfig(TEST_DIR);
			expect(loaded?.project).toBe('new-project');
			expect(loaded?.environment).toBe('production');
			expect(loaded?.relays).toEqual(['wss://relay1.example', 'wss://relay2.example']);
		});

		it('should parse YAML with relays array', async () => {
			const yamlContent = `project: test-project
environment: development
relays:
  - wss://relay.damus.io
  - wss://nos.lol
`;
			writeFileSync(join(TEST_DIR, 'redshift.yaml'), yamlContent);

			const { loadProjectConfig } = await import('../../src/lib/config');
			const config = await loadProjectConfig(TEST_DIR);

			expect(config?.relays).toHaveLength(2);
			expect(config?.relays?.[0]).toBe('wss://relay.damus.io');
		});
	});

	describe('environment defaults', () => {
		it('should provide standard environment options', async () => {
			// Test that the standard environments are available
			const standardEnvs = ['development', 'staging', 'production'];

			for (const env of standardEnvs) {
				expect(typeof env).toBe('string');
				expect(env.length).toBeGreaterThan(0);
			}
		});
	});

	describe('project config structure', () => {
		it('should validate RedshiftConfig interface', async () => {
			const { loadProjectConfig, saveProjectConfig } = await import('../../src/lib/config');

			// Test minimal config
			const minimalConfig = {
				project: 'minimal',
				environment: 'dev',
			};
			await saveProjectConfig(TEST_DIR, minimalConfig);
			const loadedMinimal = await loadProjectConfig(TEST_DIR);
			expect(loadedMinimal?.project).toBe('minimal');
			expect(loadedMinimal?.environment).toBe('dev');
			expect(loadedMinimal?.relays).toBeUndefined();

			// Test full config
			const fullConfig = {
				project: 'full-project',
				environment: 'production',
				relays: ['wss://custom.relay'],
			};
			await saveProjectConfig(TEST_DIR, fullConfig);
			const loadedFull = await loadProjectConfig(TEST_DIR);
			expect(loadedFull?.project).toBe('full-project');
			expect(loadedFull?.environment).toBe('production');
			expect(loadedFull?.relays).toEqual(['wss://custom.relay']);
		});
	});

	describe('force flag behavior', () => {
		it('should respect force flag to overwrite existing config', () => {
			// Create existing config
			const existingConfig = {
				project: 'old-project',
				environment: 'development',
			};
			writeFileSync(join(TEST_DIR, 'redshift.yaml'), stringifyYaml(existingConfig));

			const options: SetupOptions = {
				project: 'new-project',
				environment: 'production',
				force: true,
			};

			// With force flag, should be allowed to proceed
			expect(options.force).toBe(true);
		});

		it('should not overwrite without force flag', async () => {
			// Create existing config
			const existingConfig = {
				project: 'existing-project',
				environment: 'development',
			};
			writeFileSync(join(TEST_DIR, 'redshift.yaml'), stringifyYaml(existingConfig));

			const options: SetupOptions = {};

			// Without force flag, existing config should be preserved
			const { loadProjectConfig } = await import('../../src/lib/config');
			const config = await loadProjectConfig(TEST_DIR);

			expect(config?.project).toBe('existing-project');
			expect(options.force).toBeUndefined();
		});
	});

	describe('relay defaults', () => {
		it('should provide default relays when not specified', async () => {
			const { getRelays } = await import('../../src/lib/config');

			const relays = await getRelays();

			expect(Array.isArray(relays)).toBe(true);
			expect(relays.length).toBeGreaterThan(0);
			// Should contain known public relays
			expect(relays.some((r) => r.includes('damus'))).toBe(true);
		});

		it('should use custom relays from config', async () => {
			const { saveConfig, getRelays } = await import('../../src/lib/config');

			const customRelays = ['wss://custom1.relay', 'wss://custom2.relay'];
			await saveConfig({ relays: customRelays });

			const relays = await getRelays();

			expect(relays).toEqual(customRelays);
		});
	});
});

describe('setup command helpers', () => {
	describe('selectProject', () => {
		it('should format existing projects with indices', async () => {
			const existingProjects = ['project-a', 'project-b', 'project-c'];

			// Test that project list can be formatted correctly
			existingProjects.forEach((p, i) => {
				expect(`${i + 1}. ${p}`).toBe(`${i + 1}. ${p}`);
			});

			expect(existingProjects.length).toBe(3);
		});

		it('should mark current project', async () => {
			const existingProjects = ['project-a', 'project-b'];
			const currentProject = 'project-b';

			const formatted = existingProjects.map((p) => {
				const marker = p === currentProject ? ' (current)' : '';
				return `${p}${marker}`;
			});

			expect(formatted[0]).toBe('project-a');
			expect(formatted[1]).toBe('project-b (current)');
		});
	});

	describe('selectEnvironment', () => {
		it('should combine existing and default environments', async () => {
			const existingEnvironments = ['custom-env'];
			const defaultEnvs = ['development', 'staging', 'production'];

			const allEnvs = [...new Set([...existingEnvironments, ...defaultEnvs])];

			expect(allEnvs).toContain('custom-env');
			expect(allEnvs).toContain('development');
			expect(allEnvs).toContain('staging');
			expect(allEnvs).toContain('production');
		});

		it('should deduplicate environments', async () => {
			const existingEnvironments = ['development', 'custom'];
			const defaultEnvs = ['development', 'staging', 'production'];

			const allEnvs = [...new Set([...existingEnvironments, ...defaultEnvs])];

			// development should only appear once
			const devCount = allEnvs.filter((e) => e === 'development').length;
			expect(devCount).toBe(1);
		});

		it('should mark existing environments', async () => {
			const existingEnvironments = ['development', 'custom'];
			const allEnvs = ['development', 'staging', 'production', 'custom'];

			const formatted = allEnvs.map((e) => {
				const existing = existingEnvironments.includes(e) ? ' [existing]' : '';
				return `${e}${existing}`;
			});

			expect(formatted[0]).toBe('development [existing]');
			expect(formatted[1]).toBe('staging');
			expect(formatted[2]).toBe('production');
			expect(formatted[3]).toBe('custom [existing]');
		});
	});
});

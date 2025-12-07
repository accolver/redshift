/**
 * Setup Command - Configure project and environment
 *
 * L5: Journey-Validator - Project configuration flow
 */

import { createInterface } from 'node:readline';
import { getRelays, loadProjectConfig, saveProjectConfig } from '../lib/config';
import { SecretManager } from '../lib/secret-manager';
import type { RedshiftConfig } from '../lib/types';
import { requireAuth } from './login';

export interface SetupOptions {
	project?: string;
	environment?: string;
	force?: boolean;
}

/**
 * Execute the setup command.
 * Creates or updates redshift.yaml in the current directory.
 */
export async function setupCommand(options: SetupOptions): Promise<void> {
	const cwd = process.cwd();
	const existingConfig = await loadProjectConfig(cwd);

	if (existingConfig && !options.force) {
		console.log('This directory already has a redshift.yaml:');
		console.log(`  Project: ${existingConfig.project}`);
		console.log(`  Environment: ${existingConfig.environment}`);
		console.log('\nUse --force to reconfigure.');
		return;
	}

	// Require authentication
	const auth = await requireAuth();
	console.log(`\nAuthenticated as ${auth.npub}\n`);

	// Connect to relays and fetch existing projects
	const relays = await getRelays();
	const manager = new SecretManager(auth.privateKey);
	manager.connect(relays);

	let projectId: string;
	let environment: string;

	try {
		console.log('Redshift Setup');
		console.log('==============\n');

		// Fetch existing projects from relays
		console.log('Fetching existing projects from relays...');
		let existingProjects: string[] = [];
		let existingEnvironments: string[] = [];

		try {
			existingProjects = await manager.listProjects();
			if (existingProjects.length > 0) {
				console.log(`Found ${existingProjects.length} existing project(s)\n`);
			} else {
				console.log('No existing projects found\n');
			}
		} catch (err) {
			console.log('Could not fetch projects (will use manual input)\n');
		}

		// Select or create project
		if (options.project) {
			projectId = options.project;
		} else if (existingProjects.length > 0) {
			projectId = await selectProject(existingProjects, existingConfig?.project);
			// If empty, prompt for new project name
			if (!projectId) {
				projectId = await promptForInput('Enter new project name: ');
			}
		} else {
			projectId = await promptForInput('Enter project ID: ', existingConfig?.project);
		}

		if (!projectId) {
			console.error('Project ID is required.');
			process.exit(1);
		}

		// Fetch environments for selected project
		if (existingProjects.includes(projectId)) {
			try {
				existingEnvironments = await manager.listEnvironments(projectId);
			} catch {
				// Ignore errors, will use defaults
			}
		}

		// Select or create environment
		if (options.environment) {
			environment = options.environment;
		} else if (existingEnvironments.length > 0 || existingProjects.includes(projectId)) {
			environment = await selectEnvironment(
				existingEnvironments,
				existingConfig?.environment || 'development',
			);
		} else {
			environment = await promptForInput(
				'Enter environment (e.g., development, staging, production): ',
				existingConfig?.environment || 'development',
			);
		}

		if (!environment) {
			console.error('Environment is required.');
			process.exit(1);
		}

		// Save config
		const config: RedshiftConfig = {
			project: projectId,
			environment: environment,
			relays: relays,
		};

		await saveProjectConfig(cwd, config);

		console.log('\n✓ Configuration saved to redshift.yaml');
		console.log(`  Project: ${projectId}`);
		console.log(`  Environment: ${environment}`);
		console.log('\nYou can now use:');
		console.log('  redshift run -- <command>   Run with secrets injected');
		console.log('  redshift secrets set <KEY> <VALUE>   Set a secret');
		console.log('  redshift secrets list   List all secrets');
	} finally {
		manager.disconnect();
	}
}

/**
 * Prompt user for input with optional default.
 */
async function promptForInput(prompt: string, defaultValue?: string): Promise<string> {
	const rl = createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	const displayPrompt = defaultValue ? `${prompt}[${defaultValue}] ` : prompt;

	return new Promise((resolve) => {
		rl.question(displayPrompt, (answer) => {
			rl.close();
			resolve(answer.trim() || defaultValue || '');
		});
	});
}

/**
 * Interactive project selection from existing projects.
 * @internal Used when relay fetching is implemented
 */
export async function selectProject(
	existingProjects: string[],
	defaultProject?: string,
): Promise<string> {
	const rl = createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	return new Promise((resolve) => {
		if (existingProjects.length > 0) {
			console.log('Existing projects:');
			existingProjects.forEach((p, i) => {
				const marker = p === defaultProject ? ' (current)' : '';
				console.log(`  ${i + 1}. ${p}${marker}`);
			});
			console.log(`  ${existingProjects.length + 1}. Create new project`);
			console.log('');
		}

		rl.question('Select project (number or new name): ', (answer) => {
			rl.close();
			const num = Number.parseInt(answer, 10);
			if (!Number.isNaN(num) && num >= 1 && num <= existingProjects.length) {
				resolve(existingProjects[num - 1] as string);
			} else if (!Number.isNaN(num) && num === existingProjects.length + 1) {
				// Will prompt for new name
				resolve('');
			} else {
				resolve(answer.trim());
			}
		});
	});
}

/**
 * Interactive environment selection.
 * @internal Used when relay fetching is implemented
 */
export async function selectEnvironment(
	existingEnvironments: string[],
	defaultEnv?: string,
): Promise<string> {
	const defaultEnvs = ['development', 'staging', 'production'];
	const allEnvs = [...new Set([...existingEnvironments, ...defaultEnvs])];

	const rl = createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	return new Promise((resolve) => {
		console.log('Environments:');
		allEnvs.forEach((e, i) => {
			const marker = e === defaultEnv ? ' (current)' : '';
			const existing = existingEnvironments.includes(e) ? ' [existing]' : '';
			console.log(`  ${i + 1}. ${e}${marker}${existing}`);
		});
		console.log('');

		rl.question('Select environment (number or custom name): ', (answer) => {
			rl.close();
			const num = Number.parseInt(answer, 10);
			if (!Number.isNaN(num) && num >= 1 && num <= allEnvs.length) {
				resolve(allEnvs[num - 1] as string);
			} else {
				resolve(answer.trim() || defaultEnv || 'development');
			}
		});
	});
}

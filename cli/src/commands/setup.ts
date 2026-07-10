/** Setup Command - configure a validated project/environment context. */

import { createInterface } from 'node:readline';
import { getRelays, loadConfig, loadProjectConfig, saveProjectConfig } from '../lib/config';
import { ValidationError } from '../lib/errors';
import { SecretManager } from '../lib/secret-manager';
import type { RedshiftConfig } from '../lib/types';
import { validateAll, validateEnvironment, validateProjectId } from '../lib/validation';
import { requireAuth } from './login';

interface SetupSecretManager {
	connect(relays: string[]): void;
	listProjects(): Promise<string[]>;
	listEnvironments(projectId: string): Promise<string[]>;
	close(): Promise<void>;
}

export interface SetupOptions {
	project?: string;
	environment?: string;
	force?: boolean;
	/** Defaults to true. False guarantees that stdin is never read. */
	interactive?: boolean;
	/** Test seam for preserving typed relay failures. */
	secretManager?: SetupSecretManager;
}

function validateSetupValues(project: string, environment: string): void {
	validateAll([
		['project', project, validateProjectId],
		['environment', environment, validateEnvironment],
	]);
}

/** Execute setup without conflating overwrite permission and interactivity. */
export async function setupCommand(options: SetupOptions): Promise<void> {
	const cwd = process.cwd();
	const existingConfig = await loadProjectConfig(cwd);
	if (existingConfig && !options.force) {
		throw new ValidationError(
			`This directory already has redshift.yaml for ${existingConfig.project}/${existingConfig.environment}; use --force to reconfigure`,
		);
	}

	const globalConfig = await loadConfig();
	const interactive = options.interactive !== false;
	let projectId = options.project ?? existingConfig?.project ?? globalConfig.defaultProject;
	let environment =
		options.environment ?? existingConfig?.environment ?? globalConfig.defaultEnvironment;

	if (!interactive && (!projectId || !environment)) {
		throw new ValidationError(
			'Noninteractive setup requires --project and --config, project config, or configured global defaults',
		);
	}
	if (projectId && environment) validateSetupValues(projectId, environment);

	const auth = await requireAuth();
	console.log(`\nAuthenticated as ${auth.npub}\n`);
	const relays = await getRelays();
	let manager: SetupSecretManager | null = null;

	try {
		manager = options.secretManager ?? new SecretManager(auth.privateKey ?? auth.signer!);
		if (!projectId || !environment) {
			manager.connect(relays);
			console.log('Redshift Setup');
			console.log('==============\n');

			const existingProjects = await manager.listProjects();
			if (!projectId) {
				if (existingProjects.length > 0) {
					projectId = await selectProject(existingProjects, globalConfig.defaultProject);
					if (!projectId) projectId = await promptForInput('Enter new project name: ');
				} else {
					projectId = await promptForInput('Enter project ID: ', globalConfig.defaultProject);
				}
			}
			if (!projectId) throw new ValidationError('Project ID is required.');

			if (!environment) {
				const existingEnvironments = existingProjects.includes(projectId)
					? await manager.listEnvironments(projectId)
					: [];
				environment =
					existingEnvironments.length > 0
						? await selectEnvironment(
								existingEnvironments,
								globalConfig.defaultEnvironment ?? 'dev',
							)
						: await promptForInput(
								'Enter environment (e.g., dev, staging, prod): ',
								globalConfig.defaultEnvironment ?? 'dev',
							);
			}
		}

		if (!projectId || !environment) {
			throw new ValidationError('Project and environment are required.');
		}
		validateSetupValues(projectId, environment);

		const config: RedshiftConfig = { project: projectId, environment, relays };
		await saveProjectConfig(cwd, config);
		console.log('\n✓ Configuration saved to redshift.yaml');
		console.log(`  Project: ${projectId}`);
		console.log(`  Environment: ${environment}`);
		console.log('\nYou can now use:');
		console.log('  redshift run -- <command>   Run with secrets injected');
		console.log('  redshift secrets set <KEY> <VALUE>   Set a secret');
		console.log('  redshift secrets list   List all secrets');
	} finally {
		if (manager) await manager.close();
	}
}

async function promptForInput(prompt: string, defaultValue?: string): Promise<string> {
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	const displayPrompt = defaultValue ? `${prompt}[${defaultValue}] ` : prompt;
	return new Promise((resolve) => {
		rl.question(displayPrompt, (answer) => {
			rl.close();
			resolve(answer.trim() || defaultValue || '');
		});
	});
}

export async function selectProject(
	existingProjects: string[],
	defaultProject?: string,
): Promise<string> {
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	return new Promise((resolve) => {
		if (existingProjects.length > 0) {
			console.log('Existing projects:');
			existingProjects.forEach((project, index) => {
				const marker = project === defaultProject ? ' (current)' : '';
				console.log(`  ${index + 1}. ${project}${marker}`);
			});
			console.log(`  ${existingProjects.length + 1}. Create new project`);
			console.log('');
		}
		rl.question('Select project (number or new name): ', (answer) => {
			rl.close();
			const number = Number.parseInt(answer, 10);
			if (!Number.isNaN(number) && number >= 1 && number <= existingProjects.length) {
				resolve(existingProjects[number - 1] as string);
			} else if (!Number.isNaN(number) && number === existingProjects.length + 1) {
				resolve('');
			} else {
				resolve(answer.trim());
			}
		});
	});
}

export async function selectEnvironment(
	existingEnvironments: string[],
	defaultEnv?: string,
): Promise<string> {
	const allEnvironments = [...new Set([...existingEnvironments, 'dev', 'staging', 'prod'])];
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	return new Promise((resolve) => {
		console.log('Environments:');
		allEnvironments.forEach((environment, index) => {
			const marker = environment === defaultEnv ? ' (current)' : '';
			const existing = existingEnvironments.includes(environment) ? ' [existing]' : '';
			console.log(`  ${index + 1}. ${environment}${marker}${existing}`);
		});
		console.log('');
		rl.question('Select environment (number or custom name): ', (answer) => {
			rl.close();
			const number = Number.parseInt(answer, 10);
			if (!Number.isNaN(number) && number >= 1 && number <= allEnvironments.length) {
				resolve(allEnvironments[number - 1] as string);
			} else {
				resolve(answer.trim() || defaultEnv || 'dev');
			}
		});
	});
}

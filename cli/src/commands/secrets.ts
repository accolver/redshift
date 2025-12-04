/**
 * Secrets Command - Manage secrets
 *
 * L5: Journey-Validator - Secret management workflow
 */

import { getRelays, loadProjectConfig } from '../lib/config';
import { SecretManager, mergeSecrets } from '../lib/secret-manager';
import { requireAuth } from './login';

export type SecretsSubcommand = 'list' | 'get' | 'set' | 'delete' | 'download' | 'upload';

export interface SecretsOptions {
	subcommand: SecretsSubcommand;
	/** Secret key for get/set/delete */
	key?: string;
	/** Secret value for set */
	value?: string;
	/** Override project */
	project?: string;
	/** Override environment */
	environment?: string;
	/** Show raw values (not redacted) */
	raw?: boolean;
	/** Output format */
	format?: 'table' | 'json' | 'env';
}

/**
 * Execute the secrets command.
 */
export async function secretsCommand(options: SecretsOptions): Promise<void> {
	// Load project config
	const cwd = process.cwd();
	const projectConfig = await loadProjectConfig(cwd);

	const projectId = options.project || projectConfig?.project;
	const environment = options.environment || projectConfig?.environment;

	if (!projectId || !environment) {
		console.error('Error: No project configured.');
		console.error('Run `redshift setup` first or specify --project and --environment.');
		process.exit(1);
	}

	// Require authentication
	const auth = await requireAuth();

	// Connect to relays
	const relays = projectConfig?.relays || (await getRelays());
	const manager = new SecretManager(auth.privateKey);
	manager.connect(relays);

	try {
		switch (options.subcommand) {
			case 'list':
				await listSecrets(manager, projectId, environment, options);
				break;

			case 'get':
				if (!options.key) {
					console.error('Error: Key is required for `secrets get`');
					process.exit(1);
				}
				await getSecret(manager, projectId, environment, options.key, options);
				break;

			case 'set':
				if (!options.key) {
					console.error('Error: Key is required for `secrets set`');
					process.exit(1);
				}
				if (options.value === undefined) {
					console.error('Error: Value is required for `secrets set`');
					process.exit(1);
				}
				await setSecret(manager, projectId, environment, options.key, options.value);
				break;

			case 'delete':
				if (!options.key) {
					console.error('Error: Key is required for `secrets delete`');
					process.exit(1);
				}
				await deleteSecret(manager, projectId, environment, options.key);
				break;

			case 'download':
				await downloadSecrets(manager, projectId, environment, options);
				break;

			case 'upload':
				console.error('Upload command not yet implemented');
				break;

			default:
				console.error(`Unknown subcommand: ${options.subcommand}`);
				console.error('Available: list, get, set, delete, download');
				process.exit(1);
		}
	} finally {
		manager.disconnect();
	}
}

/**
 * List all secrets for the current project/environment.
 */
async function listSecrets(
	manager: SecretManager,
	projectId: string,
	environment: string,
	options: SecretsOptions,
): Promise<void> {
	const secrets = await manager.fetchSecrets(projectId, environment);

	if (!secrets || Object.keys(secrets).length === 0) {
		console.log(`No secrets found for ${projectId}/${environment}`);
		return;
	}

	const format = options.format || 'table';

	switch (format) {
		case 'json':
			console.log(JSON.stringify(secrets, null, 2));
			break;

		case 'env':
			for (const [key, value] of Object.entries(secrets)) {
				const strValue = typeof value === 'string' ? value : JSON.stringify(value);
				// Escape quotes and newlines for .env format
				const escaped = strValue.replace(/"/g, '\\"').replace(/\n/g, '\\n');
				console.log(`${key}="${escaped}"`);
			}
			break;
		default: {
			console.log(`Secrets for ${projectId}/${environment}:`);
			console.log('');
			const maxKeyLen = Math.max(...Object.keys(secrets).map((k) => k.length), 10);
			console.log(`${'KEY'.padEnd(maxKeyLen)}  VALUE`);
			console.log(`${'-'.repeat(maxKeyLen)}  ${'-'.repeat(40)}`);

			for (const [key, value] of Object.entries(secrets)) {
				const displayValue = formatSecretValue(value, options.raw || false);
				console.log(`${key.padEnd(maxKeyLen)}  ${displayValue}`);
			}
			break;
		}
	}
}

/**
 * Get a single secret value.
 */
async function getSecret(
	manager: SecretManager,
	projectId: string,
	environment: string,
	key: string,
	options: SecretsOptions,
): Promise<void> {
	const secrets = await manager.fetchSecrets(projectId, environment);

	if (!secrets || !(key in secrets)) {
		console.error(`Secret '${key}' not found in ${projectId}/${environment}`);
		process.exit(1);
	}

	const value = secrets[key];

	if (options.raw) {
		// Output raw value (useful for piping)
		if (typeof value === 'string') {
			process.stdout.write(value);
		} else {
			process.stdout.write(JSON.stringify(value));
		}
	} else {
		console.log(`${key}=${formatSecretValue(value, true)}`);
	}
}

/**
 * Set a secret value.
 */
async function setSecret(
	manager: SecretManager,
	projectId: string,
	environment: string,
	key: string,
	value: string,
): Promise<void> {
	// Fetch existing secrets
	const existingSecrets = (await manager.fetchSecrets(projectId, environment)) || {};

	// Parse value - try JSON first, fall back to string
	let parsedValue: string | number | boolean | object = value;
	try {
		parsedValue = JSON.parse(value);
	} catch {
		// Keep as string
	}

	// Merge with new secret
	const updatedSecrets = mergeSecrets(existingSecrets, { [key]: parsedValue });

	// Publish updated secrets
	await manager.publishSecrets(projectId, environment, updatedSecrets);

	console.log(`✓ Set ${key} in ${projectId}/${environment}`);
}

/**
 * Delete a secret.
 */
async function deleteSecret(
	manager: SecretManager,
	projectId: string,
	environment: string,
	key: string,
): Promise<void> {
	// Fetch existing secrets
	const existingSecrets = (await manager.fetchSecrets(projectId, environment)) || {};

	if (!(key in existingSecrets)) {
		console.error(`Secret '${key}' not found in ${projectId}/${environment}`);
		process.exit(1);
	}

	// Remove the key
	const updatedSecrets = { ...existingSecrets };
	delete updatedSecrets[key];

	// Publish updated secrets
	await manager.publishSecrets(projectId, environment, updatedSecrets);

	console.log(`✓ Deleted ${key} from ${projectId}/${environment}`);
}

/**
 * Download secrets as .env file content.
 */
async function downloadSecrets(
	manager: SecretManager,
	projectId: string,
	environment: string,
	_options: SecretsOptions,
): Promise<void> {
	const secrets = await manager.fetchSecrets(projectId, environment);

	if (!secrets || Object.keys(secrets).length === 0) {
		console.error(`No secrets found for ${projectId}/${environment}`);
		process.exit(1);
	}

	// Output in .env format
	for (const [key, value] of Object.entries(secrets)) {
		const strValue = typeof value === 'string' ? value : JSON.stringify(value);
		const escaped = strValue.replace(/"/g, '\\"').replace(/\n/g, '\\n');
		console.log(`${key}="${escaped}"`);
	}
}

/**
 * Format a secret value for display.
 */
function formatSecretValue(value: unknown, showRaw: boolean): string {
	if (typeof value === 'string') {
		if (showRaw) {
			return value.length > 50 ? `${value.substring(0, 50)}...` : value;
		}
		// Redact by default
		return value.length > 0 ? `${'*'.repeat(Math.min(value.length, 8))}` : '(empty)';
	}

	if (typeof value === 'number' || typeof value === 'boolean') {
		return String(value);
	}

	if (typeof value === 'object') {
		const json = JSON.stringify(value);
		if (showRaw) {
			return json.length > 50 ? `${json.substring(0, 50)}...` : json;
		}
		return `{...} (${Object.keys(value as object).length} keys)`;
	}

	return String(value);
}

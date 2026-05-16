/**
 * Secrets Command - Manage secrets
 *
 * L5: Journey-Validator - Secret management workflow
 */

import { formatEnvLine, parseEnvFile } from '@redshift/crypto';
import { stringify as stringifyYaml } from 'yaml';
import { getRelays, loadProjectConfig } from '../lib/config';
import { SecretManager, mergeSecrets } from '../lib/secret-manager';
import {
	formatValidationError,
	normalizeSecretKey,
	redactValue,
	validateEnvironment,
	validateProjectId,
	validateSecretKey,
	validateSecretValue,
} from '../lib/validation';
import { requireAuth } from './login';

export type SecretsSubcommand = 'list' | 'get' | 'set' | 'delete' | 'download' | 'upload';

export interface SecretsOptions {
	subcommand: SecretsSubcommand;
	/** Secret key for get/set/delete, or file path for upload/download */
	key?: string;
	/** Secret keys for get/delete */
	keys?: string[];
	/** Secret value for set */
	value?: string;
	/** Secret key/value pairs for set */
	values?: Record<string, string>;
	/** Override project */
	project?: string;
	/** Override environment */
	environment?: string;
	/** Show raw values (not redacted) */
	raw?: boolean;
	/** List only secret names */
	onlyNames?: boolean;
	/** Continue successfully when get keys are missing */
	noExitOnMissingSecret?: boolean;
	/** Output format */
	format?: 'table' | 'json' | 'env' | 'yaml' | 'docker' | 'env-no-quotes';
	/** Print download output instead of writing a file */
	noFile?: boolean;
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

	// Validate project ID and environment
	const projectValidation = validateProjectId(projectId);
	if (!projectValidation.valid) {
		console.error(formatValidationError('project ID', projectValidation));
		process.exit(1);
	}

	const envValidation = validateEnvironment(environment);
	if (!envValidation.valid) {
		console.error(formatValidationError('environment', envValidation));
		process.exit(1);
	}

	// Require authentication
	const auth = await requireAuth();

	// Connect to relays
	const relays = projectConfig?.relays || (await getRelays());
	const manager = new SecretManager(auth.privateKey ?? auth.signer!);
	manager.connect(relays);

	try {
		switch (options.subcommand) {
			case 'list':
				await listSecrets(manager, projectId, environment, options);
				break;

			case 'get': {
				const keys = options.keys?.length ? options.keys : options.key ? [options.key] : [];
				if (keys.length === 0) {
					console.error('Error: Key is required for `secrets get`');
					process.exit(1);
				}
				const normalizedKeys = keys.map((key) => normalizeAndValidateSecretKey(key, 'secret key'));
				await getSecrets(manager, projectId, environment, normalizedKeys, options);
				break;
			}

			case 'set': {
				const values = options.values ?? (options.key && options.value !== undefined ? { [options.key]: options.value } : undefined);
				if (!values || Object.keys(values).length === 0) {
					console.error('Error: At least one KEY=VALUE pair is required for `secrets set`');
					process.exit(1);
				}
				const normalizedValues: Record<string, string> = {};
				for (const [key, value] of Object.entries(values)) {
					const normalizedKey = normalizeAndValidateSecretKey(key, 'secret key');
					const setValueValidation = validateSecretValue(value);
					if (!setValueValidation.valid) {
						console.error(formatValidationError('secret value', setValueValidation));
						process.exit(1);
					}
					normalizedValues[normalizedKey] = value;
				}
				await setSecrets(manager, projectId, environment, normalizedValues);
				break;
			}

			case 'delete': {
				const keys = options.keys?.length ? options.keys : options.key ? [options.key] : [];
				if (keys.length === 0) {
					console.error('Error: Key is required for `secrets delete`');
					process.exit(1);
				}
				const normalizedKeys = keys.map((key) => normalizeAndValidateSecretKey(key, 'secret key'));
				await deleteSecrets(manager, projectId, environment, normalizedKeys);
				break;
			}

			case 'download':
				await downloadSecrets(manager, projectId, environment, options);
				break;

			case 'upload':
				await uploadSecrets(manager, projectId, environment, options.key);
				break;

			default:
				console.error(`Unknown subcommand: ${options.subcommand}`);
				console.error('Available: list, get, set, delete, download');
				process.exit(1);
		}
	} finally {
		await manager.close();
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

	if (options.onlyNames) {
		for (const key of Object.keys(secrets).sort()) {
			console.log(key);
		}
		return;
	}

	const format = options.format || 'table';
	const output = formatSecrets(secrets, format);

	if (format !== 'table') {
		console.log(output);
		return;
	}

	console.log(`Secrets for ${projectId}/${environment}:`);
	console.log('');
	const maxKeyLen = Math.max(...Object.keys(secrets).map((k) => k.length), 10);
	console.log(`${'KEY'.padEnd(maxKeyLen)}  VALUE`);
	console.log(`${'-'.repeat(maxKeyLen)}  ${'-'.repeat(40)}`);

	for (const [key, value] of Object.entries(secrets)) {
		const displayValue = formatSecretValue(value, options.raw || false);
		console.log(`${key.padEnd(maxKeyLen)}  ${displayValue}`);
	}
}

/**
 * Get one or more secret values.
 */
async function getSecrets(
	manager: SecretManager,
	projectId: string,
	environment: string,
	keys: string[],
	options: SecretsOptions,
): Promise<void> {
	const secrets = await manager.fetchSecrets(projectId, environment);
	const missing = keys.filter((key) => !secrets || !(key in secrets));

	if (missing.length > 0 && !options.noExitOnMissingSecret) {
		console.error(`Secret '${missing[0]}' not found in ${projectId}/${environment}`);
		process.exit(1);
	}

	const found = keys.filter((key) => secrets && key in secrets);
	const plain = options.raw || options.format === 'env' || options.format === 'env-no-quotes';
	for (const key of found) {
		const value = secrets?.[key] ?? '';
		if (plain && found.length === 1) {
			process.stdout.write(value);
		} else if (plain) {
			console.log(`${key}=${value}`);
		} else {
			console.log(`${key}=${formatSecretValue(value, true)}`);
		}
	}
}

/**
 * Set one or more secret values.
 */
async function setSecrets(
	manager: SecretManager,
	projectId: string,
	environment: string,
	values: Record<string, string>,
): Promise<void> {
	const existingSecrets = (await manager.fetchSecrets(projectId, environment)) || {};
	const updatedSecrets = mergeSecrets(existingSecrets, values);

	await manager.publishSecrets(projectId, environment, updatedSecrets);

	const keys = Object.keys(values);
	console.log(`✓ Set ${keys.length === 1 ? keys[0] : `${keys.length} secrets`} in ${projectId}/${environment}`);
}

/**
 * Delete one or more secrets.
 */
async function deleteSecrets(
	manager: SecretManager,
	projectId: string,
	environment: string,
	keys: string[],
): Promise<void> {
	const existingSecrets = (await manager.fetchSecrets(projectId, environment)) || {};
	const missing = keys.filter((key) => !(key in existingSecrets));

	if (missing.length > 0) {
		console.error(`Secret '${missing[0]}' not found in ${projectId}/${environment}`);
		process.exit(1);
	}

	const updatedSecrets = { ...existingSecrets };
	for (const key of keys) {
		delete updatedSecrets[key];
	}

	await manager.publishSecrets(projectId, environment, updatedSecrets);

	console.log(`✓ Deleted ${keys.length === 1 ? keys[0] : `${keys.length} secrets`} from ${projectId}/${environment}`);
}

/**
 * Download secrets as .env file content.
 */
async function downloadSecrets(
	manager: SecretManager,
	projectId: string,
	environment: string,
	options: SecretsOptions,
): Promise<void> {
	const secrets = await manager.fetchSecrets(projectId, environment);

	if (!secrets || Object.keys(secrets).length === 0) {
		console.error(`No secrets found for ${projectId}/${environment}`);
		process.exit(1);
	}

	const format = options.format && options.format !== 'table' ? options.format : 'env';
	const output = formatSecrets(secrets, format);

	if (options.noFile || !options.key) {
		console.log(output);
		return;
	}

	await Bun.write(options.key, output.endsWith('\n') ? output : `${output}\n`);
	console.log(`✓ Downloaded ${Object.keys(secrets).length} secrets to ${options.key}`);
}

/**
 * Upload secrets from a .env file.
 */
async function uploadSecrets(
	manager: SecretManager,
	projectId: string,
	environment: string,
	filePath?: string,
): Promise<void> {
	// Default to .env in current directory
	const envFile = filePath || '.env';

	// Check if file exists
	const file = Bun.file(envFile);
	const exists = await file.exists();

	if (!exists) {
		console.error(`Error: File not found: ${envFile}`);
		console.error('Usage: redshift secrets upload [file]');
		console.error('Default file is .env in current directory.');
		process.exit(1);
	}

	// Read and parse the .env file
	const content = await file.text();
	const parsedSecrets = parseEnvFile(content);

	if (Object.keys(parsedSecrets).length === 0) {
		console.error('Error: No secrets found in file.');
		console.error('File should be in .env format: KEY=value');
		process.exit(1);
	}

	// Fetch existing secrets to merge
	const existingSecrets = (await manager.fetchSecrets(projectId, environment)) || {};

	// Merge with new secrets (new values overwrite existing)
	const updatedSecrets = mergeSecrets(existingSecrets, parsedSecrets);

	// Show what will be uploaded
	const newKeys = Object.keys(parsedSecrets);
	const existingKeys = Object.keys(existingSecrets);
	const overwrittenKeys = newKeys.filter((k) => existingKeys.includes(k));
	const addedKeys = newKeys.filter((k) => !existingKeys.includes(k));

	console.log(`Uploading ${newKeys.length} secrets to ${projectId}/${environment}...`);
	if (addedKeys.length > 0) {
		console.log(`  Adding: ${addedKeys.join(', ')}`);
	}
	if (overwrittenKeys.length > 0) {
		console.log(`  Overwriting: ${overwrittenKeys.join(', ')}`);
	}

	// Publish updated secrets
	await manager.publishSecrets(projectId, environment, updatedSecrets);

	console.log(`✓ Uploaded ${newKeys.length} secrets from ${envFile}`);
}

/**
 * Format a secret value for display.
 */
function normalizeAndValidateSecretKey(key: string, fieldName: string): string {
	const validation = validateSecretKey(key);
	if (!validation.valid) {
		console.error(formatValidationError(fieldName, validation));
		process.exit(1);
	}
	return normalizeSecretKey(key);
}

function formatSecrets(
	secrets: Record<string, string>,
	format: Exclude<NonNullable<SecretsOptions['format']>, 'table'> | 'table',
): string {
	switch (format) {
		case 'json':
			return JSON.stringify(secrets, null, 2);
		case 'yaml':
			return stringifyYaml(secrets).trimEnd();
		case 'docker':
			return Object.entries(secrets)
				.map(([key, value]) => `${key}=${JSON.stringify(value)}`)
				.join('\n');
		case 'env-no-quotes':
			return Object.entries(secrets)
				.map(([key, value]) => `${key}=${value}`)
				.join('\n');
		case 'env':
			return Object.entries(secrets)
				.map(([key, value]) => formatEnvLine(key, value))
				.join('\n');
		case 'table':
			return '';
	}
}

function formatSecretValue(value: string, showRaw: boolean): string {
	if (showRaw) {
		return value.length > 50 ? `${value.substring(0, 50)}...` : value;
	}
	// Redact by default
	return value.length > 0 ? redactValue(value) : '(empty)';
}

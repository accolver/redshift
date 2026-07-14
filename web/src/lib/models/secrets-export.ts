import { formatEnvLine, parseEnvFile } from '@redshift/crypto';
import type { Secret } from '$lib/types/nostr';

/**
 * Export formats supported by Redshift
 */
export type ExportFormat = 'env' | 'json' | 'yaml' | 'csv';

// =============================================================================
// EXPORT FUNCTIONS
// =============================================================================

/**
 * Check if a value needs quoting in .env format
 */
function envNeedsQuoting(value: string): boolean {
	return (
		value.trim() !== value ||
		value.includes('\n') ||
		value.includes('\r') ||
		value.includes('\t') ||
		value.includes('"') ||
		value.includes("'") ||
		value.includes(' ') ||
		value.includes('#')
	);
}

/**
 * Export secrets to .env format (KEY=VALUE)
 */
export function exportToEnv(secrets: Secret[]): string {
	if (secrets.length === 0) return '';

	return secrets
		.map(({ key, value }) =>
			envNeedsQuoting(value) ? formatEnvLine(key, value) : `${key}=${value}`,
		)
		.join('\n');
}

/**
 * Export secrets to JSON format
 */
export function exportToJson(secrets: Secret[]): string {
	const obj: Record<string, string> = {};
	for (const { key, value } of secrets) {
		obj[key] = value;
	}
	return JSON.stringify(obj, null, 2);
}

/**
 * Export secrets to YAML format.
 *
 * JSON string literals are valid YAML double-quoted scalars. Always quoting
 * prevents YAML 1.2 from retyping or interpreting secret bytes such as empty
 * strings, null markers, collection syntax, directives, anchors, and blocks.
 */
export function exportToYaml(secrets: Secret[]): string {
	if (secrets.length === 0) return '';
	return secrets.map(({ key, value }) => `${key}: ${JSON.stringify(value)}`).join('\n');
}

/**
 * Escape a CSV value if needed
 */
function escapeCsvValue(value: string): string {
	if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
		// Escape quotes by doubling them
		const escaped = value.replace(/"/g, '""');
		return `"${escaped}"`;
	}
	return value;
}

/**
 * Export secrets to CSV format with headers
 */
export function exportToCsv(secrets: Secret[]): string {
	const header = 'key,value';
	if (secrets.length === 0) return header;

	const rows = secrets.map(({ key, value }) => `${escapeCsvValue(key)},${escapeCsvValue(value)}`);
	return [header, ...rows].join('\n');
}

// =============================================================================
// PARSE FUNCTIONS
// =============================================================================

/**
 * Parse .env format (KEY=VALUE)
 * Delegates to @redshift/crypto's shared parser for consistent behavior.
 */
export function parseEnv(input: string): Secret[] {
	const parsed = parseEnvFile(input);
	return Object.entries(parsed).map(([key, value]) => ({ key, value }));
}

/**
 * Parse JSON format (object with string values)
 */
export function parseJson(input: string): Secret[] {
	const parsed = JSON.parse(input);

	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		throw new Error('Expected JSON object');
	}

	const secrets: Secret[] = [];
	for (const [key, value] of Object.entries(parsed)) {
		secrets.push({
			key,
			value: value === null ? 'null' : String(value),
		});
	}

	return secrets;
}

/**
 * Parse YAML format (simple key: value pairs only)
 * Note: This is a simple parser that handles common cases
 */
export function parseYaml(input: string): Secret[] {
	if (!input.trim()) return [];

	const secrets: Secret[] = [];
	const lines = input.split('\n');

	for (const line of lines) {
		const trimmed = line.trim();

		// Skip empty lines and comments
		if (!trimmed || trimmed.startsWith('#')) continue;

		// Find the first colon
		const colonIndex = trimmed.indexOf(':');
		if (colonIndex === -1) continue;

		const key = trimmed.slice(0, colonIndex).trim();
		let value = trimmed.slice(colonIndex + 1).trim();

		// Remove inline comments (but not in quoted strings)
		if (!value.startsWith('"') && !value.startsWith("'")) {
			const commentIndex = value.indexOf('#');
			if (commentIndex !== -1) {
				value = value.slice(0, commentIndex).trim();
			}
		}

		// Handle quoted values. Exported double-quoted values use JSON string
		// escaping, which is also valid for this intentionally small YAML subset.
		if (value.startsWith('"') && value.endsWith('"')) {
			let decoded: unknown;
			try {
				decoded = JSON.parse(value);
			} catch {
				throw new Error(`Invalid YAML string for key ${key}`);
			}
			if (typeof decoded !== 'string') {
				throw new Error(`Invalid YAML string for key ${key}`);
			}
			value = decoded;
		} else if (value.startsWith("'") && value.endsWith("'")) {
			value = value.slice(1, -1);
		}

		if (key) {
			secrets.push({ key, value });
		}
	}

	return secrets;
}

/**
 * Parse CSV records while preserving commas, quotes, and line breaks inside
 * quoted fields. Quotes are decoded exactly once.
 */
function parseCsvRecords(input: string): string[][] {
	const records: string[][] = [];
	let record: string[] = [];
	let field = '';
	let inQuotes = false;
	let justClosedQuote = false;

	const finishRecord = () => {
		record.push(field);
		if (record.some((value) => value.length > 0)) records.push(record);
		record = [];
		field = '';
		justClosedQuote = false;
	};

	for (let index = 0; index < input.length; index++) {
		const character = input[index];
		if (inQuotes) {
			if (character === '"' && input[index + 1] === '"') {
				field += '"';
				index += 1;
			} else if (character === '"') {
				inQuotes = false;
				justClosedQuote = true;
			} else {
				field += character;
			}
			continue;
		}
		if (justClosedQuote) {
			if (character === ',') {
				record.push(field);
				field = '';
				justClosedQuote = false;
			} else if (character === '\n' || character === '\r') {
				finishRecord();
				if (character === '\r' && input[index + 1] === '\n') index += 1;
			} else {
				throw new Error('Invalid CSV: unexpected byte after closing quote');
			}
			continue;
		}
		if (character === '"') {
			if (field.length > 0) throw new Error('Invalid CSV: unexpected quote');
			inQuotes = true;
		} else if (character === ',') {
			record.push(field);
			field = '';
		} else if (character === '\n' || character === '\r') {
			finishRecord();
			if (character === '\r' && input[index + 1] === '\n') index += 1;
		} else {
			field += character;
		}
	}
	if (inQuotes) throw new Error('Invalid CSV: unterminated quoted field');
	finishRecord();
	return records;
}

/**
 * Parse CSV format with headers (key,value)
 */
export function parseCsv(input: string): Secret[] {
	const records = parseCsvRecords(input);
	if (records.length === 0) {
		throw new Error('Invalid CSV: no content');
	}

	const headers = records[0] ?? [];
	if (
		headers.length !== 2 ||
		headers[0]?.toLowerCase() !== 'key' ||
		headers[1]?.toLowerCase() !== 'value'
	) {
		throw new Error('Invalid CSV: expected headers "key,value"');
	}

	const secrets: Secret[] = [];
	for (const fields of records.slice(1)) {
		if (fields.length !== 2) throw new Error('Invalid CSV: expected exactly two fields');
		const key = fields[0];
		if (key) secrets.push({ key, value: fields[1] ?? '' });
	}
	return secrets;
}

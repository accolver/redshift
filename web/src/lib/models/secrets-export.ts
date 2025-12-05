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
		value.includes('\n') ||
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
		.map(({ key, value }) => {
			if (envNeedsQuoting(value)) {
				// Escape backslashes, newlines, and quotes
				const escaped = value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
				return `${key}="${escaped}"`;
			}
			return `${key}=${value}`;
		})
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
 * Check if a YAML value needs quoting
 */
function yamlNeedsQuoting(value: string): boolean {
	// Quote if it looks like a boolean, number, null, or contains special chars
	const lowerValue = value.toLowerCase();
	if (
		lowerValue === 'true' ||
		lowerValue === 'false' ||
		lowerValue === 'null' ||
		lowerValue === 'yes' ||
		lowerValue === 'no'
	) {
		return true;
	}
	// Quote if it's a number
	if (/^-?\d+(\.\d+)?$/.test(value)) {
		return true;
	}
	// Quote if it contains colons, newlines, or starts with special chars
	if (value.includes(':') || value.includes('\n') || value.includes('#')) {
		return true;
	}
	return false;
}

/**
 * Export secrets to YAML format
 */
export function exportToYaml(secrets: Secret[]): string {
	if (secrets.length === 0) return '';

	return secrets
		.map(({ key, value }) => {
			if (yamlNeedsQuoting(value)) {
				// Escape quotes and use double quotes
				const escaped = value.replace(/"/g, '\\"');
				return `${key}: "${escaped}"`;
			}
			return `${key}: ${value}`;
		})
		.join('\n');
}

/**
 * Escape a CSV value if needed
 */
function escapeCsvValue(value: string): string {
	if (value.includes(',') || value.includes('"') || value.includes('\n')) {
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

	const rows = secrets.map(({ key, value }) => `${key},${escapeCsvValue(value)}`);
	return [header, ...rows].join('\n');
}

// =============================================================================
// PARSE FUNCTIONS
// =============================================================================

/**
 * Parse .env format (KEY=VALUE)
 */
export function parseEnv(input: string): Secret[] {
	if (!input.trim()) return [];

	const secrets: Secret[] = [];
	const lines = input.split('\n');

	for (const line of lines) {
		const trimmed = line.trim();

		// Skip empty lines and comments
		if (!trimmed || trimmed.startsWith('#')) continue;

		// Handle "export KEY=VALUE" format
		const withoutExport = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;

		// Find the first = sign
		const eqIndex = withoutExport.indexOf('=');
		if (eqIndex === -1) continue;

		const key = withoutExport.slice(0, eqIndex).trim();
		let value = withoutExport.slice(eqIndex + 1);

		// Handle quoted values
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			// Remove quotes
			value = value.slice(1, -1);
			// Unescape escaped characters for double quotes
			if (withoutExport.slice(eqIndex + 1).startsWith('"')) {
				value = value.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
			}
		} else {
			value = value.trim();
		}

		if (key) {
			secrets.push({ key, value });
		}
	}

	return secrets;
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

		// Handle quoted values
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}

		if (key) {
			secrets.push({ key, value });
		}
	}

	return secrets;
}

/**
 * Parse a CSV field, handling quotes
 */
function parseCsvField(field: string): string {
	if (field.startsWith('"') && field.endsWith('"')) {
		// Remove quotes and unescape doubled quotes
		return field.slice(1, -1).replace(/""/g, '"');
	}
	return field;
}

/**
 * Parse a CSV line, handling quoted fields with commas
 */
function parseCsvLine(line: string): string[] {
	const fields: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];

		if (char === '"') {
			if (inQuotes && line[i + 1] === '"') {
				// Escaped quote
				current += '"';
				i++;
			} else {
				inQuotes = !inQuotes;
				current += char;
			}
		} else if (char === ',' && !inQuotes) {
			fields.push(parseCsvField(current));
			current = '';
		} else {
			current += char;
		}
	}

	fields.push(parseCsvField(current));
	return fields;
}

/**
 * Parse CSV format with headers (key,value)
 */
export function parseCsv(input: string): Secret[] {
	// Normalize line endings
	const normalized = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
	const lines = normalized.split('\n').filter((line) => line.trim());

	if (lines.length === 0) {
		throw new Error('Invalid CSV: no content');
	}

	// First line is headers
	const headers = parseCsvLine(lines[0]);
	if (headers[0]?.toLowerCase() !== 'key' || headers[1]?.toLowerCase() !== 'value') {
		throw new Error('Invalid CSV: expected headers "key,value"');
	}

	const secrets: Secret[] = [];
	for (let i = 1; i < lines.length; i++) {
		const fields = parseCsvLine(lines[i]);
		if (fields.length >= 2 && fields[0]) {
			secrets.push({
				key: fields[0],
				value: fields[1] || '',
			});
		}
	}

	return secrets;
}

/**
 * Shared .env file parser and formatter for Redshift.
 *
 * Handles: comments, blank lines, export prefix, quoted values, escape sequences.
 * Used by both CLI and Web to ensure consistent .env parsing behavior.
 *
 * L2: Function-Author - Shared utility for secret import/export
 */

/**
 * Parse a .env file string into a key-value record.
 * Handles: comments, blank lines, export prefix, quoted values, escape sequences.
 */
export function parseEnvFile(content: string): Record<string, string> {
	const secrets: Record<string, string> = {};

	for (const line of content.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;

		const withoutExport = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;

		const eqIndex = withoutExport.indexOf('=');
		if (eqIndex === -1) continue;

		const key = withoutExport.slice(0, eqIndex).trim();
		if (!key || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

		const value = parseEnvValue(withoutExport.slice(eqIndex + 1));
		secrets[key] = value;
	}

	return secrets;
}

/**
 * Parse a single .env value, handling quotes and escape sequences.
 */
export function parseEnvValue(input: string): string {
	let result = input.trim();

	// Handle double-quoted strings
	if (result.startsWith('"') && result.endsWith('"')) {
		return result
			.slice(1, -1)
			.replace(/\\n/g, '\n')
			.replace(/\\r/g, '\r')
			.replace(/\\t/g, '\t')
			.replace(/\\"/g, '"')
			.replace(/\\\\/g, '\\');
	}

	// Handle single-quoted strings (no escaping)
	if (result.startsWith("'") && result.endsWith("'")) {
		return result.slice(1, -1);
	}

	// Handle inline comments (only if not quoted)
	const commentIndex = result.indexOf(' #');
	if (commentIndex !== -1) {
		result = result.slice(0, commentIndex).trim();
	}

	return result;
}

/**
 * Format a secret key-value pair for .env output (escaped, double-quoted).
 */
export function formatEnvLine(key: string, value: string): string {
	const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
	return `${key}="${escaped}"`;
}

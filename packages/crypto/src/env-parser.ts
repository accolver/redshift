/**
 * Shared .env file parser and formatter for Redshift.
 *
 * Handles: comments, blank lines, export prefix, quoted values, escape sequences.
 * Used by both CLI and Web to ensure consistent .env parsing behavior.
 *
 * L2: Function-Author - Shared utility for secret import/export
 */

export interface EnvParseIssue {
	line: number;
	message: string;
}

export interface EnvParseResult {
	secrets: Record<string, string>;
	issues: EnvParseIssue[];
}

export function parseEnvFileDetailed(content: string): EnvParseResult {
	const secrets: Record<string, string> = {};
	const issues: EnvParseIssue[] = [];
	const lines = content.split('\n');
	for (let index = 0; index < lines.length; index++) {
		const trimmed = (lines[index] ?? '').trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const withoutExport = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
		const eqIndex = withoutExport.indexOf('=');
		if (eqIndex === -1) {
			issues.push({ line: index + 1, message: 'expected KEY=value' });
			continue;
		}
		const key = withoutExport.slice(0, eqIndex).trim();
		if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
			issues.push({ line: index + 1, message: `invalid key "${key}"` });
			continue;
		}
		const rawValue = withoutExport.slice(eqIndex + 1).trim();
		if (
			(rawValue.startsWith('"') && !rawValue.endsWith('"')) ||
			(rawValue.startsWith("'") && !rawValue.endsWith("'"))
		) {
			issues.push({ line: index + 1, message: `unterminated quoted value for ${key}` });
			continue;
		}
		if (Object.hasOwn(secrets, key)) {
			issues.push({ line: index + 1, message: `duplicate key ${key}` });
			continue;
		}
		secrets[key] = parseEnvValue(rawValue);
	}
	return { secrets, issues };
}

/** Backward-compatible permissive parser. Use parseEnvFileDetailed at trust boundaries. */
export function parseEnvFile(content: string): Record<string, string> {
	return parseEnvFileDetailed(content).secrets;
}

/**
 * Parse a single .env value, handling quotes and escape sequences.
 */
export function parseEnvValue(input: string): string {
	let result = input.trim();

	// Handle double-quoted strings with a single left-to-right escape pass.
	// Chained replacements corrupt literal sequences such as `\\n` after
	// formatEnvLine first escapes the backslash.
	if (result.startsWith('"') && result.endsWith('"')) {
		return decodeDoubleQuotedValue(result.slice(1, -1));
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

function decodeDoubleQuotedValue(value: string): string {
	let decoded = '';
	for (let index = 0; index < value.length; index++) {
		const character = value[index];
		if (character !== '\\' || index + 1 >= value.length) {
			decoded += character;
			continue;
		}
		const escaped = value[++index];
		switch (escaped) {
			case 'n':
				decoded += '\n';
				break;
			case 'r':
				decoded += '\r';
				break;
			case 't':
				decoded += '\t';
				break;
			case '"':
				decoded += '"';
				break;
			case '\\':
				decoded += '\\';
				break;
			default:
				decoded += `\\${escaped}`;
		}
	}
	return decoded;
}

/**
 * Format a secret key-value pair for .env output (escaped, double-quoted).
 */
export function formatEnvLine(key: string, value: string): string {
	const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
	return `${key}="${escaped}"`;
}

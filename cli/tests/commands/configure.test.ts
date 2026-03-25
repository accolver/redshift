/**
 * Configure Command Tests
 *
 * L2: Function-Author - Tests for configure command guards
 * L5: Journey-Validator - CLI configure subcommand safety
 */

import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('configure unset guards', () => {
	it('has SENSITIVE_KEYS guard in unset case block', () => {
		const source = readFileSync(join(import.meta.dir, '../../src/main.ts'), 'utf-8');
		const unsetMatch = source.match(/case\s+'unset'[\s\S]*?break;/);
		expect(unsetMatch).toBeTruthy();
		expect(unsetMatch![0]).toContain('SENSITIVE_KEYS');
		expect(unsetMatch![0]).toContain('redshift logout');
	});
});

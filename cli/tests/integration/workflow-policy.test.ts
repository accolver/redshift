import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dir, '../../..');
const workflowPaths = [
	'.github/workflows/ci.yml',
	'.github/workflows/release.yml',
	'.github/workflows/deploy-relay.yml',
];

function readWorkflow(path: string) {
	return readFileSync(resolve(repositoryRoot, path), 'utf8');
}

describe('GitHub Actions policy', () => {
	it('pins every action and Bun version and freezes every dependency install', () => {
		for (const path of workflowPaths) {
			const workflow = readWorkflow(path);
			const actionRefs = [...workflow.matchAll(/^\s*-?\s*uses:\s*[^@\s]+@([^\s#]+)/gm)].map(
				(match) => match[1],
			);
			expect(actionRefs.length, `${path} should use at least one action`).toBeGreaterThan(0);
			for (const ref of actionRefs) {
				expect(ref, `${path} contains a mutable action reference`).toMatch(/^[0-9a-f]{40}$/);
			}
			expect(workflow).not.toContain('bun-version: latest');
			for (const install of workflow.matchAll(/bun install([^\n]*)/g)) {
				expect(install[1], `${path} contains an unlocked Bun install`).toContain(
					'--frozen-lockfile',
				);
			}
		}
	});

	it('keeps generated embeds and relay worker synchronized in CI and release gates', () => {
		for (const path of ['.github/workflows/ci.yml', '.github/workflows/release.yml']) {
			const workflow = readWorkflow(path);
			expect(workflow).toContain('git diff --exit-code -- cli/src/lib/embedded-files.ts');
			expect(workflow).toContain('bun run verify:generated');
		}
	});

	it('keeps default permissions read-only and scopes release writes to one job', () => {
		const ci = readWorkflow('.github/workflows/ci.yml');
		expect(ci).toContain('permissions:\n  contents: read');
		expect(ci).not.toContain('id-token: write');
		expect(ci).not.toContain('attestations: write');

		const release = readWorkflow('.github/workflows/release.yml');
		expect(release).toContain('permissions:\n  contents: read');
		expect(release.match(/id-token: write/g)).toHaveLength(1);
		expect(release.match(/attestations: write/g)).toHaveLength(1);
	});
});

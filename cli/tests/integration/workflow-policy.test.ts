import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dir, '../../..');
const workflowPaths = [
	'.github/workflows/ci.yml',
	'.github/workflows/release.yml',
	'.github/workflows/deploy-relay.yml',
	'.github/workflows/verify-published-release.yml',
];

function readRepositoryFile(path: string) {
	return readFileSync(resolve(repositoryRoot, path), 'utf8');
}

const readWorkflow = readRepositoryFile;

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

	it('keeps generated sources, formatting, and release-critical E2E explicit', () => {
		for (const path of ['.github/workflows/ci.yml', '.github/workflows/release.yml']) {
			const workflow = readWorkflow(path);
			expect(workflow).toContain('bun run verify:embeds');
			expect(workflow).toContain('cmp /tmp/embedded-files.ts cli/src/lib/embedded-files.ts');
			expect(workflow).toContain('bun run verify:generated');
			expect(workflow).toContain('bunx biome format cli/src packages web/src web/tests');
			for (const testPath of [
				'tests/integration/binary-cli.test.ts',
				'tests/integration/upgrade-binary-e2e.test.ts',
				'tests/integration/installer-integrity.test.ts',
				'tests/integration/nak-bunker-e2e.test.ts',
			]) {
				expect(workflow).toContain(testPath);
			}
		}
	});

	it('blocks CI and releases on root and relay dependency advisories', () => {
		const packageJson = JSON.parse(readRepositoryFile('package.json')) as {
			scripts: Record<string, string>;
		};
		expect(packageJson.scripts['audit:dependencies']).toContain('bun audit --audit-level=low');
		expect(packageJson.scripts['audit:dependencies']).toContain('relay/nosflare');
		for (const path of ['.github/workflows/ci.yml', '.github/workflows/release.yml']) {
			expect(readWorkflow(path)).toContain('bun run audit:dependencies');
		}
	});

	it('keeps releases draft until verified and withdraws failed publication', () => {
		const releasePlease = JSON.parse(readRepositoryFile('release-please-config.json')) as {
			packages: Record<string, { draft?: boolean }>;
		};
		expect(releasePlease.packages['.']?.draft).toBe(true);
		const release = readWorkflow('.github/workflows/release.yml');
		expect(release).toContain('name: Publish the verified draft release');
		expect(release).toContain('ref: ${{ github.sha }}');
		expect(release).not.toContain('ref: ${{ needs.release-please.outputs.tag_name }}');
		expect(release).toContain('--draft=false');
		expect(release).toContain('name: Withdraw Failed Release');
		expect(release).toContain('--latest=false');
	});

	it('verifies public release installation on both Linux architectures', () => {
		const packageJson = JSON.parse(readRepositoryFile('package.json')) as {
			scripts: Record<string, string>;
		};
		expect(packageJson.scripts['test:release:containers']).toContain(
			'scripts/test-release-containers.sh',
		);
		const release = readWorkflow('.github/workflows/release.yml');
		expect(release).toContain('name: Verify Published Release (${{ matrix.platform }})');
		expect(release).toContain('scripts/test-release-containers.sh');
		expect(release).toContain('platform: linux/amd64');
		expect(release).toContain('platform: linux/arm64');
		expect(release).toContain('runner: ubuntu-24.04-arm');
		expect(release).toContain('attestations: read');

		const manualVerification = readWorkflow('.github/workflows/verify-published-release.yml');
		expect(manualVerification).toContain('workflow_dispatch:');
		expect(manualVerification).toContain('scripts/test-release-containers.sh');
	});

	it('documents the immutable GitHub release ceremony and rollback', () => {
		const agents = readRepositoryFile('AGENTS.md');
		for (const requiredText of [
			'## Full GitHub Release Procedure',
			'gh pr checks',
			'gh run watch',
			'gh attestation verify',
			'Never replace published release assets',
		]) {
			expect(agents).toContain(requiredText);
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

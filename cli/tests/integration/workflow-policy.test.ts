import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dir, '../../..');
const workflowPaths = [
	'.github/workflows/ci.yml',
	'.github/workflows/release.yml',
	'.github/workflows/deploy-relay.yml',
	'.github/workflows/fuzz.yml',
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

	it('keeps generated sources, formatting, typechecks, and release-critical E2E explicit', () => {
		const ownedSourceScope =
			'cli/src cli/scripts cli/tests packages tests/helpers web/src web/tests relay/nosflare/src relay/nosflare/tests';
		for (const path of ['.github/workflows/ci.yml', '.github/workflows/release.yml']) {
			const workflow = readWorkflow(path);
			expect(workflow).toContain('bun run verify:embeds');
			expect(workflow).toContain('cmp /tmp/embedded-files.ts cli/src/lib/embedded-files.ts');
			expect(workflow).toContain('bun run verify:generated');
			expect(workflow).toContain(`bunx biome format ${ownedSourceScope}`);
			expect(workflow).toContain('bun run typecheck:packages');
			for (const testPath of [
				'tests/integration/binary-cli.test.ts',
				'tests/integration/upgrade-binary-e2e.test.ts',
				'tests/integration/installer-integrity.test.ts',
				'tests/integration/nak-bunker-e2e.test.ts',
				'tests/integration/relay-publication-recovery.test.ts',
				'tests/integration/encrypted-backup-restore.test.ts',
				'tests/integration/authenticated-secret-history.test.ts',
			]) {
				expect(workflow).toContain(testPath);
			}
			expect(workflow).toContain('Browser gates leaked a repository workerd process');
		}
	});

	it('runs bounded required and replayable extended fuzz gates', () => {
		const ci = readWorkflow('.github/workflows/ci.yml');
		const extended = readWorkflow('.github/workflows/fuzz.yml');
		const productionGate = readRepositoryFile('scripts/verify-production-readiness.sh');
		expect(ci).toContain('bun run test:fuzz');
		expect(productionGate).toContain('bun run test:fuzz');
		expect(extended).toContain('schedule:');
		expect(extended).toContain('workflow_dispatch:');
		expect(extended).toContain('permissions:\n  contents: read');
		expect(extended).toContain('REDSHIFT_FUZZ_SEED="$seed"');
		expect(extended).toContain('REDSHIFT_FUZZ_RUNS="$runs"');
		expect(extended).toContain('REDSHIFT_FUZZ_TIME_MS=120000');
		expect(extended).toContain('seed="${REQUESTED_SEED:-$GITHUB_RUN_NUMBER}"');
		expect(extended).toContain('Invalid fuzz seed');
		expect(extended).toContain("fuzzParameters('workflow input validation')");
		expect(extended.indexOf('Invalid fuzz seed')).toBeLessThan(
			extended.indexOf('tee fuzz-replay.txt'),
		);
		expect(extended).toContain('fuzz-replay.txt');
		expect(extended).toContain('if: always()');
		expect(extended).not.toContain('secrets.');
	});

	it('verifies generated relay bytes without requiring a clean worktree', () => {
		const relayPackage = JSON.parse(readRepositoryFile('relay/nosflare/package.json')) as {
			scripts: Record<string, string>;
		};
		const verifyGenerated = relayPackage.scripts['verify:generated'];
		expect(verifyGenerated).toContain('cmp');
		expect(verifyGenerated).not.toContain('git diff');
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

	it('keeps releases draft until verified and withdraws any non-successful published certification', () => {
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
		for (const job of [
			'verify-release',
			'build-binaries',
			'publish-release',
			'verify-published-release',
			'verify-published-macos',
		]) {
			expect(release).toContain(`needs.${job}.result != 'success'`);
		}
		expect(release).toContain('--latest=false');
	});

	it('verifies public release installation on every supported native architecture', () => {
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
		expect(release).toContain('verify-published-macos:');
		expect(release).toContain('platform: darwin/x64');
		expect(release).toContain('platform: darwin/arm64');
		expect(release).toContain('runner: macos-15-intel');
		expect(release).toContain('runner: macos-14');
		expect(release).toContain('tests/release/container-entrypoint.sh');
		expect(release).toContain('needs.verify-published-macos.result');
		expect(release).toContain('attestations: read');

		const manualVerification = readWorkflow('.github/workflows/verify-published-release.yml');
		expect(manualVerification).toContain('workflow_dispatch:');
		expect(manualVerification).toContain('resolve-release:');
		expect(manualVerification).toContain('^v(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)$');
		expect(manualVerification).toContain('git/ref/tags/$TAG');
		expect(manualVerification).toContain('releases/tags/$TAG');
		expect(manualVerification).toContain('commits/$TAG');
		expect(manualVerification).not.toContain('commits/${{ inputs.tag }}');
		expect(manualVerification).toContain('ref: ${{ inputs.tag }}');
		expect(manualVerification).toContain('git rev-parse HEAD');
		expect(manualVerification).toContain('needs.resolve-release.outputs.source_digest');
		expect(manualVerification).toContain('scripts/test-release-containers.sh');
		expect(manualVerification).toContain('verify-macos:');
		expect(manualVerification).toContain('platform: darwin/x64');
		expect(manualVerification).toContain('platform: darwin/arm64');
		expect(manualVerification).toContain('tests/release/container-entrypoint.sh');
		expect(manualVerification).not.toContain('contents: write');
		expect(manualVerification).not.toContain('gh release edit');
	});

	it('keeps relay credentials out of credential-free preflight', () => {
		const workflow = readWorkflow('.github/workflows/deploy-relay.yml');
		const preflight = workflow.slice(
			workflow.indexOf('  preflight:'),
			workflow.indexOf('  deploy:'),
		);
		expect(preflight).toContain('bun install --frozen-lockfile');
		expect(preflight).not.toContain('environment: production');
		expect(preflight).not.toContain('CLOUDFLARE_API_TOKEN');
		expect(preflight).not.toContain('CLOUDFLARE_ACCOUNT_ID');
		expect(workflow).toContain('needs: preflight');
		expect(workflow).toContain("github.event_name == 'workflow_dispatch'");
		expect(workflow).toContain("vars.MANAGED_RELAY_DEPLOY_APPROVED == 'true'");
		expect(workflow).toContain('source_commit:');
		expect(workflow).toContain('git rev-parse HEAD');
		const deploymentStep = workflow.slice(workflow.indexOf('- name: Deploy declared worker'));
		expect(deploymentStep).toContain('CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}');
		expect(deploymentStep).toContain('CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}');
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

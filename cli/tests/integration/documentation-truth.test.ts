import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dir, '../../..');
const read = (path: string) => readFileSync(resolve(repositoryRoot, path), 'utf8');

const requiredText: Array<[string, string[]]> = [
	['README.md', ['v0.14.0', '~/.local/bin/redshift', 'bounded history']],
	['ROADMAP.md', ['certified v0.14.0', 'managed deployment evidence']],
	['docs/resilience-next.md', ['shipped in v0.14.0', 'authenticated-secret-history-evidence.md']],
	['cli/README.md', ['v0.14.0', 'github.com/fiatjaf/nak@v0.19.7']],
	[
		'web/src/routes/docs/installation/+page.svelte',
		['Linux and macOS', '~/.local/bin/redshift', 'v0.14.0'],
	],
	['web/src/routes/docs/quickstart/+page.svelte', ['redshift.yaml', '--raw']],
	['spec.md', ['Legacy non-normative PRD', 'applesauce-core/event-factory']],
	['openspec/specs/secret-history/spec.md', ['bounded owner-authenticated history']],
	['relay/README.md', ['development managed-relay candidate', 'No Redshift Cloud subscription']],
	['.telos/TELOS.md', ['Doppler-inspired', 'certified individual-product v0.14.0']],
	['openspec/project.md', ['Doppler-inspired', 'no paid service or production endpoint']],
	[
		'web/src/routes/pricing/+page.svelte',
		['not launched', 'unapproved $5/month planning hypothesis'],
	],
	['web/src/routes/+page.svelte', ['Doppler-inspired CLI', 'documented Redshift command contract']],
	['web/static/llms.txt', ['Doppler-inspired', 'Linux and macOS', 'NIP-46']],
	['web/src/lib/blog/posts.ts', ['Doppler-inspired', 'Not launched']],
	[
		'web/src/routes/docs/auth/bunker/+page.svelte',
		['individual NIP-46', 'github.com/fiatjaf/nak@v0.19.7'],
	],
	[
		'openspec/changes/add-cloud-pricing/design.md',
		['Unapproved design hypothesis', 'managed-production evidence'],
	],
	['openspec/changes/add-cloud-pricing/tasks.md', ['Approval Gate', 'Do not implement']],
];

const forbiddenText: Array<[string, string[]]> = [
	['README.md', ['currently published `v0.10.0`']],
	['ROADMAP.md', ['current development candidate']],
	['docs/resilience-next.md', ['implementation candidate', 'Implemented candidate behavior']],
	['cli/README.md', ['github.com/fiatjaf/nak@latest']],
	[
		'web/src/routes/docs/installation/+page.svelte',
		['Windows (WSL)', '~/.redshift/bin', 'redshift v0.1.0'],
	],
	[
		'web/src/routes/docs/quickstart/+page.svelte',
		['bun add -g redshift', '.redshift.json', 'NIP-07 Browser Extension (recommended)'],
	],
	['openspec/specs/secret-history/spec.md', ['TBD - created by archiving']],
	['relay/README.md', ['./deploy.sh YOUR_CLOUDFLARE_API_TOKEN', 'echo $CLOUDFLARE_API_TOKEN']],
	['.telos/TELOS.md', ['drop-in replacement', 'Doppler-compatible CLI']],
	['openspec/project.md', ['Doppler-compatible DX']],
	['web/src/routes/pricing/+page.svelte', ['coming soon']],
	['web/src/lib/constants.ts', ["cta: 'Coming Soon'"]],
	['web/src/routes/+page.svelte', ['Doppler Compatible CLI', 'Drop-in replacement']],
	[
		'web/static/llms.txt',
		['Doppler-compatible', 'drop-in replacement', '/tutorial', 'bun add -g redshift', 'or NIP-07'],
	],
	[
		'web/src/lib/blog/posts.ts',
		['drop-in replacement', '<td>Redshift Cloud</td>', '<td>Coming soon</td>'],
	],
	['web/src/routes/docs/why-redshift/+page.svelte', ['Partial/Coming soon']],
	[
		'web/src/routes/docs/auth/bunker/+page.svelte',
		[
			'Redshift Teams',
			'Enterprise SSO',
			'production-ready bunker',
			'Enterprise-ready',
			'github.com/fiatjaf/nak@latest',
			'redshift.dev/install',
		],
	],
	[
		'openspec/changes/add-cloud-pricing/design.md',
		['Provide managed relay with 99.5% SLA', '7-day retention enforced', 'Week 6: Public launch'],
	],
	[
		'openspec/changes/add-cloud-pricing/tasks.md',
		['Implement 99.5% SLA tracking dashboard', 'Implement 7-day retention display note'],
	],
	[
		'cli/src/lib/embedded-files.ts',
		['Doppler Compatible CLI', 'Drop-in replacement', 'bun add -g redshift', 'Redshift Teams'],
	],
];

describe('documentation product truth', () => {
	for (const [path, values] of requiredText) {
		it(`${path} states current supported truth`, () => {
			const content = read(path);
			for (const value of values)
				expect(content, `${path} should contain ${value}`).toContain(value);
		});
	}

	for (const [path, values] of forbiddenText) {
		it(`${path} omits unsupported guidance`, () => {
			const content = read(path);
			for (const value of values)
				expect(content, `${path} should omit ${value}`).not.toContain(value);
		});
	}
});

# Changelog

## [0.14.0](https://github.com/accolver/redshift/compare/v0.13.0...v0.14.0) (2026-07-11)


### ⚠ BREAKING CHANGES

* **web:** Project schema changed from 'name' to 'slug' + 'displayName'. Old projects will not be visible in the UI.

### Features

* add cross-platform build scripts and release automation ([7adb58a](https://github.com/accolver/redshift/commit/7adb58acf03452db76f998e4c9cee65f8ec0c606))
* add fuzzy search for secrets with space-to-underscore matching ([d86013b](https://github.com/accolver/redshift/commit/d86013b35b361674dcfc09cb43aa4e06561880ca))
* add InlineCode component for consistent inline code styling ([fd7f127](https://github.com/accolver/redshift/commit/fd7f1271e542f007d9a992b3d9776465ff99dc60))
* add NIP-07/NIP-46 signer support for Gift Wrap encryption ([92e727c](https://github.com/accolver/redshift/commit/92e727c69c7dbf35619cb94e73836d721090983e))
* add OpenClaw skill for Redshift CLI ([d074aa7](https://github.com/accolver/redshift/commit/d074aa76c1a9b9e6b00c5c848b0e70d389ca37aa))
* add OpenSpec framework for spec-driven development ([c8baab6](https://github.com/accolver/redshift/commit/c8baab6feb1287ed92d947841d9dca6f19bcce27))
* add rate limiting with exponential backoff for relay connections ([df0d891](https://github.com/accolver/redshift/commit/df0d8910f53afc0e06d3acb3e24e8e8767d03169))
* **admin:** add missing secrets, multi-env save, and search highlight ([8590465](https://github.com/accolver/redshift/commit/8590465c64c9cc57de0dffcd383b34fda7fef725))
* **auth:** add local nsec signing and NIP-46 bunker support ([134a690](https://github.com/accolver/redshift/commit/134a69044b37708692d8228438213deb092e7fcd))
* **backup:** add encrypted local backup and restore ([#43](https://github.com/accolver/redshift/issues/43)) ([db1ec0b](https://github.com/accolver/redshift/commit/db1ec0b2aa5ffd3856bd71c9980c4eddf7367925))
* **branding:** replace Svelte logo with custom Redshift chevron icon ([44dbfa4](https://github.com/accolver/redshift/commit/44dbfa468d1ddebd613c6a31b368a14001468e8a))
* **cli:** add --environment/-e as alias for --config/-c ([2a43a11](https://github.com/accolver/redshift/commit/2a43a11bcc8bb360b612e2e6340c5c27537feec5))
* **cli:** add binary integration tests and interactive project fetching ([8216903](https://github.com/accolver/redshift/commit/82169037184f267d78c87881165c1650406f2de1))
* **cli:** add Doppler-compatible CLI framework with declarative command structure ([f2a58b5](https://github.com/accolver/redshift/commit/f2a58b5c3704c09a9ce0c8045cd3885a1fcac660))
* **cli:** add NIP-46 bunker prototype ([10c7cd7](https://github.com/accolver/redshift/commit/10c7cd7559987072bbe5e3364d3bda8696f1995e))
* **cli:** add secrets upload command for .env file import ([b08525e](https://github.com/accolver/redshift/commit/b08525e322cd7dd1d7c122d549e67cd32b14735f))
* **cli:** add typed errors, keychain storage, and input validation ([05338b7](https://github.com/accolver/redshift/commit/05338b76da9f9a38ce028dde37ab7e11256ab747))
* **cli:** add upgrade command, hidden nsec input, and secrets options ([b4a13ad](https://github.com/accolver/redshift/commit/b4a13ad4df9d13f5a40533c99c33aa58cf9137bc))
* **cli:** document relay resilience ([6debf01](https://github.com/accolver/redshift/commit/6debf01c6377ff469845120ad5c50fe8637c84b6))
* **cli:** embed SvelteKit admin UI into binary ([82f7139](https://github.com/accolver/redshift/commit/82f71394612c3746dc6e3633dab25c0dd8974737))
* **cli:** implement Nostr-based secret management CLI ([b068348](https://github.com/accolver/redshift/commit/b068348c07c0ee8dd314ce39c5cd6f40549accd1))
* **cli:** show QR code for Nostr Connect login ([254e237](https://github.com/accolver/redshift/commit/254e23738e2a01f7ca1fd4950303034409d627ec))
* **cli:** use shorter environment slugs as defaults ([17cc359](https://github.com/accolver/redshift/commit/17cc3596dfe79df1e9635d5003102c3107233402))
* **crypto:** add shared NIP-59 Gift Wrap crypto package ([c3566eb](https://github.com/accolver/redshift/commit/c3566ebc543c67ef1014a451af88703acc4662c5))
* **docs:** add home link to sidebar navigation ([1a53769](https://github.com/accolver/redshift/commit/1a5376917405c0e903b067c86be65d5e02469efe))
* **docs:** add linkable headers and Prism.js code highlighting ([90996d8](https://github.com/accolver/redshift/commit/90996d86c254d950ce1868c4279326154b54950a))
* **docs:** add mobile navigation with shadcn Sheet component ([c06b971](https://github.com/accolver/redshift/commit/c06b9713044ecfe3c033e20a41120251e102465a))
* **relay:** add Lightning address for zap payments ([8e9c369](https://github.com/accolver/redshift/commit/8e9c3693a6b443354a52f04efd00a8cb5a171b6f))
* **relay:** add Nosflare relay with Cloud tier (12,121 sats) ([ebc8fe7](https://github.com/accolver/redshift/commit/ebc8fe7f96abcfa7e4abf4b8c73e0bc00646fff2))
* **relay:** auto-detect paid users and show subscriber badge ([0b5759d](https://github.com/accolver/redshift/commit/0b5759dc479b77cbb814df99d21d76a533276053))
* replace OpenClaw skill with universal Agent Skills standard ([4a5614f](https://github.com/accolver/redshift/commit/4a5614f74f56497fc7c7b6761431fa43a2acfe3c))
* **resilience:** add relay publication recovery ([#41](https://github.com/accolver/redshift/issues/41)) ([a1c0378](https://github.com/accolver/redshift/commit/a1c03789f3e72266fdd3ebb7dcae0d6705110ed2))
* **security:** encrypt nsec with non-extractable AES-GCM key before storage ([aabc8b9](https://github.com/accolver/redshift/commit/aabc8b9821997dbddef564de83153393a1bfb9b7))
* **seo:** add comprehensive SEO meta tags, sitemap, and structured data ([4fe72ff](https://github.com/accolver/redshift/commit/4fe72ff2ccbc506f61359bb4c4b7d30d3aade44d))
* **seo:** add llms.txt for LLM-friendly documentation ([06ae297](https://github.com/accolver/redshift/commit/06ae297d97a82e0f36de9f0caaa75df58a0642d9))
* support batch secrets in multi-env save modal ([bd64e7c](https://github.com/accolver/redshift/commit/bd64e7c119ab0c48f63a71eab184eede7ef64f07))
* **web:** add blog with 12 SEO-optimized articles ([c86ee49](https://github.com/accolver/redshift/commit/c86ee49fbc6f947b6ddcaf2480b0ecb5ecdafb26))
* **web:** add Cloud tier badge to admin navbar ([728a02b](https://github.com/accolver/redshift/commit/728a02b2edef103b2d7eb144d661896dfa20df21))
* **web:** add dashboard enhancements, delete functionality, and global search ([9818ae9](https://github.com/accolver/redshift/commit/9818ae90bcb665f729bd401a14e11cb7dcc146d9))
* **web:** add environment slug to URL path for bookmarkable links ([8a41887](https://github.com/accolver/redshift/commit/8a41887e470d976a2a49604f38dd235df428ef0d))
* **web:** add floating page title in docs mobile header on scroll ([cc36805](https://github.com/accolver/redshift/commit/cc3680558d1140745c4261ec23a519f6ea8b6ed1))
* **web:** add immutable project slug for CLI compatibility ([dff71ad](https://github.com/accolver/redshift/commit/dff71ade438f996c709b46690796e06def837994))
* **web:** add inline editing and status tracking for secrets ([58dac2e](https://github.com/accolver/redshift/commit/58dac2eed1091fdf49ed7dcab27a26b5c3da3e3c))
* **web:** add login dialog with NIP-07, nsec, and bunker auth options ([2007407](https://github.com/accolver/redshift/commit/200740798a223a9fccbfe616dbd0a188d1df14af))
* **web:** add mobile responsive layout, export/import modals, and copy feedback ([507f23d](https://github.com/accolver/redshift/commit/507f23d614387c6c1eaac995e8b2573ab794016e))
* **web:** add PNG logo assets and favicon ([b34d4d1](https://github.com/accolver/redshift/commit/b34d4d1b1a905af75fbc9261d1c89d28c54aead7))
* **web:** add pricing page with tiered plans ([8fe8bba](https://github.com/accolver/redshift/commit/8fe8bba783f93fd516b535a18de31b3f8a680b65))
* **web:** add reusable CodeBlock component with copy button ([7f3288a](https://github.com/accolver/redshift/commit/7f3288acc3635e41d8638ebd8335a69dbefeafcb))
* **web:** add scroll animations and fix secrets sorting ([c1417f5](https://github.com/accolver/redshift/commit/c1417f5cb9a78decd8210f061c5064039fe6cd6c))
* **web:** add svelte-motion animations to admin dashboard ([dce37c5](https://github.com/accolver/redshift/commit/dce37c57bd2d90d60cdf2065afa17160e6e9c100))
* **web:** auto-connect on page refresh for project routes ([3526f81](https://github.com/accolver/redshift/commit/3526f81ca239954dd818c8c4e9b54a5a6d9ef56c))
* **web:** implement NIP-59 Gift Wrap encryption for secrets ([ab12567](https://github.com/accolver/redshift/commit/ab12567a1fd45512370cc3aeb0321c4c04e3598a))
* **web:** implement SvelteKit admin dashboard with Nostr auth ([43502b2](https://github.com/accolver/redshift/commit/43502b29e8a2ca6533bb1183fd372a178fbce082))
* **web:** improve secrets UX with global save, unsaved warning, and animations ([11cb87c](https://github.com/accolver/redshift/commit/11cb87c3bcaedda8bca1a5f7394692ed8109d948))
* **web:** integrate managed relay for Cloud tier subscribers ([5a4fb88](https://github.com/accolver/redshift/commit/5a4fb88c808d1ed37bc34f3e23d9e0faeb86b6c2))
* **web:** integrate shared crypto package for NIP-59 encryption ([963dce6](https://github.com/accolver/redshift/commit/963dce67afaa276c99d0b7fe49e0f2ef970a8503))
* **web:** redesign project page with Doppler-style secrets UI ([86fc97a](https://github.com/accolver/redshift/commit/86fc97a960432e67e087c03206d1bb535db72a79))
* **web:** use human-friendly project names in d-tags for CLI compatibility ([9d74bfd](https://github.com/accolver/redshift/commit/9d74bfdbbc6de8f50045351b1e037f2fd67ea30b))
* **web:** use project slug instead of id in URLs ([6ab7d9b](https://github.com/accolver/redshift/commit/6ab7d9b3efa87346c798f562a5fb7fbaecb8ce4c))


### Bug Fixes

* **a11y:** remove autofocus attributes to fix accessibility warnings ([16c5f3d](https://github.com/accolver/redshift/commit/16c5f3d6e82fa917ac1d59439dd6f8678b65c713))
* add cursor-pointer to dialog close button ([a29b1df](https://github.com/accolver/redshift/commit/a29b1df59aabde79e5dec887413e4bcec317ff81))
* add missing CodeBlock icon imports, YAML support, and correct Kind number ([f1ca42d](https://github.com/accolver/redshift/commit/f1ca42d3cc141596fd2548c91890d63224e8e640))
* audit remediation — keychain for bunker keys, relay types, edge-case tests ([0fdbc42](https://github.com/accolver/redshift/commit/0fdbc42a715e64f2a9542910fc95888777983296))
* **build:** add favicon.svg to static and remove missing apple-touch-icon ref ([7486aef](https://github.com/accolver/redshift/commit/7486aef183451a891a3a228464f718214e6e456f))
* **ci:** cross-compile macOS binaries from Linux for faster releases ([c9c48bc](https://github.com/accolver/redshift/commit/c9c48bcb3f06bf5555cd1e7e63444c1dcd4954b7))
* **ci:** skip relay integration tests and fix workspace protocol ([dd18363](https://github.com/accolver/redshift/commit/dd18363d44218f73ac657ee5ed08d219335ca390))
* **cli:** add timing tolerance to flaky rate limiter test ([fa5e685](https://github.com/accolver/redshift/commit/fa5e685f1d8f1eab6a71213c5b8204da0f35b273))
* **cli:** handle component-prefixed version tags in upgrade command ([42009a2](https://github.com/accolver/redshift/commit/42009a22afdfdbf49a0fb4fd83d23f7cb8dba6ca))
* **cli:** lazy-load VERSION, exec, and networkInterfaces in serve command ([c9a7f76](https://github.com/accolver/redshift/commit/c9a7f769ff519923c057ad958f392a8a3d7dcfe8))
* **cli:** make rate limiter tests more reliable in CI ([faa07ba](https://github.com/accolver/redshift/commit/faa07ba6eacc340eb1e377d47faa0b7a4f94f185))
* **cli:** read version from package.json and set up Release Please ([258c931](https://github.com/accolver/redshift/commit/258c93191e241acc7b419fb83c02d3ed743ac8bb))
* close bunker pool with actual relay URLs ([7c70d17](https://github.com/accolver/redshift/commit/7c70d177d0e191069759a168a175e48ca7ea1805))
* complete production readiness follow-up ([#35](https://github.com/accolver/redshift/issues/35)) ([28a6299](https://github.com/accolver/redshift/commit/28a6299abb68cdcee3241abc9326518b70c9547a))
* comprehensive security audit — crypto verification, key zeroing, dead code removal, shared rate-limiter, test coverage ([f848511](https://github.com/accolver/redshift/commit/f8485114c55baa6cf6399073e187fd7dcec09977))
* comprehensive security, performance, and code quality audit (65 findings) ([def1c79](https://github.com/accolver/redshift/commit/def1c79f3f108654258a88d5a95e8af5c289e6d3))
* comprehensive security, performance, and code quality audit (65 findings) ([#15](https://github.com/accolver/redshift/issues/15)) ([424d73c](https://github.com/accolver/redshift/commit/424d73c869ac931c5cba037271f525ad80c598cb))
* correct test runner configuration and skip unreachable relay tests ([f739ad4](https://github.com/accolver/redshift/commit/f739ad43307fafef771eb24c46fc0a6baa75493b))
* cover bunker-backed CLI workflows ([33d91c0](https://github.com/accolver/redshift/commit/33d91c0e737c7113b2715be78e53288ca08f822d))
* delegate fetchSecrets to fetchAllSecrets cache ([3bfebe3](https://github.com/accolver/redshift/commit/3bfebe3ba65f56e11d646f0834ce6411ce8f44db))
* **docs:** remove unavailable npm/brew install instructions ([6509f56](https://github.com/accolver/redshift/commit/6509f5623c2e5ebbb56fa18875b835c89b5f7b6c))
* ensure web dependencies are installed before build ([3450b30](https://github.com/accolver/redshift/commit/3450b304d0834f08617cb773e77727994ca5d08e))
* generate clientSecretKey for env-based bunker auth ([6855161](https://github.com/accolver/redshift/commit/685516181f87b3f14685a2932f46e00b6540858c))
* guard configure unset against sensitive keys ([bed6234](https://github.com/accolver/redshift/commit/bed6234aac698a8e82daf8527aef4b7e7adbfaa0))
* harden crypto, CLI, and web security ([0f2e3c6](https://github.com/accolver/redshift/commit/0f2e3c61a7056116992a0c759e491e29d8bceac8))
* harden production readiness ([13c6942](https://github.com/accolver/redshift/commit/13c69424f9d3992c87fb0af3d0650de4f02e13e6))
* normalize secret keys to uppercase in CLI ([39180f5](https://github.com/accolver/redshift/commit/39180f594f6b6bf701c22972f052738875457d34))
* persist bunker client key fallback ([86f8bf0](https://github.com/accolver/redshift/commit/86f8bf080a13008f4c5444074a4564a00d85e924))
* prevent infinite effect loops in admin layout and secrets store ([25af225](https://github.com/accolver/redshift/commit/25af22523321f0486374afe1cacc2151949a9ab3))
* **relay:** prevent layout shift on landing page logo ([c2fe42c](https://github.com/accolver/redshift/commit/c2fe42cb7ac169dd4f4f16ef2803d54f155c6998))
* **relay:** update payment recipient to Minibits wallet npub ([9fde700](https://github.com/accolver/redshift/commit/9fde7000d5fdab445ef215e3881c6911a119e633))
* **release:** certify draft artifacts before publication ([#38](https://github.com/accolver/redshift/issues/38)) ([187aa63](https://github.com/accolver/redshift/commit/187aa63b1d5cfa601505b990e6b84633e37f2e19))
* resolve TypeScript exactOptionalPropertyTypes errors ([01fdade](https://github.com/accolver/redshift/commit/01fdadec84ab64aa2d20e23b425b4c32b76fc0ad))
* **security:** replace CSP wildcard subdomains with exact relay hostnames ([66f9fce](https://github.com/accolver/redshift/commit/66f9fce2f84dbf77b84cc7a9529487d615c8a120))
* **security:** zero private key on CLI disconnect ([5306b5b](https://github.com/accolver/redshift/commit/5306b5b24db9599f7930eac74ee78d6c24eb8dfc))
* show concise bunker connection errors ([32e2c18](https://github.com/accolver/redshift/commit/32e2c1888cbe32108b80f15d8a40868d1a96e99f))
* **test:** add afterEach cleanup and fix timing tolerances ([2d1c841](https://github.com/accolver/redshift/commit/2d1c8411b42a1b7cfe1ce784fc5677fd33bb72f8))
* **test:** add tolerance for timing-sensitive rate limiter test ([df71adb](https://github.com/accolver/redshift/commit/df71adb0a63a25940505617837b930f8471d0abe))
* timeout bunker reconnect attempts ([02bcfce](https://github.com/accolver/redshift/commit/02bcfced5b136e2436a171b985c43a1e23261fb7))
* **ui:** add spacing between navbar and hero section ([6153b39](https://github.com/accolver/redshift/commit/6153b39ed64353a3a055564846edebddf490d7b7))
* **ui:** improve mobile layout and inline editing for missing secrets ([37a44ca](https://github.com/accolver/redshift/commit/37a44ca9edb59909dde7eb022d73a2663473acfa))
* **ui:** mobile navbar overflow, scroll bug, and add secret search ([e32de0f](https://github.com/accolver/redshift/commit/e32de0f84252ff11cf9f803e052c1c315bb456cb))
* update GitHub repo URLs to accolver/redshift ([9a67d71](https://github.com/accolver/redshift/commit/9a67d7158aad38a7bc4cf9cd9eedb1bd47b43014))
* **web:** add @redshift/crypto to Vite optimizeDeps ([09d47a7](https://github.com/accolver/redshift/commit/09d47a7b2027e4cc3b3b3b9120ea4756e3c186e2))
* **web:** add apple-touch-icon for iOS home screen ([17c0c4a](https://github.com/accolver/redshift/commit/17c0c4a3db8eaf00b15fd9f4d6d48686a96a8049))
* **web:** add color-scheme meta tag for dark mode ([4baba85](https://github.com/accolver/redshift/commit/4baba8574f814a65e906c35ee7ad77a3214c8efb))
* **web:** add missing @sveltejs/adapter-cloudflare dependency ([b687784](https://github.com/accolver/redshift/commit/b687784acfe258ee076c7e1b43dbbf140d829bfe))
* **web:** add timing tolerance to all rate limiter tests for CI ([ce5033c](https://github.com/accolver/redshift/commit/ce5033c33f2dd78a235f6075230f67f6bbe58a25))
* **web:** add tolerance to rate limiter timing test for CI ([db03ed2](https://github.com/accolver/redshift/commit/db03ed29b6a5a73d1ca0df13bfd6a9d585f68629))
* **web:** adjust DocsPage header styling ([50ca213](https://github.com/accolver/redshift/commit/50ca213e3c9af36d10726098164d8da8b077b074))
* **web:** align homepage CLI login preview ([ba2e559](https://github.com/accolver/redshift/commit/ba2e559667149f40fde6c6f1715c29d5cb261462))
* **web:** align pricing features with spec and Telos framework ([d2a02c1](https://github.com/accolver/redshift/commit/d2a02c14cb71b5ac5e656ece79f67692aad68acf))
* **web:** allow Cloudflare beacon under CSP ([23221c0](https://github.com/accolver/redshift/commit/23221c0c226061c127c723ae85f4ed982454a75e))
* **web:** autofocus key input when adding new secret ([2f73f22](https://github.com/accolver/redshift/commit/2f73f22fdddea77c15a5809715d7eb8a1c63d87e))
* **web:** change const $state to let for reassigned variables ([4881a4c](https://github.com/accolver/redshift/commit/4881a4c0181e99af8b103412f67e14881e4ff3d5))
* **web:** change save error banner from error to warning style ([a62bfa4](https://github.com/accolver/redshift/commit/a62bfa4a2464eebd0a55e9181acd5f07a567d24c))
* **web:** correct CLI commands and prevent table horizontal scrolling ([df7510f](https://github.com/accolver/redshift/commit/df7510ff4451f3a3edd3b2f57e615fd36393385a))
* **web:** correct CLI references and rewrite blog prose ([ed705df](https://github.com/accolver/redshift/commit/ed705dfce31c98e7a97113422cd828c2a911a0ac))
* **web:** display Cloud tier pricing as sats one-time payment ([6091878](https://github.com/accolver/redshift/commit/6091878d689ef6e1d0e7cdb678acbe7a0b73c2ea))
* **web:** eliminate horizontal scrolling on docs pages ([d002a26](https://github.com/accolver/redshift/commit/d002a26297b622aeb9880725d43610585a1bf93f))
* **web:** fix global search navigation URL and add arrow key support ([202b9c1](https://github.com/accolver/redshift/commit/202b9c1df829b59aa5bf5ae2201e92e277122c05))
* **web:** hide add secret row immediately when saving ([09bb1ea](https://github.com/accolver/redshift/commit/09bb1ea02acf755b5befa1cb7a2d7a5eac653c09))
* **web:** improve accuracy of relay legal pages ([b8c70ae](https://github.com/accolver/redshift/commit/b8c70ae49134f3c438564dde11d2483da11ebba9))
* **web:** improve Cloud badge readability and position ([419116f](https://github.com/accolver/redshift/commit/419116f69699ba88e0681a850ab701ca230f2047))
* **web:** improve install command contrast in CLI Quick Reference ([b9724a4](https://github.com/accolver/redshift/commit/b9724a4ec48f0e7ff9af1ee4f6757321b1d807f1))
* **web:** improve lighthouse and type health ([bc13191](https://github.com/accolver/redshift/commit/bc131911f8feb83642fc12b395bfc95a9772fc2e))
* **web:** improve terminal preview text contrast on homepage ([2713f99](https://github.com/accolver/redshift/commit/2713f9998ba879ba70badf587e5296d6ccd1bf53))
* **web:** improve test infrastructure for browser globals ([74b2b38](https://github.com/accolver/redshift/commit/74b2b3886ace72ed962d58c0666177f82139a223))
* **web:** include project slug in CLI hint for add environment modal ([356f3ae](https://github.com/accolver/redshift/commit/356f3ae72536cf7a8df55ff03b2ba8a5ca5898bf))
* **web:** match admin navbar spacing to public navbar ([41aabf6](https://github.com/accolver/redshift/commit/41aabf699bb15c4f1de44c297c8332080e56b764))
* **web:** move _headers to web root for Cloudflare adapter ([f2dff45](https://github.com/accolver/redshift/commit/f2dff45d7315b18da93f37b29150976c78a7ca95))
* **web:** normalize environment slug input and improve CLI preview ([cdc43cb](https://github.com/accolver/redshift/commit/cdc43cbf13be05b383ffff10944207a0331af75f))
* **web:** remove crypto tests from web - use pure logic tests only ([36a5b71](https://github.com/accolver/redshift/commit/36a5b71f34357ef4b1c2c921e7705c3711f2282d))
* **web:** remove relay.primal.net and add publish timeout ([bfbd219](https://github.com/accolver/redshift/commit/bfbd21992a64840f3410eb5da82fa53b52649dd6))
* **web:** remove rounded corners from logo assets ([d968ba5](https://github.com/accolver/redshift/commit/d968ba5d301dcc5127e0506fca1ea25bacdd7427))
* **web:** resolve remaining lighthouse findings ([a4e16b8](https://github.com/accolver/redshift/commit/a4e16b8c38959176a174bb73d91bd4326a387d18))
* **web:** restore global search to search secrets using Gift Wrap decryption ([078903e](https://github.com/accolver/redshift/commit/078903e35441a7729a6f186bda3c25d5c1b03227))
* **web:** restore relay.primal.net, keep 10s timeout ([de44285](https://github.com/accolver/redshift/commit/de4428564933f27f71c4340554324eb2a6cff9b3))
* **web:** separate save errors from load errors, reduce timeout ([7e175a0](https://github.com/accolver/redshift/commit/7e175a02c1baa787dd9ed979fcc7b94f2b9a01c3))
* **web:** simplify DocsPage layout and reduce mobile spacing ([a870880](https://github.com/accolver/redshift/commit/a870880b91a82903b4d44413799f6544217a979d))
* **web:** simplify to always use Cloudflare adapter ([aba02d4](https://github.com/accolver/redshift/commit/aba02d4b78b54b65845226976636e2c0012a9516))
* **web:** use Cloudflare adapter when building on CF Pages ([37ef97b](https://github.com/accolver/redshift/commit/37ef97bba8f811a1cba5ca6db6c57b1ec0a8595a))
* **web:** use conditional adapter for static (CLI) vs Cloudflare builds ([c25c935](https://github.com/accolver/redshift/commit/c25c935319632a3cbb9f2c713f4f13043df43a9b))
* **web:** use envSlug instead of removed normalizedSlug variable ([dd4d0bd](https://github.com/accolver/redshift/commit/dd4d0bd3922d7808581b6cf12a79dbbd8134664d))
* **web:** use vitest imports instead of bun:test for CI compatibility ([2ef0e12](https://github.com/accolver/redshift/commit/2ef0e12e7ba074569693a80ae33095528672edc5))

## [0.13.0](https://github.com/accolver/redshift/compare/v0.12.0...v0.13.0) (2026-07-11)


### Features

* **backup:** add encrypted local backup and restore ([#43](https://github.com/accolver/redshift/issues/43)) ([db1ec0b](https://github.com/accolver/redshift/commit/db1ec0b2aa5ffd3856bd71c9980c4eddf7367925))

## [0.12.0](https://github.com/accolver/redshift/compare/v0.11.1...v0.12.0) (2026-07-11)


### Features

* **resilience:** add relay publication recovery ([#41](https://github.com/accolver/redshift/issues/41)) ([a1c0378](https://github.com/accolver/redshift/commit/a1c03789f3e72266fdd3ebb7dcae0d6705110ed2))

## [0.11.1](https://github.com/accolver/redshift/compare/v0.11.0...v0.11.1) (2026-07-11)


### Bug Fixes

* **release:** certify draft artifacts before publication ([#38](https://github.com/accolver/redshift/issues/38)) ([187aa63](https://github.com/accolver/redshift/commit/187aa63b1d5cfa601505b990e6b84633e37f2e19))

## [0.11.0](https://github.com/accolver/redshift/compare/v0.10.5...v0.11.0) (2026-07-11)


### Features

* **cli:** show QR code for Nostr Connect login ([254e237](https://github.com/accolver/redshift/commit/254e23738e2a01f7ca1fd4950303034409d627ec))


### Bug Fixes

* complete production readiness follow-up ([#35](https://github.com/accolver/redshift/issues/35)) ([28a6299](https://github.com/accolver/redshift/commit/28a6299abb68cdcee3241abc9326518b70c9547a))
* harden production readiness ([13c6942](https://github.com/accolver/redshift/commit/13c69424f9d3992c87fb0af3d0650de4f02e13e6))
* **web:** align homepage CLI login preview ([ba2e559](https://github.com/accolver/redshift/commit/ba2e559667149f40fde6c6f1715c29d5cb261462))

## [0.10.0](https://github.com/accolver/redshift/compare/v0.9.0...v0.10.0) (2025-12-09)


### Features

* add OpenSpec framework for spec-driven development ([c8baab6](https://github.com/accolver/redshift/commit/c8baab6feb1287ed92d947841d9dca6f19bcce27))
* **web:** add pricing page with tiered plans ([8fe8bba](https://github.com/accolver/redshift/commit/8fe8bba783f93fd516b535a18de31b3f8a680b65))


### Bug Fixes

* **web:** add @redshift/crypto to Vite optimizeDeps ([09d47a7](https://github.com/accolver/redshift/commit/09d47a7b2027e4cc3b3b3b9120ea4756e3c186e2))
* **web:** align pricing features with spec and Telos framework ([d2a02c1](https://github.com/accolver/redshift/commit/d2a02c14cb71b5ac5e656ece79f67692aad68acf))
* **web:** fix global search navigation URL and add arrow key support ([202b9c1](https://github.com/accolver/redshift/commit/202b9c1df829b59aa5bf5ae2201e92e277122c05))
* **web:** match admin navbar spacing to public navbar ([41aabf6](https://github.com/accolver/redshift/commit/41aabf699bb15c4f1de44c297c8332080e56b764))
* **web:** restore global search to search secrets using Gift Wrap decryption ([078903e](https://github.com/accolver/redshift/commit/078903e35441a7729a6f186bda3c25d5c1b03227))

## [0.9.0](https://github.com/accolver/redshift/compare/v0.8.0...v0.9.0) (2025-12-08)


### Features

* **web:** add floating page title in docs mobile header on scroll ([cc36805](https://github.com/accolver/redshift/commit/cc3680558d1140745c4261ec23a519f6ea8b6ed1))


### Bug Fixes

* **web:** add apple-touch-icon for iOS home screen ([17c0c4a](https://github.com/accolver/redshift/commit/17c0c4a3db8eaf00b15fd9f4d6d48686a96a8049))
* **web:** add color-scheme meta tag for dark mode ([4baba85](https://github.com/accolver/redshift/commit/4baba8574f814a65e906c35ee7ad77a3214c8efb))
* **web:** correct CLI commands and prevent table horizontal scrolling ([df7510f](https://github.com/accolver/redshift/commit/df7510ff4451f3a3edd3b2f57e615fd36393385a))
* **web:** simplify DocsPage layout and reduce mobile spacing ([a870880](https://github.com/accolver/redshift/commit/a870880b91a82903b4d44413799f6544217a979d))

## [0.8.0](https://github.com/accolver/redshift/compare/v0.7.0...v0.8.0) (2025-12-07)


### Features

* **cli:** use shorter environment slugs as defaults ([17cc359](https://github.com/accolver/redshift/commit/17cc3596dfe79df1e9635d5003102c3107233402))
* **web:** add environment slug to URL path for bookmarkable links ([8a41887](https://github.com/accolver/redshift/commit/8a41887e470d976a2a49604f38dd235df428ef0d))


### Bug Fixes

* **cli:** make rate limiter tests more reliable in CI ([faa07ba](https://github.com/accolver/redshift/commit/faa07ba6eacc340eb1e377d47faa0b7a4f94f185))

## [0.7.0](https://github.com/accolver/redshift/compare/v0.6.2...v0.7.0) (2025-12-07)


### Features

* **cli:** add Doppler-compatible CLI framework with declarative command structure ([f2a58b5](https://github.com/accolver/redshift/commit/f2a58b5c3704c09a9ce0c8045cd3885a1fcac660))

## [0.6.2](https://github.com/accolver/redshift/compare/v0.6.1...v0.6.2) (2025-12-07)


### Bug Fixes

* **ci:** cross-compile macOS binaries from Linux for faster releases ([c9c48bc](https://github.com/accolver/redshift/commit/c9c48bcb3f06bf5555cd1e7e63444c1dcd4954b7))

## [0.6.1](https://github.com/accolver/redshift/compare/v0.6.0...v0.6.1) (2025-12-07)


### Bug Fixes

* **web:** autofocus key input when adding new secret ([2f73f22](https://github.com/accolver/redshift/commit/2f73f22fdddea77c15a5809715d7eb8a1c63d87e))

## [0.6.0](https://github.com/accolver/redshift/compare/v0.5.1...v0.6.0) (2025-12-07)


### Features

* **web:** auto-connect on page refresh for project routes ([3526f81](https://github.com/accolver/redshift/commit/3526f81ca239954dd818c8c4e9b54a5a6d9ef56c))
* **web:** use project slug instead of id in URLs ([6ab7d9b](https://github.com/accolver/redshift/commit/6ab7d9b3efa87346c798f562a5fb7fbaecb8ce4c))


### Bug Fixes

* **web:** improve test infrastructure for browser globals ([74b2b38](https://github.com/accolver/redshift/commit/74b2b3886ace72ed962d58c0666177f82139a223))

## [0.5.1](https://github.com/accolver/redshift/compare/v0.5.0...v0.5.1) (2025-12-07)


### Bug Fixes

* **web:** change save error banner from error to warning style ([a62bfa4](https://github.com/accolver/redshift/commit/a62bfa4a2464eebd0a55e9181acd5f07a567d24c))
* **web:** include project slug in CLI hint for add environment modal ([356f3ae](https://github.com/accolver/redshift/commit/356f3ae72536cf7a8df55ff03b2ba8a5ca5898bf))
* **web:** normalize environment slug input and improve CLI preview ([cdc43cb](https://github.com/accolver/redshift/commit/cdc43cbf13be05b383ffff10944207a0331af75f))
* **web:** separate save errors from load errors, reduce timeout ([7e175a0](https://github.com/accolver/redshift/commit/7e175a02c1baa787dd9ed979fcc7b94f2b9a01c3))
* **web:** use envSlug instead of removed normalizedSlug variable ([dd4d0bd](https://github.com/accolver/redshift/commit/dd4d0bd3922d7808581b6cf12a79dbbd8134664d))

## [0.5.0](https://github.com/accolver/redshift/compare/v0.4.1...v0.5.0) (2025-12-07)


### ⚠ BREAKING CHANGES

* **web:** Project schema changed from 'name' to 'slug' + 'displayName'. Old projects will not be visible in the UI.

### Features

* **web:** add immutable project slug for CLI compatibility ([dff71ad](https://github.com/accolver/redshift/commit/dff71ade438f996c709b46690796e06def837994))


### Bug Fixes

* **cli:** add timing tolerance to flaky rate limiter test ([fa5e685](https://github.com/accolver/redshift/commit/fa5e685f1d8f1eab6a71213c5b8204da0f35b273))
* **web:** hide add secret row immediately when saving ([09bb1ea](https://github.com/accolver/redshift/commit/09bb1ea02acf755b5befa1cb7a2d7a5eac653c09))
* **web:** remove relay.primal.net and add publish timeout ([bfbd219](https://github.com/accolver/redshift/commit/bfbd21992a64840f3410eb5da82fa53b52649dd6))
* **web:** restore relay.primal.net, keep 10s timeout ([de44285](https://github.com/accolver/redshift/commit/de4428564933f27f71c4340554324eb2a6cff9b3))

## [0.4.1](https://github.com/accolver/redshift/compare/v0.4.0...v0.4.1) (2025-12-07)


### Bug Fixes

* **web:** remove crypto tests from web - use pure logic tests only ([36a5b71](https://github.com/accolver/redshift/commit/36a5b71f34357ef4b1c2c921e7705c3711f2282d))
* **web:** use vitest imports instead of bun:test for CI compatibility ([2ef0e12](https://github.com/accolver/redshift/commit/2ef0e12e7ba074569693a80ae33095528672edc5))

## [0.4.0](https://github.com/accolver/redshift/compare/v0.3.0...v0.4.0) (2025-12-07)


### Features

* add cross-platform build scripts and release automation ([7adb58a](https://github.com/accolver/redshift/commit/7adb58acf03452db76f998e4c9cee65f8ec0c606))
* add fuzzy search for secrets with space-to-underscore matching ([d86013b](https://github.com/accolver/redshift/commit/d86013b35b361674dcfc09cb43aa4e06561880ca))
* add InlineCode component for consistent inline code styling ([fd7f127](https://github.com/accolver/redshift/commit/fd7f1271e542f007d9a992b3d9776465ff99dc60))
* add NIP-07/NIP-46 signer support for Gift Wrap encryption ([92e727c](https://github.com/accolver/redshift/commit/92e727c69c7dbf35619cb94e73836d721090983e))
* add rate limiting with exponential backoff for relay connections ([df0d891](https://github.com/accolver/redshift/commit/df0d8910f53afc0e06d3acb3e24e8e8767d03169))
* **admin:** add missing secrets, multi-env save, and search highlight ([8590465](https://github.com/accolver/redshift/commit/8590465c64c9cc57de0dffcd383b34fda7fef725))
* **auth:** add local nsec signing and NIP-46 bunker support ([134a690](https://github.com/accolver/redshift/commit/134a69044b37708692d8228438213deb092e7fcd))
* **branding:** replace Svelte logo with custom Redshift chevron icon ([44dbfa4](https://github.com/accolver/redshift/commit/44dbfa468d1ddebd613c6a31b368a14001468e8a))
* **cli:** add binary integration tests and interactive project fetching ([8216903](https://github.com/accolver/redshift/commit/82169037184f267d78c87881165c1650406f2de1))
* **cli:** add secrets upload command for .env file import ([b08525e](https://github.com/accolver/redshift/commit/b08525e322cd7dd1d7c122d549e67cd32b14735f))
* **cli:** add typed errors, keychain storage, and input validation ([05338b7](https://github.com/accolver/redshift/commit/05338b76da9f9a38ce028dde37ab7e11256ab747))
* **cli:** add upgrade command, hidden nsec input, and secrets options ([b4a13ad](https://github.com/accolver/redshift/commit/b4a13ad4df9d13f5a40533c99c33aa58cf9137bc))
* **cli:** embed SvelteKit admin UI into binary ([82f7139](https://github.com/accolver/redshift/commit/82f71394612c3746dc6e3633dab25c0dd8974737))
* **cli:** implement Nostr-based secret management CLI ([b068348](https://github.com/accolver/redshift/commit/b068348c07c0ee8dd314ce39c5cd6f40549accd1))
* **crypto:** add shared NIP-59 Gift Wrap crypto package ([c3566eb](https://github.com/accolver/redshift/commit/c3566ebc543c67ef1014a451af88703acc4662c5))
* **docs:** add home link to sidebar navigation ([1a53769](https://github.com/accolver/redshift/commit/1a5376917405c0e903b067c86be65d5e02469efe))
* **docs:** add linkable headers and Prism.js code highlighting ([90996d8](https://github.com/accolver/redshift/commit/90996d86c254d950ce1868c4279326154b54950a))
* **docs:** add mobile navigation with shadcn Sheet component ([c06b971](https://github.com/accolver/redshift/commit/c06b9713044ecfe3c033e20a41120251e102465a))
* **security:** encrypt nsec with non-extractable AES-GCM key before storage ([aabc8b9](https://github.com/accolver/redshift/commit/aabc8b9821997dbddef564de83153393a1bfb9b7))
* **seo:** add comprehensive SEO meta tags, sitemap, and structured data ([4fe72ff](https://github.com/accolver/redshift/commit/4fe72ff2ccbc506f61359bb4c4b7d30d3aade44d))
* **seo:** add llms.txt for LLM-friendly documentation ([06ae297](https://github.com/accolver/redshift/commit/06ae297d97a82e0f36de9f0caaa75df58a0642d9))
* support batch secrets in multi-env save modal ([bd64e7c](https://github.com/accolver/redshift/commit/bd64e7c119ab0c48f63a71eab184eede7ef64f07))
* **web:** add dashboard enhancements, delete functionality, and global search ([9818ae9](https://github.com/accolver/redshift/commit/9818ae90bcb665f729bd401a14e11cb7dcc146d9))
* **web:** add inline editing and status tracking for secrets ([58dac2e](https://github.com/accolver/redshift/commit/58dac2eed1091fdf49ed7dcab27a26b5c3da3e3c))
* **web:** add login dialog with NIP-07, nsec, and bunker auth options ([2007407](https://github.com/accolver/redshift/commit/200740798a223a9fccbfe616dbd0a188d1df14af))
* **web:** add mobile responsive layout, export/import modals, and copy feedback ([507f23d](https://github.com/accolver/redshift/commit/507f23d614387c6c1eaac995e8b2573ab794016e))
* **web:** add reusable CodeBlock component with copy button ([7f3288a](https://github.com/accolver/redshift/commit/7f3288acc3635e41d8638ebd8335a69dbefeafcb))
* **web:** add scroll animations and fix secrets sorting ([c1417f5](https://github.com/accolver/redshift/commit/c1417f5cb9a78decd8210f061c5064039fe6cd6c))
* **web:** add svelte-motion animations to admin dashboard ([dce37c5](https://github.com/accolver/redshift/commit/dce37c57bd2d90d60cdf2065afa17160e6e9c100))
* **web:** implement NIP-59 Gift Wrap encryption for secrets ([ab12567](https://github.com/accolver/redshift/commit/ab12567a1fd45512370cc3aeb0321c4c04e3598a))
* **web:** implement SvelteKit admin dashboard with Nostr auth ([43502b2](https://github.com/accolver/redshift/commit/43502b29e8a2ca6533bb1183fd372a178fbce082))
* **web:** improve secrets UX with global save, unsaved warning, and animations ([11cb87c](https://github.com/accolver/redshift/commit/11cb87c3bcaedda8bca1a5f7394692ed8109d948))
* **web:** integrate shared crypto package for NIP-59 encryption ([963dce6](https://github.com/accolver/redshift/commit/963dce67afaa276c99d0b7fe49e0f2ef970a8503))
* **web:** redesign project page with Doppler-style secrets UI ([86fc97a](https://github.com/accolver/redshift/commit/86fc97a960432e67e087c03206d1bb535db72a79))


### Bug Fixes

* **a11y:** remove autofocus attributes to fix accessibility warnings ([16c5f3d](https://github.com/accolver/redshift/commit/16c5f3d6e82fa917ac1d59439dd6f8678b65c713))
* add cursor-pointer to dialog close button ([a29b1df](https://github.com/accolver/redshift/commit/a29b1df59aabde79e5dec887413e4bcec317ff81))
* **build:** add favicon.svg to static and remove missing apple-touch-icon ref ([7486aef](https://github.com/accolver/redshift/commit/7486aef183451a891a3a228464f718214e6e456f))
* **ci:** skip relay integration tests and fix workspace protocol ([dd18363](https://github.com/accolver/redshift/commit/dd18363d44218f73ac657ee5ed08d219335ca390))
* **cli:** handle component-prefixed version tags in upgrade command ([42009a2](https://github.com/accolver/redshift/commit/42009a22afdfdbf49a0fb4fd83d23f7cb8dba6ca))
* **cli:** read version from package.json and set up Release Please ([258c931](https://github.com/accolver/redshift/commit/258c93191e241acc7b419fb83c02d3ed743ac8bb))
* prevent infinite effect loops in admin layout and secrets store ([25af225](https://github.com/accolver/redshift/commit/25af22523321f0486374afe1cacc2151949a9ab3))
* resolve TypeScript exactOptionalPropertyTypes errors ([01fdade](https://github.com/accolver/redshift/commit/01fdadec84ab64aa2d20e23b425b4c32b76fc0ad))
* **test:** add afterEach cleanup and fix timing tolerances ([2d1c841](https://github.com/accolver/redshift/commit/2d1c8411b42a1b7cfe1ce784fc5677fd33bb72f8))
* **test:** add tolerance for timing-sensitive rate limiter test ([df71adb](https://github.com/accolver/redshift/commit/df71adb0a63a25940505617837b930f8471d0abe))
* **ui:** add spacing between navbar and hero section ([6153b39](https://github.com/accolver/redshift/commit/6153b39ed64353a3a055564846edebddf490d7b7))
* **ui:** improve mobile layout and inline editing for missing secrets ([37a44ca](https://github.com/accolver/redshift/commit/37a44ca9edb59909dde7eb022d73a2663473acfa))
* **ui:** mobile navbar overflow, scroll bug, and add secret search ([e32de0f](https://github.com/accolver/redshift/commit/e32de0f84252ff11cf9f803e052c1c315bb456cb))
* update GitHub repo URLs to accolver/redshift ([9a67d71](https://github.com/accolver/redshift/commit/9a67d7158aad38a7bc4cf9cd9eedb1bd47b43014))
* **web:** adjust DocsPage header styling ([50ca213](https://github.com/accolver/redshift/commit/50ca213e3c9af36d10726098164d8da8b077b074))
* **web:** eliminate horizontal scrolling on docs pages ([d002a26](https://github.com/accolver/redshift/commit/d002a26297b622aeb9880725d43610585a1bf93f))
* **web:** improve install command contrast in CLI Quick Reference ([b9724a4](https://github.com/accolver/redshift/commit/b9724a4ec48f0e7ff9af1ee4f6757321b1d807f1))
* **web:** improve terminal preview text contrast on homepage ([2713f99](https://github.com/accolver/redshift/commit/2713f9998ba879ba70badf587e5296d6ccd1bf53))

## [0.3.0](https://github.com/accolver/redshift/compare/redshift-v0.2.1...redshift-v0.3.0) (2025-12-07)


### Features

* add cross-platform build scripts and release automation ([7adb58a](https://github.com/accolver/redshift/commit/7adb58acf03452db76f998e4c9cee65f8ec0c606))
* add fuzzy search for secrets with space-to-underscore matching ([d86013b](https://github.com/accolver/redshift/commit/d86013b35b361674dcfc09cb43aa4e06561880ca))
* add InlineCode component for consistent inline code styling ([fd7f127](https://github.com/accolver/redshift/commit/fd7f1271e542f007d9a992b3d9776465ff99dc60))
* add NIP-07/NIP-46 signer support for Gift Wrap encryption ([92e727c](https://github.com/accolver/redshift/commit/92e727c69c7dbf35619cb94e73836d721090983e))
* add rate limiting with exponential backoff for relay connections ([df0d891](https://github.com/accolver/redshift/commit/df0d8910f53afc0e06d3acb3e24e8e8767d03169))
* **admin:** add missing secrets, multi-env save, and search highlight ([8590465](https://github.com/accolver/redshift/commit/8590465c64c9cc57de0dffcd383b34fda7fef725))
* **auth:** add local nsec signing and NIP-46 bunker support ([134a690](https://github.com/accolver/redshift/commit/134a69044b37708692d8228438213deb092e7fcd))
* **branding:** replace Svelte logo with custom Redshift chevron icon ([44dbfa4](https://github.com/accolver/redshift/commit/44dbfa468d1ddebd613c6a31b368a14001468e8a))
* **cli:** add binary integration tests and interactive project fetching ([8216903](https://github.com/accolver/redshift/commit/82169037184f267d78c87881165c1650406f2de1))
* **cli:** add secrets upload command for .env file import ([b08525e](https://github.com/accolver/redshift/commit/b08525e322cd7dd1d7c122d549e67cd32b14735f))
* **cli:** add typed errors, keychain storage, and input validation ([05338b7](https://github.com/accolver/redshift/commit/05338b76da9f9a38ce028dde37ab7e11256ab747))
* **cli:** add upgrade command, hidden nsec input, and secrets options ([b4a13ad](https://github.com/accolver/redshift/commit/b4a13ad4df9d13f5a40533c99c33aa58cf9137bc))
* **cli:** embed SvelteKit admin UI into binary ([82f7139](https://github.com/accolver/redshift/commit/82f71394612c3746dc6e3633dab25c0dd8974737))
* **cli:** implement Nostr-based secret management CLI ([b068348](https://github.com/accolver/redshift/commit/b068348c07c0ee8dd314ce39c5cd6f40549accd1))
* **crypto:** add shared NIP-59 Gift Wrap crypto package ([c3566eb](https://github.com/accolver/redshift/commit/c3566ebc543c67ef1014a451af88703acc4662c5))
* **docs:** add home link to sidebar navigation ([1a53769](https://github.com/accolver/redshift/commit/1a5376917405c0e903b067c86be65d5e02469efe))
* **docs:** add linkable headers and Prism.js code highlighting ([90996d8](https://github.com/accolver/redshift/commit/90996d86c254d950ce1868c4279326154b54950a))
* **docs:** add mobile navigation with shadcn Sheet component ([c06b971](https://github.com/accolver/redshift/commit/c06b9713044ecfe3c033e20a41120251e102465a))
* **security:** encrypt nsec with non-extractable AES-GCM key before storage ([aabc8b9](https://github.com/accolver/redshift/commit/aabc8b9821997dbddef564de83153393a1bfb9b7))
* **seo:** add comprehensive SEO meta tags, sitemap, and structured data ([4fe72ff](https://github.com/accolver/redshift/commit/4fe72ff2ccbc506f61359bb4c4b7d30d3aade44d))
* **seo:** add llms.txt for LLM-friendly documentation ([06ae297](https://github.com/accolver/redshift/commit/06ae297d97a82e0f36de9f0caaa75df58a0642d9))
* support batch secrets in multi-env save modal ([bd64e7c](https://github.com/accolver/redshift/commit/bd64e7c119ab0c48f63a71eab184eede7ef64f07))
* **web:** add dashboard enhancements, delete functionality, and global search ([9818ae9](https://github.com/accolver/redshift/commit/9818ae90bcb665f729bd401a14e11cb7dcc146d9))
* **web:** add inline editing and status tracking for secrets ([58dac2e](https://github.com/accolver/redshift/commit/58dac2eed1091fdf49ed7dcab27a26b5c3da3e3c))
* **web:** add login dialog with NIP-07, nsec, and bunker auth options ([2007407](https://github.com/accolver/redshift/commit/200740798a223a9fccbfe616dbd0a188d1df14af))
* **web:** add mobile responsive layout, export/import modals, and copy feedback ([507f23d](https://github.com/accolver/redshift/commit/507f23d614387c6c1eaac995e8b2573ab794016e))
* **web:** add reusable CodeBlock component with copy button ([7f3288a](https://github.com/accolver/redshift/commit/7f3288acc3635e41d8638ebd8335a69dbefeafcb))
* **web:** add scroll animations and fix secrets sorting ([c1417f5](https://github.com/accolver/redshift/commit/c1417f5cb9a78decd8210f061c5064039fe6cd6c))
* **web:** add svelte-motion animations to admin dashboard ([dce37c5](https://github.com/accolver/redshift/commit/dce37c57bd2d90d60cdf2065afa17160e6e9c100))
* **web:** implement NIP-59 Gift Wrap encryption for secrets ([ab12567](https://github.com/accolver/redshift/commit/ab12567a1fd45512370cc3aeb0321c4c04e3598a))
* **web:** implement SvelteKit admin dashboard with Nostr auth ([43502b2](https://github.com/accolver/redshift/commit/43502b29e8a2ca6533bb1183fd372a178fbce082))
* **web:** improve secrets UX with global save, unsaved warning, and animations ([11cb87c](https://github.com/accolver/redshift/commit/11cb87c3bcaedda8bca1a5f7394692ed8109d948))
* **web:** integrate shared crypto package for NIP-59 encryption ([963dce6](https://github.com/accolver/redshift/commit/963dce67afaa276c99d0b7fe49e0f2ef970a8503))
* **web:** redesign project page with Doppler-style secrets UI ([86fc97a](https://github.com/accolver/redshift/commit/86fc97a960432e67e087c03206d1bb535db72a79))


### Bug Fixes

* **a11y:** remove autofocus attributes to fix accessibility warnings ([16c5f3d](https://github.com/accolver/redshift/commit/16c5f3d6e82fa917ac1d59439dd6f8678b65c713))
* add cursor-pointer to dialog close button ([a29b1df](https://github.com/accolver/redshift/commit/a29b1df59aabde79e5dec887413e4bcec317ff81))
* **build:** add favicon.svg to static and remove missing apple-touch-icon ref ([7486aef](https://github.com/accolver/redshift/commit/7486aef183451a891a3a228464f718214e6e456f))
* **ci:** skip relay integration tests and fix workspace protocol ([dd18363](https://github.com/accolver/redshift/commit/dd18363d44218f73ac657ee5ed08d219335ca390))
* **cli:** read version from package.json and set up Release Please ([258c931](https://github.com/accolver/redshift/commit/258c93191e241acc7b419fb83c02d3ed743ac8bb))
* prevent infinite effect loops in admin layout and secrets store ([25af225](https://github.com/accolver/redshift/commit/25af22523321f0486374afe1cacc2151949a9ab3))
* resolve TypeScript exactOptionalPropertyTypes errors ([01fdade](https://github.com/accolver/redshift/commit/01fdadec84ab64aa2d20e23b425b4c32b76fc0ad))
* **test:** add afterEach cleanup and fix timing tolerances ([2d1c841](https://github.com/accolver/redshift/commit/2d1c8411b42a1b7cfe1ce784fc5677fd33bb72f8))
* **test:** add tolerance for timing-sensitive rate limiter test ([df71adb](https://github.com/accolver/redshift/commit/df71adb0a63a25940505617837b930f8471d0abe))
* **ui:** add spacing between navbar and hero section ([6153b39](https://github.com/accolver/redshift/commit/6153b39ed64353a3a055564846edebddf490d7b7))
* **ui:** improve mobile layout and inline editing for missing secrets ([37a44ca](https://github.com/accolver/redshift/commit/37a44ca9edb59909dde7eb022d73a2663473acfa))
* **ui:** mobile navbar overflow, scroll bug, and add secret search ([e32de0f](https://github.com/accolver/redshift/commit/e32de0f84252ff11cf9f803e052c1c315bb456cb))
* update GitHub repo URLs to accolver/redshift ([9a67d71](https://github.com/accolver/redshift/commit/9a67d7158aad38a7bc4cf9cd9eedb1bd47b43014))
* **web:** adjust DocsPage header styling ([50ca213](https://github.com/accolver/redshift/commit/50ca213e3c9af36d10726098164d8da8b077b074))
* **web:** eliminate horizontal scrolling on docs pages ([d002a26](https://github.com/accolver/redshift/commit/d002a26297b622aeb9880725d43610585a1bf93f))
* **web:** improve install command contrast in CLI Quick Reference ([b9724a4](https://github.com/accolver/redshift/commit/b9724a4ec48f0e7ff9af1ee4f6757321b1d807f1))
* **web:** improve terminal preview text contrast on homepage ([2713f99](https://github.com/accolver/redshift/commit/2713f9998ba879ba70badf587e5296d6ccd1bf53))

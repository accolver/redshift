/**
 * CLI Version
 *
 * Reads version from the root package.json at build time.
 * Bun's bundler will inline this import, so the version is baked into the binary.
 */

import packageJson from '../../package.json';

export const VERSION: string = packageJson.version;

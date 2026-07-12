#!/usr/bin/env bun
/**
 * Generate Embeds Script
 *
 * Converts the SvelteKit build output (web/dist/) into a TypeScript module
 * that can be compiled into the CLI binary.
 *
 * L2: Function-Author - Build tooling
 */

import { readdir, stat } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const REPOSITORY_ROOT = join(import.meta.dir, '../..');
const WEB_DIST_DIR = join(REPOSITORY_ROOT, 'web/dist');
const OUTPUT_FILE = join(import.meta.dir, '../src/lib/embedded-files.ts');
const SOURCE_INPUTS = [
	'web/src',
	'web/static',
	'web/package.json',
	'web/svelte.config.js',
	'web/vite.config.ts',
	'packages/crypto/src',
	'packages/rate-limiter/src',
	'cli/scripts/generate-embeds.ts',
	'bun.lock',
];

// MIME types for common file extensions
const MIME_TYPES: Record<string, string> = {
	'.html': 'text/html; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.js': 'application/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.ico': 'image/x-icon',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.ttf': 'font/ttf',
	'.txt': 'text/plain; charset=utf-8',
	'.xml': 'application/xml; charset=utf-8',
};

interface EmbeddedFile {
	path: string;
	contentType: string;
	content: string;
	isBase64: boolean;
}

/**
 * Recursively collect all files in a directory.
 */
async function collectFiles(dir: string, basePath = ''): Promise<string[]> {
	const files: string[] = [];
	const entries = (await readdir(dir)).sort();

	for (const entry of entries) {
		const fullPath = join(dir, entry);
		const relativePath = join(basePath, entry);
		const stats = await stat(fullPath);

		if (stats.isDirectory()) {
			files.push(...(await collectFiles(fullPath, relativePath)));
		} else {
			files.push(relativePath);
		}
	}

	return files;
}

/**
 * Determine if a file should be base64 encoded (binary files).
 */
function isBinaryFile(ext: string): boolean {
	const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf'];
	return binaryExtensions.includes(ext);
}

/**
 * Get the URL path for a file (e.g., "index.html" -> "/", "docs.html" -> "/docs").
 */
function getUrlPath(filePath: string): string {
	// Normalize path separators
	let urlPath = '/' + filePath.replace(/\\/g, '/');

	// Handle index.html at root
	if (urlPath === '/index.html') {
		return '/';
	}

	// Handle .html files (remove extension for clean URLs)
	if (urlPath.endsWith('.html')) {
		// Keep /docs/auth.html as /docs/auth for SPA routing
		urlPath = urlPath.slice(0, -5);
	}

	return urlPath;
}

async function calculateSourceDigest() {
	const hasher = new Bun.CryptoHasher('sha256');
	for (const input of SOURCE_INPUTS) {
		const absoluteInput = join(REPOSITORY_ROOT, input);
		const inputStats = await stat(absoluteInput);
		const files = inputStats.isDirectory()
			? (await collectFiles(absoluteInput)).map((file) => join(absoluteInput, file))
			: [absoluteInput];
		for (const file of files.sort()) {
			const normalizedPath = relative(REPOSITORY_ROOT, file).replace(/\\/g, '/');
			hasher.update(normalizedPath);
			hasher.update(new Uint8Array([0]));
			hasher.update(await Bun.file(file).arrayBuffer());
		}
	}
	return hasher.digest('hex');
}

async function verifySourceDigest() {
	const expected = await calculateSourceDigest();
	const generated = await Bun.file(OUTPUT_FILE).text();
	const actual = generated.match(/EMBEDDED_SOURCE_DIGEST = "([0-9a-f]{64})"/)?.[1];
	if (actual !== expected) {
		throw new Error(
			'Embedded dashboard source digest is stale; run `bun run build:web && bun run build:embeds`.',
		);
	}
	console.log(`Embedded dashboard source digest verified: ${expected}`);
}

/**
 * Generate the embedded files TypeScript module.
 */
async function generateEmbeds(): Promise<void> {
	console.log('Generating embedded files from web/dist/...');

	// Check if web/dist exists
	try {
		await stat(WEB_DIST_DIR);
	} catch {
		console.error('Error: web/dist/ not found. Run `bun run build:web` first.');
		process.exit(1);
	}

	// Collect all files
	const files = await collectFiles(WEB_DIST_DIR);
	console.log(`Found ${files.length} files to embed.`);

	const embeddedFiles: EmbeddedFile[] = [];

	for (const file of files) {
		const fullPath = join(WEB_DIST_DIR, file);
		const ext = extname(file).toLowerCase();
		const contentType = MIME_TYPES[ext] || 'application/octet-stream';
		const isBinary = isBinaryFile(ext);

		// Read file content
		const fileContent = await Bun.file(fullPath).arrayBuffer();

		let content: string;
		if (isBinary) {
			// Base64 encode binary files
			content = Buffer.from(fileContent).toString('base64');
		} else {
			// Text files as-is
			content = new TextDecoder().decode(fileContent);
		}

		// Get URL path
		const urlPath = getUrlPath(file);

		embeddedFiles.push({
			path: urlPath,
			contentType,
			content,
			isBase64: isBinary,
		});

		// Also add the raw .html path for HTML files (for direct access)
		if (ext === '.html' && urlPath !== '/') {
			embeddedFiles.push({
				path: urlPath + '.html',
				contentType,
				content,
				isBase64: isBinary,
			});
		}
	}

	// Also add raw file paths for assets (CSS, JS, etc.)
	for (const file of files) {
		const ext = extname(file).toLowerCase();
		if (ext !== '.html') {
			const urlPath = '/' + file.replace(/\\/g, '/');
			const existing = embeddedFiles.find((f) => f.path === urlPath);
			if (!existing) {
				const fullPath = join(WEB_DIST_DIR, file);
				const contentType = MIME_TYPES[ext] || 'application/octet-stream';
				const isBinary = isBinaryFile(ext);
				const fileContent = await Bun.file(fullPath).arrayBuffer();

				let content: string;
				if (isBinary) {
					content = Buffer.from(fileContent).toString('base64');
				} else {
					content = new TextDecoder().decode(fileContent);
				}

				embeddedFiles.push({
					path: urlPath,
					contentType,
					content,
					isBase64: isBinary,
				});
			}
		}
	}

	// Generate TypeScript module
	const sourceDigest = await calculateSourceDigest();
	const tsContent = generateTypeScriptModule(embeddedFiles, sourceDigest);

	// Write output file
	await Bun.write(OUTPUT_FILE, tsContent);

	console.log(`Generated ${OUTPUT_FILE}`);
	console.log(`Embedded ${embeddedFiles.length} files (${formatBytes(tsContent.length)} total).`);
}

/**
 * Generate the TypeScript module content.
 */
function generateTypeScriptModule(files: EmbeddedFile[], sourceDigest: string): string {
	const fileEntries = files
		.map((file) => {
			return `  ${JSON.stringify(file.path)}: {
    contentType: ${JSON.stringify(file.contentType)},
    content: ${JSON.stringify(file.content)},
    isBase64: ${file.isBase64},
  }`;
		})
		.join(',\n');

	return `/**
 * Embedded Files - Auto-generated
 *
 * DO NOT EDIT MANUALLY - Generated by scripts/generate-embeds.ts
 *
 * This file contains the SvelteKit build output embedded as strings,
 * allowing the CLI binary to serve the admin UI without external files.
 */

export const EMBEDDED_SOURCE_DIGEST = ${JSON.stringify(sourceDigest)};

export interface EmbeddedFile {
  contentType: string;
  content: string;
  isBase64: boolean;
}

export const EMBEDDED_FILES: Record<string, EmbeddedFile> = {
${fileEntries}
};

/**
 * Get an embedded file by URL path.
 * Returns undefined if the file doesn't exist.
 */
export function getEmbeddedFile(path: string): EmbeddedFile | undefined {
  // Try exact match first
  if (EMBEDDED_FILES[path]) {
    return EMBEDDED_FILES[path];
  }

  // Try with trailing slash removed
  if (path.endsWith('/') && path !== '/') {
    const withoutSlash = path.slice(0, -1);
    if (EMBEDDED_FILES[withoutSlash]) {
      return EMBEDDED_FILES[withoutSlash];
    }
  }

  // Try with .html extension
  if (!path.includes('.') && path !== '/') {
    const withHtml = path + '.html';
    if (EMBEDDED_FILES[withHtml]) {
      return EMBEDDED_FILES[withHtml];
    }
  }

  return undefined;
}

/**
 * Decode an embedded file's content to a Uint8Array.
 * Handles both base64 and plain text content.
 */
export function decodeContent(file: EmbeddedFile): Uint8Array {
  if (file.isBase64) {
    return Uint8Array.from(atob(file.content), (c) => c.charCodeAt(0));
  }
  return new TextEncoder().encode(file.content);
}

/**
 * Check if embedded files are available.
 * Returns true if files have been embedded, false if using placeholder.
 */
export function hasEmbeddedFiles(): boolean {
  return Object.keys(EMBEDDED_FILES).length > 0;
}
`;
}

/**
 * Format bytes to human-readable string.
 */
function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Run the script
const operation = process.argv.includes('--check-source') ? verifySourceDigest() : generateEmbeds();
operation.catch((err) => {
	console.error('Error generating embeds:', err);
	process.exit(1);
});

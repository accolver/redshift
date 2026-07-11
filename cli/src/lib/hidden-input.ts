import { ValidationError } from './errors';

interface HiddenOutput {
	write(value: string): unknown;
}

export interface HiddenInputOptions {
	trim?: boolean;
	input?: NodeJS.ReadStream;
	output?: HiddenOutput;
}

export async function promptHidden(prompt: string, options: HiddenInputOptions = {}) {
	const input = options.input ?? process.stdin;
	const output = options.output ?? process.stdout;
	return new Promise<string>((resolve, reject) => {
		output.write(prompt);
		let value = '';
		let settled = false;
		let rawEnabled = false;

		const cleanup = () => {
			if (rawEnabled) input.setRawMode?.(false);
			input.pause();
			input.removeListener('data', onData);
			input.removeListener('end', onEnd);
			input.removeListener('error', onError);
			output.write('\n');
		};
		const finish = () => {
			if (settled) return;
			settled = true;
			cleanup();
			resolve(options.trim === false ? value : value.trim());
		};
		const fail = (error: Error) => {
			if (settled) return;
			settled = true;
			cleanup();
			reject(error);
		};
		const onEnd = () => finish();
		const onError = (error: Error) => fail(error);
		const onData = (chunk: string) => {
			for (const character of chunk) {
				if (character === '\u0003') {
					fail(new ValidationError('Sensitive input cancelled'));
					return;
				}
				if (character === '\r' || character === '\n') {
					finish();
					return;
				}
				if (character === '\u007f' || character === '\b') {
					if (value.length > 0) value = value.slice(0, -1);
					continue;
				}
				value += character;
			}
		};

		try {
			if (input.isTTY) {
				if (typeof input.setRawMode !== 'function') {
					throw new ValidationError('Hidden input is unavailable on this terminal');
				}
				input.setRawMode(true);
				rawEnabled = true;
			}
			input.resume();
			input.setEncoding('utf8');
			input.on('data', onData);
			input.once('end', onEnd);
			input.once('error', onError);
		} catch (error) {
			fail(error instanceof Error ? error : new ValidationError('Sensitive input failed'));
		}
	});
}

export function parsePipedPassphrases(input: string, expectedLines: number) {
	if (!Number.isSafeInteger(expectedLines) || expectedLines < 1) {
		throw new ValidationError('Invalid passphrase input count');
	}
	const normalized = input.replace(/\r\n/g, '\n');
	const lines = normalized.split('\n');
	if (lines.at(-1) === '') lines.pop();
	if (lines.length !== expectedLines || lines.some((line) => line.includes('\r'))) {
		throw new ValidationError(`Expected exactly ${expectedLines} passphrase line(s) on stdin`);
	}
	return lines;
}

export function validatePassphraseInputMode(useStdin: boolean, isTTY: boolean) {
	if (useStdin && isTTY) {
		throw new ValidationError('--passphrase-stdin requires piped standard input');
	}
	if (!useStdin && !isTTY) {
		throw new ValidationError('Non-interactive backup passphrases require --passphrase-stdin');
	}
}

export async function readPipedPassphrases(expectedLines: number) {
	validatePassphraseInputMode(true, Boolean(process.stdin.isTTY));
	let input = '';
	for await (const chunk of process.stdin) {
		input += String(chunk);
		if (Buffer.byteLength(input) > 4096) throw new ValidationError('Passphrase stdin is too large');
	}
	return parsePipedPassphrases(input, expectedLines);
}

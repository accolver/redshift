import { describe, expect, it } from 'bun:test';
import { EventEmitter } from 'node:events';
import {
	parsePipedPassphrases,
	promptHidden,
	validatePassphraseInputMode,
} from '../../src/lib/hidden-input';

class FakeInput extends EventEmitter {
	isTTY = true;
	rawModes: boolean[] = [];
	resumed = false;
	paused = false;

	setRawMode(enabled: boolean) {
		this.rawModes.push(enabled);
	}

	resume() {
		this.resumed = true;
	}

	pause() {
		this.paused = true;
	}

	setEncoding(_encoding: BufferEncoding) {}
}

describe('sensitive input', () => {
	it('preserves passphrase whitespace and restores terminal state', async () => {
		const input = new FakeInput();
		let output = '';
		const promise = promptHidden('Passphrase: ', {
			trim: false,
			input: input as unknown as NodeJS.ReadStream,
			output: { write: (value) => (output += value) },
		});
		input.emit('data', '  secret value  \n');
		expect(await promise).toBe('  secret value  ');
		expect(input.rawModes).toEqual([true, false]);
		expect(input.resumed).toBe(true);
		expect(input.paused).toBe(true);
		expect(output).toBe('Passphrase: \n');
	});

	it('rejects cancellation and still restores terminal state', async () => {
		const input = new FakeInput();
		const promise = promptHidden('Passphrase: ', {
			input: input as unknown as NodeJS.ReadStream,
			output: { write: () => {} },
		});
		input.emit('data', '\u0003');
		await expect(promise).rejects.toThrow('cancelled');
		expect(input.rawModes).toEqual([true, false]);
		expect(input.paused).toBe(true);
	});

	it('cleans up on EOF and stream errors', async () => {
		const eofInput = new FakeInput();
		const eofPromise = promptHidden('Passphrase: ', {
			trim: false,
			input: eofInput as unknown as NodeJS.ReadStream,
			output: { write: () => {} },
		});
		eofInput.emit('data', 'partial value');
		eofInput.emit('end');
		expect(await eofPromise).toBe('partial value');
		expect(eofInput.rawModes).toEqual([true, false]);

		const errorInput = new FakeInput();
		const errorPromise = promptHidden('Passphrase: ', {
			input: errorInput as unknown as NodeJS.ReadStream,
			output: { write: () => {} },
		});
		errorInput.emit('error', new Error('stream failed'));
		await expect(errorPromise).rejects.toThrow('stream failed');
		expect(errorInput.rawModes).toEqual([true, false]);
	});

	it('rejects a TTY-like stream that cannot disable echo', async () => {
		const input = new EventEmitter() as EventEmitter & {
			isTTY: boolean;
			resume(): void;
			pause(): void;
			setEncoding(_encoding: BufferEncoding): void;
		};
		input.isTTY = true;
		input.resume = () => {};
		input.pause = () => {};
		input.setEncoding = () => {};
		await expect(
			promptHidden('Passphrase: ', {
				input: input as unknown as NodeJS.ReadStream,
				output: { write: () => {} },
			}),
		).rejects.toThrow('unavailable');
	});

	it('requires hidden TTY input or an explicit non-TTY stdin mode', () => {
		expect(() => validatePassphraseInputMode(false, false)).toThrow('--passphrase-stdin');
		expect(() => validatePassphraseInputMode(true, true)).toThrow('requires piped');
		expect(() => validatePassphraseInputMode(false, true)).not.toThrow();
		expect(() => validatePassphraseInputMode(true, false)).not.toThrow();
	});

	it('parses exact piped lines without trimming and rejects ambiguity', () => {
		expect(parsePipedPassphrases(' first \n second \n', 2)).toEqual([' first ', ' second ']);
		expect(parsePipedPassphrases('one\r\ntwo\r\n', 2)).toEqual(['one', 'two']);
		expect(() => parsePipedPassphrases('one\n', 2)).toThrow('exactly 2');
		expect(() => parsePipedPassphrases('one\ntwo\nthree\n', 2)).toThrow('exactly 2');
		expect(() => parsePipedPassphrases('one\ntwo\n\n', 2)).toThrow('exactly 2');
	});
});

declare module 'qrcode-terminal' {
	export interface GenerateOptions {
		small?: boolean;
	}

	export interface QrCodeTerminal {
		generate(input: string, options: GenerateOptions, callback: (output: string) => void): void;
		generate(input: string, callback: (output: string) => void): void;
		setErrorLevel(error: 'L' | 'M' | 'Q' | 'H'): void;
	}

	const qrcode: QrCodeTerminal;
	export default qrcode;
}

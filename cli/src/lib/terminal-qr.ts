import qrcode from 'qrcode-terminal';

export function renderTerminalQr(value: string) {
	let output = '';
	qrcode.generate(value, { small: true }, (qr: string) => {
		output = qr;
	});
	return output;
}

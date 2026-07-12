import { decryptBackup, encryptBackup, type BackupPayloadV1 } from '@redshift/crypto';

const browserGlobal = globalThis as typeof globalThis & {
	runRedshiftBackupInterop?: () => Promise<BackupPayloadV1>;
};

browserGlobal.runRedshiftBackupInterop = async () => {
	const payload: BackupPayloadV1 = {
		schema: 'com.redshiftapp.backup',
		version: 1,
		createdAt: 1_700_000_000,
		sourcePubkey: 'ab'.repeat(32),
		contents: {
			secretState: 'current-observed',
			projectMetadata: 'identifiers-only',
			relayConfiguration: 'excluded',
			signerCredentials: 'excluded',
			historyAndTombstones: 'excluded',
		},
		entries: [
			{
				project: 'browser-project',
				environment: 'production',
				sourceCreatedAt: 1_699_999_999,
				sourceEventId: 'cd'.repeat(32),
				secrets: [['API_KEY', 'browser-secret-value']],
			},
		],
	};
	const archive = await encryptBackup(payload, 'browser interoperability passphrase');
	try {
		return await decryptBackup(archive, 'browser interoperability passphrase');
	} finally {
		archive.fill(0);
	}
};

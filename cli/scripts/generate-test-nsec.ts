#!/usr/bin/env bun
/**
 * Generate a test nsec for manual testing
 *
 * Usage: bun run cli/scripts/generate-test-nsec.ts
 */

import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { npubEncode, nsecEncode } from 'nostr-tools/nip19';

const secretKey = generateSecretKey();
const publicKey = getPublicKey(secretKey);

console.log('Generated test Nostr keypair:\n');
console.log('nsec:', nsecEncode(secretKey));
console.log('npub:', npubEncode(publicKey));
console.log('\nUse the nsec above for testing login:');
console.log(`  bun run cli/src/main.ts login --nsec ${nsecEncode(secretKey)}`);

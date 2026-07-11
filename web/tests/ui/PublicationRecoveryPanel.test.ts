/**
 * @vitest-environment jsdom
 */
/// <reference types="@testing-library/jest-dom" />
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const retryPublication = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('$lib/stores/nostr.svelte', () => ({ retryPublication }));

import PublicationRecoveryPanel from '$lib/components/PublicationRecoveryPanel.svelte';
import {
	PUBLICATION_RECOVERY_STORAGE_KEY,
	clearPublicationRecovery,
	finalizePublicationRecovery,
	preparePublicationRecovery,
	restorePublicationRecovery,
} from '$lib/stores/publication-recovery.svelte';

beforeEach(() => {
	sessionStorage.clear();
	clearPublicationRecovery();
	retryPublication.mockClear();
});

afterEach(() => {
	cleanup();
	clearPublicationRecovery();
});

describe('PublicationRecoveryPanel', () => {
	it('shows classified details, retries by event ID, and never renders ciphertext', async () => {
		const privateKey = generateSecretKey();
		const ownerPubkey = getPublicKey(privateKey);
		const event = finalizeEvent(
			{
				kind: 1059,
				created_at: Math.floor(Date.now() / 1000),
				tags: [
					['p', ownerPubkey],
					['t', 'redshift-secrets'],
				],
				content: 'ciphertext-must-not-render',
			},
			generateSecretKey(),
		);
		preparePublicationRecovery(
			event,
			[
				'wss://accepted-one.test',
				'wss://accepted-two.test',
				'wss://accepted-three.test',
				'wss://rejected.test',
				'wss://offline.test',
			],
			{ ownerPubkey, project: 'project', environment: 'dev' },
		);
		finalizePublicationRecovery(event.id, {
			operationId: event.id,
			required: 3,
			accepted: [
				'wss://accepted-one.test/',
				'wss://accepted-two.test/',
				'wss://accepted-three.test/',
			],
			failed: [
				{ target: 'wss://rejected.test/', reason: 'restricted: policy' },
				{ target: 'wss://offline.test/', reason: 'timeout' },
			],
			outcomes: [
				{ target: 'wss://accepted-one.test/', state: 'accepted' },
				{ target: 'wss://accepted-two.test/', state: 'accepted' },
				{ target: 'wss://accepted-three.test/', state: 'accepted' },
				{ target: 'wss://rejected.test/', state: 'rejected', reason: 'restricted: policy' },
				{ target: 'wss://offline.test/', state: 'unavailable', reason: 'timeout' },
			],
		});

		render(PublicationRecoveryPanel);
		expect(screen.getByText('Saved with degraded relay redundancy')).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: 'Details' }));
		expect(screen.getAllByText('accepted')).toHaveLength(3);
		expect(screen.getByText('rejected')).toBeInTheDocument();
		expect(screen.getByText('unavailable')).toBeInTheDocument();
		expect(screen.queryByText('ciphertext-must-not-render')).not.toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: 'Retry unavailable relays' }));
		expect(retryPublication).toHaveBeenCalledWith(event.id);
		await fireEvent.click(screen.getByRole('button', { name: /Dismiss notice/ }));
		await waitFor(() =>
			expect(screen.queryByText('Saved with degraded relay redundancy')).not.toBeInTheDocument(),
		);
	});

	it('renders invalid-storage feedback even when no recovery records remain', () => {
		const ownerPubkey = getPublicKey(generateSecretKey());
		sessionStorage.setItem(PUBLICATION_RECOVERY_STORAGE_KEY, '{invalid');
		restorePublicationRecovery(ownerPubkey);
		render(PublicationRecoveryPanel);
		expect(screen.getByRole('alert')).toHaveTextContent('invalid and was removed');
	});

	it('does not label a below-quorum publication as saved and contains retry rejection', async () => {
		const privateKey = generateSecretKey();
		const ownerPubkey = getPublicKey(privateKey);
		const event = finalizeEvent(
			{
				kind: 1059,
				created_at: Math.floor(Date.now() / 1000),
				tags: [
					['p', ownerPubkey],
					['t', 'redshift-secrets'],
				],
				content: 'ciphertext',
			},
			privateKey,
		);
		preparePublicationRecovery(event, ['wss://one.test', 'wss://two.test', 'wss://three.test'], {
			ownerPubkey,
		});
		finalizePublicationRecovery(event.id, {
			operationId: event.id,
			required: 2,
			accepted: ['wss://one.test/'],
			failed: [
				{ target: 'wss://two.test/', reason: 'timeout' },
				{ target: 'wss://three.test/', reason: 'timeout' },
			],
			outcomes: [
				{ target: 'wss://one.test/', state: 'accepted' },
				{ target: 'wss://two.test/', state: 'unavailable', reason: 'timeout' },
				{ target: 'wss://three.test/', state: 'unavailable', reason: 'timeout' },
			],
		});
		render(PublicationRecoveryPanel);
		expect(screen.getByText('Relay publication needs recovery')).toBeInTheDocument();
		expect(screen.queryByText('Saved with degraded relay redundancy')).not.toBeInTheDocument();
		retryPublication.mockRejectedValueOnce(new Error('still offline'));
		await fireEvent.click(screen.getByRole('button', { name: 'Details' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Retry unavailable relays' }));
		await waitFor(() => expect(retryPublication).toHaveBeenCalledWith(event.id));
	});
});

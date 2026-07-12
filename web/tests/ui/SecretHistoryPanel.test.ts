/**
 * @vitest-environment jsdom
 */
/// <reference types="@testing-library/jest-dom" />
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import type { SecretHistoryObservation } from '@redshift/crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { state, restoreVersion } = vi.hoisted(() => ({
	state: {
		observation: { versions: [], observedEvents: 0, truncated: false } as SecretHistoryObservation,
		isLoading: false,
		isRestoring: false,
		error: null as string | null,
		restoreError: null as string | null,
		conflict: null as { expectedEventId: string | null; observedEventId: string | null } | null,
	},
	restoreVersion: vi.fn(),
}));

vi.mock('$lib/stores/secrets.svelte', () => ({
	getSecretHistoryState: () => state,
	restoreSecretHistoryVersion: restoreVersion,
}));

import SecretHistoryPanel from '$lib/components/SecretHistoryPanel.svelte';

const ids = {
	current: 'a'.repeat(64),
	older: 'b'.repeat(64),
	tombstone: 'c'.repeat(64),
};

function observation(): SecretHistoryObservation {
	return {
		versions: [
			{
				eventId: ids.current,
				dTag: 'project|dev',
				createdAt: 103,
				secrets: { API_KEY: 'current-value', SHARED: 'same' },
				tombstone: false,
				current: true,
			},
			{
				eventId: ids.older,
				dTag: 'project|dev',
				createdAt: 102,
				secrets: { API_KEY: 'older-value', OLD_ONLY: 'removed', SHARED: 'same' },
				tombstone: false,
				current: false,
			},
			{
				eventId: ids.tombstone,
				dTag: 'project|dev',
				createdAt: 101,
				secrets: {},
				tombstone: true,
				current: false,
			},
		],
		observedEvents: 3,
		truncated: true,
	};
}

beforeEach(() => {
	state.observation = observation();
	state.isLoading = false;
	state.isRestoring = false;
	state.error = null;
	state.restoreError = null;
	state.conflict = null;
	restoreVersion.mockReset().mockResolvedValue({ id: 'd'.repeat(64) });
});

afterEach(() => cleanup());

describe('SecretHistoryPanel', () => {
	it('shows bounded metadata, tombstones, and key-only comparison without values', async () => {
		render(SecretHistoryPanel);
		await fireEvent.click(screen.getByRole('button', { name: 'History' }));
		expect(screen.getByText(/observed from responding relays/i)).toBeInTheDocument();
		expect(screen.getByText(/truncated by a fixed safety bound/i)).toBeInTheDocument();
		expect(screen.getByText('Current')).toBeInTheDocument();
		expect(screen.getByText('Tombstone')).toBeInTheDocument();
		expect(screen.queryByText('current-value')).not.toBeInTheDocument();
		expect(screen.queryByText('older-value')).not.toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: `Compare from ${ids.older}` }));
		await fireEvent.click(screen.getByRole('button', { name: `Compare to ${ids.current}` }));
		expect(screen.getByText(/Changed: API_KEY/)).toBeInTheDocument();
		expect(screen.getByText(/Removed: OLD_ONLY/)).toBeInTheDocument();
		expect(screen.getByText(/Unchanged: SHARED/)).toBeInTheDocument();
	});

	it('requires explicit full-bundle and tombstone restore confirmation', async () => {
		render(SecretHistoryPanel);
		await fireEvent.click(screen.getByRole('button', { name: 'History' }));
		await fireEvent.click(screen.getByRole('button', { name: `Restore ${ids.older}` }));
		expect(screen.getByText(/replace the complete current bundle/i)).toBeInTheDocument();
		expect(screen.getByText('Confirm history restore')).toHaveFocus();
		await fireEvent.click(screen.getByRole('button', { name: 'Confirm restore' }));
		await waitFor(() => expect(restoreVersion).toHaveBeenCalledWith(ids.older, ids.current, false));

		await fireEvent.click(screen.getByRole('button', { name: `Restore ${ids.tombstone}` }));
		expect(screen.getByText(/publish a newer logical tombstone/i)).toBeInTheDocument();
	});

	it('requires a second explicit action when refreshed current state changed', async () => {
		restoreVersion.mockImplementationOnce(async () => {
			state.conflict = { expectedEventId: ids.current, observedEventId: 'd'.repeat(64) };
			throw new Error('Authenticated current changed during history restore preflight');
		});
		render(SecretHistoryPanel);
		await fireEvent.click(screen.getByRole('button', { name: 'History' }));
		await fireEvent.click(screen.getByRole('button', { name: `Restore ${ids.older}` }));
		await fireEvent.click(screen.getByRole('button', { name: 'Confirm restore' }));
		await waitFor(() =>
			expect(screen.getByText(/newer current version was observed/i)).toBeInTheDocument(),
		);
		expect(screen.getByText(/newer current version was observed/i)).toHaveFocus();
		await fireEvent.click(screen.getByRole('button', { name: 'Overwrite newer current' }));
		expect(restoreVersion).toHaveBeenLastCalledWith(ids.older, ids.current, true);
	});

	it('renders loading, empty, and fail-closed error states', async () => {
		state.isLoading = true;
		const loading = render(SecretHistoryPanel);
		await fireEvent.click(screen.getByRole('button', { name: 'History' }));
		expect(screen.getByText('Loading authenticated history…')).toBeInTheDocument();
		loading.unmount();

		state.isLoading = false;
		state.observation = { versions: [], observedEvents: 0, truncated: false };
		state.error = 'Remote signer could not decrypt observed secret state';
		render(SecretHistoryPanel);
		await fireEvent.click(screen.getByRole('button', { name: 'History' }));
		expect(screen.getByRole('alert')).toHaveTextContent('Remote signer');
	});
});

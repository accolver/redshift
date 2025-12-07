/**
 * @vitest-environment jsdom
 */
/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/svelte';
import MultiEnvSaveModal from '$lib/components/MultiEnvSaveModal.svelte';
import type { Environment } from '$lib/types/nostr';

describe('MultiEnvSaveModal', () => {
	const mockEnvironments: Environment[] = [
		{ id: 'env-1', name: 'Development', slug: 'dev', createdAt: Date.now() },
		{ id: 'env-2', name: 'Staging', slug: 'staging', createdAt: Date.now() },
		{ id: 'env-3', name: 'Production', slug: 'prod', createdAt: Date.now() },
	];

	const defaultProps = {
		open: true,
		secretKey: 'API_KEY',
		secretValue: 'sk-test-12345',
		currentEnvSlug: 'dev',
		environments: mockEnvironments,
		onOpenChange: vi.fn(),
		onSave: vi.fn().mockResolvedValue(undefined),
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		// Clean up components to prevent bits-ui body-scroll-lock cleanup errors
		cleanup();
	});

	it('renders the modal with secret key in description', () => {
		render(MultiEnvSaveModal, { props: defaultProps });

		expect(screen.getByText('Save to Multiple Environments')).toBeInTheDocument();
		expect(screen.getByText('API_KEY')).toBeInTheDocument();
	});

	it('shows truncated value preview', () => {
		render(MultiEnvSaveModal, { props: defaultProps });

		expect(screen.getByText('sk-test-12345')).toBeInTheDocument();
	});

	it('truncates long values with ellipsis', () => {
		const longValue = 'a'.repeat(60);
		render(MultiEnvSaveModal, {
			props: { ...defaultProps, secretValue: longValue },
		});

		expect(screen.getByText('a'.repeat(50) + '...')).toBeInTheDocument();
	});

	it('shows (empty) for empty values', () => {
		render(MultiEnvSaveModal, {
			props: { ...defaultProps, secretValue: '' },
		});

		expect(screen.getByText('(empty)')).toBeInTheDocument();
	});

	it('displays all environments with current marked', () => {
		render(MultiEnvSaveModal, { props: defaultProps });

		expect(screen.getByText('Development')).toBeInTheDocument();
		expect(screen.getByText('Staging')).toBeInTheDocument();
		expect(screen.getByText('Production')).toBeInTheDocument();
		expect(screen.getByText('current')).toBeInTheDocument();
	});

	it('has current environment selected by default', () => {
		render(MultiEnvSaveModal, { props: defaultProps });

		// The save button should show "Save to 1 environment"
		expect(screen.getByText(/Save to 1 environment/)).toBeInTheDocument();
	});

	it('allows selecting additional environments', async () => {
		render(MultiEnvSaveModal, { props: defaultProps });

		// Click on Staging environment
		const stagingButton = screen.getByText('Staging').closest('button');
		expect(stagingButton).toBeInTheDocument();
		await fireEvent.click(stagingButton!);

		// Should now show 2 environments
		expect(screen.getByText(/Save to 2 environments/)).toBeInTheDocument();
	});

	it('prevents deselecting current environment', async () => {
		render(MultiEnvSaveModal, { props: defaultProps });

		// The Development button should be disabled
		const devButton = screen.getByText('Development').closest('button');
		expect(devButton).toBeDisabled();
	});

	it('select all selects all environments', async () => {
		render(MultiEnvSaveModal, { props: defaultProps });

		const selectAllButton = screen.getByText('Select all');
		await fireEvent.click(selectAllButton);

		expect(screen.getByText(/Save to 3 environments/)).toBeInTheDocument();
	});

	it('current only deselects all except current', async () => {
		render(MultiEnvSaveModal, { props: defaultProps });

		// First select all
		const selectAllButton = screen.getByText('Select all');
		await fireEvent.click(selectAllButton);
		expect(screen.getByText(/Save to 3 environments/)).toBeInTheDocument();

		// Then click current only
		const currentOnlyButton = screen.getByText('Current only');
		await fireEvent.click(currentOnlyButton);

		expect(screen.getByText(/Save to 1 environment/)).toBeInTheDocument();
	});

	it('calls onSave with selected environment slugs', async () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		render(MultiEnvSaveModal, { props: { ...defaultProps, onSave } });

		// Select Staging
		const stagingButton = screen.getByText('Staging').closest('button');
		await fireEvent.click(stagingButton!);

		// Click save
		const saveButton = screen.getByText(/Save to 2 environments/);
		await fireEvent.click(saveButton);

		await waitFor(() => {
			expect(onSave).toHaveBeenCalledWith(expect.arrayContaining(['dev', 'staging']));
		});
	});

	it('calls onOpenChange(false) after successful save', async () => {
		const onOpenChange = vi.fn();
		const onSave = vi.fn().mockResolvedValue(undefined);
		render(MultiEnvSaveModal, { props: { ...defaultProps, onOpenChange, onSave } });

		const saveButton = screen.getByText(/Save to 1 environment/);
		await fireEvent.click(saveButton);

		await waitFor(() => {
			expect(onOpenChange).toHaveBeenCalledWith(false);
		});
	});

	it('shows error message when save fails', async () => {
		const onSave = vi.fn().mockRejectedValue(new Error('Network error'));
		render(MultiEnvSaveModal, { props: { ...defaultProps, onSave } });

		const saveButton = screen.getByText(/Save to 1 environment/);
		await fireEvent.click(saveButton);

		await waitFor(() => {
			expect(screen.getByText('Network error')).toBeInTheDocument();
		});
	});

	it('shows loading state while saving', async () => {
		// Create a promise we can control
		let resolvePromise: () => void;
		const savePromise = new Promise<void>((resolve) => {
			resolvePromise = resolve;
		});
		const onSave = vi.fn().mockReturnValue(savePromise);

		render(MultiEnvSaveModal, { props: { ...defaultProps, onSave } });

		const saveButton = screen.getByText(/Save to 1 environment/);
		await fireEvent.click(saveButton);

		// Should show saving state
		expect(screen.getByText('Saving...')).toBeInTheDocument();

		// Resolve the promise
		resolvePromise!();
	});

	it('cancel button closes the modal', async () => {
		const onOpenChange = vi.fn();
		render(MultiEnvSaveModal, { props: { ...defaultProps, onOpenChange } });

		const cancelButton = screen.getByText('Cancel');
		await fireEvent.click(cancelButton);

		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it('resets selection when modal reopens', async () => {
		const { rerender } = render(MultiEnvSaveModal, { props: defaultProps });

		// Select all environments
		const selectAllButton = screen.getByText('Select all');
		await fireEvent.click(selectAllButton);
		expect(screen.getByText(/Save to 3 environments/)).toBeInTheDocument();

		// Close and reopen modal
		await rerender({ ...defaultProps, open: false });
		await rerender({ ...defaultProps, open: true });

		// Should be back to just current environment
		expect(screen.getByText(/Save to 1 environment/)).toBeInTheDocument();
	});
});

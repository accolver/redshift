/**
 * @vitest-environment jsdom
 */
/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import SecretTable from '$lib/components/SecretTable.svelte';

describe('SecretTable', () => {
	const mockSecrets = [
		{ key: 'API_KEY', value: 'sk-test-123' },
		{ key: 'DATABASE_URL', value: 'postgres://localhost/db' }
	];

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders secrets in a table', () => {
		render(SecretTable, { props: { secrets: mockSecrets } });

		expect(screen.getByText('API_KEY')).toBeInTheDocument();
		expect(screen.getByText('DATABASE_URL')).toBeInTheDocument();
	});

	it('hides secret values by default', () => {
		render(SecretTable, { props: { secrets: mockSecrets } });

		// Values should be masked
		expect(screen.queryByText('sk-test-123')).not.toBeInTheDocument();
		expect(screen.queryByText('postgres://localhost/db')).not.toBeInTheDocument();

		// Should show masked characters instead
		const maskedCells = screen.getAllByText(/^•+$/);
		expect(maskedCells.length).toBeGreaterThan(0);
	});

	it('shows secret value when show button is clicked', async () => {
		render(SecretTable, { props: { secrets: mockSecrets } });

		// Find the first show button
		const showButtons = screen.getAllByRole('button', { name: /show/i });
		await fireEvent.click(showButtons[0]);

		// Now the value should be visible
		expect(screen.getByText('sk-test-123')).toBeInTheDocument();
	});

	it('hides value again when hide button is clicked', async () => {
		render(SecretTable, { props: { secrets: mockSecrets } });

		// Show the value
		const showButton = screen.getAllByRole('button', { name: /show/i })[0];
		await fireEvent.click(showButton);
		expect(screen.getByText('sk-test-123')).toBeInTheDocument();

		// Hide it again
		const hideButton = screen.getByRole('button', { name: /hide/i });
		await fireEvent.click(hideButton);
		expect(screen.queryByText('sk-test-123')).not.toBeInTheDocument();
	});

	it('calls onDelete when delete button is clicked', async () => {
		const onDelete = vi.fn();
		render(SecretTable, { props: { secrets: mockSecrets, onDelete } });

		const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
		await fireEvent.click(deleteButtons[0]);

		expect(onDelete).toHaveBeenCalledWith('API_KEY');
	});

	it('calls onEdit when edit button is clicked', async () => {
		const onEdit = vi.fn();
		render(SecretTable, { props: { secrets: mockSecrets, onEdit } });

		const editButtons = screen.getAllByRole('button', { name: /edit/i });
		await fireEvent.click(editButtons[0]);

		expect(onEdit).toHaveBeenCalledWith('API_KEY', 'sk-test-123');
	});

	it('shows empty state when no secrets', () => {
		render(SecretTable, { props: { secrets: [] } });

		expect(screen.getByText(/no secrets/i)).toBeInTheDocument();
	});

	it('updates local state when editing a cell value', async () => {
		const onEdit = vi.fn();
		render(SecretTable, {
			props: { secrets: mockSecrets, onEdit, editable: true }
		});

		// Click edit button to enable editing
		const editButtons = screen.getAllByRole('button', { name: /edit/i });
		await fireEvent.click(editButtons[0]);

		// Find the input field
		const input = screen.getByDisplayValue('sk-test-123');
		expect(input).toBeInTheDocument();

		// Change the value
		await fireEvent.input(input, { target: { value: 'new-value-123' } });

		// Save the change
		const saveButton = screen.getByRole('button', { name: /save/i });
		await fireEvent.click(saveButton);

		expect(onEdit).toHaveBeenCalledWith('API_KEY', 'new-value-123');
	});
});

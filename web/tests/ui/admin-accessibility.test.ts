import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LoginDialog from '$lib/components/LoginDialog.svelte';
import adminLayoutSource from '../../src/routes/admin/+layout.svelte?raw';

describe('admin authentication accessibility', () => {
	afterEach(cleanup);

	it('renders named private-key controls and announces an authentication error', async () => {
		render(LoginDialog, { props: { open: true, onOpenChange: vi.fn() } });
		await fireEvent.click(screen.getByRole('button', { name: /Private Key \(nsec\)/ }));

		const privateKey = screen.getByLabelText('Private Key');
		expect(privateKey).toHaveAttribute('type', 'password');
		await fireEvent.click(screen.getByRole('button', { name: 'Reveal private key' }));
		expect(privateKey).toHaveAttribute('type', 'text');
		expect(screen.getByRole('button', { name: 'Hide private key' })).toBeInTheDocument();

		await fireEvent.input(privateKey, { target: { value: 'not-a-valid-nsec' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
		await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Invalid'));
	});

	it('gives the admin search control an explicit accessible name', () => {
		expect(adminLayoutSource).toContain('aria-label="Search projects and secrets"');
	});
});

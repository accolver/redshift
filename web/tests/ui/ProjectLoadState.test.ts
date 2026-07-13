import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProjectLoadState from '$lib/components/ProjectLoadState.svelte';

describe('ProjectLoadState', () => {
	afterEach(cleanup);

	it('announces a load error and invokes retry from the rendered control', async () => {
		const onRetry = vi.fn();
		render(ProjectLoadState, {
			props: { error: 'Relay query failed', isLoading: false, onRetry },
		});

		expect(screen.getByRole('alert')).toHaveTextContent('Relay query failed');
		await fireEvent.click(screen.getByRole('button', { name: 'Retry loading projects' }));
		expect(onRetry).toHaveBeenCalledTimes(1);
	});

	it('announces loading without exposing a retry button', () => {
		render(ProjectLoadState, {
			props: { error: null, isLoading: true, onRetry: vi.fn() },
		});

		expect(screen.getByRole('status')).toHaveTextContent('Loading projects from relays');
		expect(screen.queryByRole('button', { name: 'Retry loading projects' })).toBeNull();
	});
});

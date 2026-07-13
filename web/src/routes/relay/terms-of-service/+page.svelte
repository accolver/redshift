<script lang="ts">
import Navbar from '$lib/components/Navbar.svelte';
</script>

<svelte:head>
	<title>Draft Relay Terms - Redshift</title>
	<meta name="description" content="Non-operative draft notice for a proposed Redshift managed relay." />
</svelte:head>

<Navbar />

<div class="mx-auto max-w-4xl px-4 pt-24 pb-16">
	<header class="mb-10">
		<p class="mb-3 font-medium text-tokyo-orange">Draft — non-operative</p>
		<h1 class="mb-4 text-4xl font-bold">Managed Relay Terms</h1>
	</header>

	<article class="prose prose-invert max-w-none">
		<p>
			Redshift has not launched a Cloud subscription, paid managed relay, retention policy, or
			service-level agreement. This page is not an offer, contract, or effective terms of service.
		</p>
		<p>
			Any future managed-relay launch requires an approved product proposal, verified production
			operations, and legal review. Reviewed launch terms must identify the operator, service scope,
			payment and cancellation rules, retention behavior, availability commitments (if any), and
			applicable user rights before they become operative.
		</p>
		<p>
			The currently shipped individual CLI and dashboard remain open-source software governed by
			the repository license and documented security boundaries. Users should not rely on this draft
			page for legal or operational commitments.
		</p>
	</article>
</div>

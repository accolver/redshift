<script lang="ts">
import Navbar from '$lib/components/Navbar.svelte';
</script>

<svelte:head>
	<title>Draft Relay Privacy Notice - Redshift</title>
	<meta name="description" content="Non-operative draft privacy notice for a proposed Redshift managed relay." />
</svelte:head>

<Navbar />

<div class="mx-auto max-w-4xl px-4 pt-24 pb-16">
	<header class="mb-10">
		<p class="mb-3 font-medium text-tokyo-orange">Draft — non-operative</p>
		<h1 class="mb-4 text-4xl font-bold">Managed Relay Privacy Notice</h1>
	</header>

	<article class="prose prose-invert max-w-none">
		<p>
			Redshift has not launched a Cloud subscription or paid managed-relay service. This page is
			not an operative privacy policy and does not establish a production data-processing or
			retention practice.
		</p>
		<p>
			The development candidate is designed for NIP-59 encrypted Gift Wrap events; operators can
			still observe transport and outer-event metadata. No production logging duration, encrypted
			managed backup, retention period, geographic processing scope, or telemetry program is
			approved. Redshift's no-surveillance constraint forbids identifying product telemetry.
		</p>
		<p>
			Before any managed launch, reviewed terms and privacy documentation must truthfully identify
			the operator, processors, metadata collected, purposes, retention, security controls, user
			rights, and contact path based on the exact approved deployment. Until then, users should not
			rely on this draft for legal or operational commitments.
		</p>
	</article>
</div>

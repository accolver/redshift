/**
 * Audit Service
 *
 * Creates and publishes audit events for Cloud subscribers.
 * Audit events are NIP-59 Gift Wrapped and encrypted with NIP-44 so only
 * the user can read their own audit logs.
 *
 * Audit logging is only enabled for users with an active Cloud subscription.
 */

import { createAuditEvent, type AuditAction, type AuditDetails } from '@redshift/cloud';
import { getAuthState, getPrivateKey } from '$lib/stores/auth.svelte';
import { hasActiveSubscription } from '$lib/stores/subscription.svelte';
import { publishEvent } from '$lib/stores/nostr.svelte';
import { getEffectiveRelays } from '$lib/stores/relay-settings.svelte';
import { bytesToHex } from 'nostr-tools/utils';

/**
 * Audit event options
 */
export interface AuditOptions {
	/** The action being audited */
	action: AuditAction;
	/** Target resource (e.g., project/environment identifier) */
	target: string;
	/** Optional additional details */
	details?: AuditDetails;
}

/**
 * Publish an audit event
 *
 * Only creates and publishes audit events if the user has an active
 * Cloud subscription. Silently no-ops for free tier users.
 *
 * @param options - Audit event options
 * @returns True if the audit event was published, false if skipped
 *
 * @example
 * ```typescript
 * await publishAuditEvent({
 *   action: 'secret:create',
 *   target: 'my-project/production',
 *   details: {
 *     description: 'Created API_KEY secret',
 *     context: { secretName: 'API_KEY' },
 *   },
 * });
 * ```
 */
export async function publishAuditEvent(options: AuditOptions): Promise<boolean> {
	// Only audit for Cloud subscribers
	if (!hasActiveSubscription()) {
		return false;
	}

	const auth = getAuthState();
	if (!auth.isConnected || !auth.pubkey) {
		return false;
	}

	// Get private key for signing and encrypting the audit event
	const privateKey = await getPrivateKey();
	if (!privateKey) {
		// Can't create audit events without private key
		// (NIP-07/bunker doesn't expose private key for self-encryption)
		console.warn('Audit logging requires nsec login for self-encryption');
		return false;
	}

	try {
		// Convert Uint8Array to hex string
		const privkeyHex = bytesToHex(privateKey);

		// Create the audit event
		const { event } = createAuditEvent({
			userPubkey: auth.pubkey,
			userPrivkey: privkeyHex,
			action: options.action,
			target: options.target,
			details: options.details,
		});

		// Publish to relays
		const relays = getEffectiveRelays();
		await publishEvent(event, relays);

		return true;
	} catch (err) {
		// Log error but don't fail the main operation
		console.error('Failed to publish audit event:', err);
		return false;
	}
}

/**
 * Convenience function to audit a secret creation
 */
export async function auditSecretCreate(
	projectSlug: string,
	environmentSlug: string,
	secretName: string,
): Promise<boolean> {
	return publishAuditEvent({
		action: 'secret:create',
		target: `${projectSlug}/${environmentSlug}`,
		details: {
			description: `Created secret ${secretName}`,
			context: { secretName },
		},
	});
}

/**
 * Convenience function to audit a secret update
 */
export async function auditSecretUpdate(
	projectSlug: string,
	environmentSlug: string,
	secretName: string,
): Promise<boolean> {
	return publishAuditEvent({
		action: 'secret:update',
		target: `${projectSlug}/${environmentSlug}`,
		details: {
			description: `Updated secret ${secretName}`,
			context: { secretName },
		},
	});
}

/**
 * Convenience function to audit a secret deletion
 */
export async function auditSecretDelete(
	projectSlug: string,
	environmentSlug: string,
	secretName: string,
): Promise<boolean> {
	return publishAuditEvent({
		action: 'secret:delete',
		target: `${projectSlug}/${environmentSlug}`,
		details: {
			description: `Deleted secret ${secretName}`,
			context: { secretName },
		},
	});
}

/**
 * Convenience function to audit a secret read/export
 */
export async function auditSecretRead(
	projectSlug: string,
	environmentSlug: string,
	context?: string,
): Promise<boolean> {
	return publishAuditEvent({
		action: 'secret:read',
		target: `${projectSlug}/${environmentSlug}`,
		details: {
			description: context || 'Read secrets',
		},
	});
}

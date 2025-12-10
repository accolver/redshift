/**
 * Audit Service for CLI
 *
 * Creates and publishes audit events for Cloud subscribers.
 * Audit events are NIP-59 Gift Wrapped and encrypted with NIP-44 so only
 * the user can read their own audit logs.
 *
 * Audit logging is only enabled for users with an active Cloud subscription.
 */

import { getPublicKey } from 'nostr-tools/pure';
import { bytesToHex } from 'nostr-tools/utils';
import { createAuditEvent, type AuditAction, type AuditDetails } from '@redshift/cloud';
import { loadConfig, getRelays } from './config';
import { createRelayPool } from './relay';

/**
 * Check if user has an active Cloud subscription from cache
 */
async function hasActiveSubscription(pubkey: string): Promise<boolean> {
	try {
		const config = await loadConfig();
		const cached = config.subscription;

		if (!cached || cached.pubkey !== pubkey) {
			return false;
		}

		return cached.status.active === true;
	} catch {
		return false;
	}
}

/**
 * Publish an audit event for a CLI operation
 *
 * Only creates and publishes audit events if the user has an active
 * Cloud subscription. Silently no-ops for free tier users.
 *
 * @param privateKey - User's private key
 * @param action - The audit action
 * @param target - Target resource (e.g., project/environment)
 * @param details - Optional additional details
 * @returns True if audit was published, false if skipped
 */
export async function publishCliAuditEvent(
	privateKey: Uint8Array,
	action: AuditAction,
	target: string,
	details?: AuditDetails,
): Promise<boolean> {
	const pubkey = getPublicKey(privateKey);

	// Only audit for Cloud subscribers
	const isSubscribed = await hasActiveSubscription(pubkey);
	if (!isSubscribed) {
		return false;
	}

	try {
		// Create the audit event
		const privkeyHex = bytesToHex(privateKey);
		const { event } = createAuditEvent({
			userPubkey: pubkey,
			userPrivkey: privkeyHex,
			action,
			target,
			details,
		});

		// Get relays and publish
		const relays = await getRelays();
		const pool = createRelayPool(relays, { enableRateLimiting: false });

		try {
			// Publish with timeout
			const publishPromise = pool.publish(event);
			const timeoutPromise = new Promise<void>((_, reject) =>
				setTimeout(() => reject(new Error('Audit publish timeout')), 5000),
			);

			await Promise.race([publishPromise, timeoutPromise]);
			return true;
		} finally {
			pool.close();
		}
	} catch {
		// Log error but don't fail the main operation
		// Audit logging is best-effort
		return false;
	}
}

/**
 * Convenience function to audit a secret creation
 */
export async function auditSecretCreate(
	privateKey: Uint8Array,
	projectId: string,
	environment: string,
	secretName: string,
): Promise<boolean> {
	return publishCliAuditEvent(privateKey, 'secret:create', `${projectId}/${environment}`, {
		description: `Created secret ${secretName}`,
		context: { secretName },
	});
}

/**
 * Convenience function to audit a secret update
 */
export async function auditSecretUpdate(
	privateKey: Uint8Array,
	projectId: string,
	environment: string,
	secretName: string,
): Promise<boolean> {
	return publishCliAuditEvent(privateKey, 'secret:update', `${projectId}/${environment}`, {
		description: `Updated secret ${secretName}`,
		context: { secretName },
	});
}

/**
 * Convenience function to audit a secret deletion
 */
export async function auditSecretDelete(
	privateKey: Uint8Array,
	projectId: string,
	environment: string,
	secretName: string,
): Promise<boolean> {
	return publishCliAuditEvent(privateKey, 'secret:delete', `${projectId}/${environment}`, {
		description: `Deleted secret ${secretName}`,
		context: { secretName },
	});
}

/**
 * Convenience function to audit a secret read/export (download)
 */
export async function auditSecretRead(
	privateKey: Uint8Array,
	projectId: string,
	environment: string,
	context?: string,
): Promise<boolean> {
	return publishCliAuditEvent(privateKey, 'secret:read', `${projectId}/${environment}`, {
		description: context || 'Downloaded secrets via CLI',
	});
}

/**
 * Convenience function to audit bulk secret upload
 */
export async function auditSecretUpload(
	privateKey: Uint8Array,
	projectId: string,
	environment: string,
	secretCount: number,
	addedKeys: string[],
	updatedKeys: string[],
): Promise<boolean> {
	return publishCliAuditEvent(privateKey, 'secret:update', `${projectId}/${environment}`, {
		description: `Uploaded ${secretCount} secrets via CLI`,
		context: {
			added: addedKeys,
			updated: updatedKeys,
			count: secretCount,
		},
	});
}

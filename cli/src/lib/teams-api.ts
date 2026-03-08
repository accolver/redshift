/**
 * Teams API Client - HTTP client for bunker admin API
 *
 * Provides authenticated access to team management endpoints
 * using NIP-98 HTTP Auth headers.
 *
 * L4: Integration-Contractor - Bunker admin API contract
 * L2: Function-Author - HTTP client implementation
 */

import type { NostrSigner } from './types';

/** NIP-98 HTTP Auth event kind */
const HTTP_AUTH_KIND = 27235;

/**
 * Team data returned from the admin API
 */
export interface Team {
	id: string;
	name: string;
	slug: string;
	pubkey: string;
	memberCount: number;
	createdAt: string;
}

/**
 * Team member data
 */
export interface Member {
	pubkey: string;
	role: 'admin' | 'developer' | 'readonly';
	email?: string;
	joinedAt: string;
}

/**
 * Invitation result
 */
export interface Invitation {
	id: string;
	teamId: string;
	email?: string;
	pubkey?: string;
	role: string;
	status: 'pending' | 'accepted' | 'expired';
	createdAt: string;
}

/**
 * Key rotation result
 */
export interface KeyRotationResult {
	oldPubkey: string;
	newPubkey: string;
}

/**
 * Invite member parameters
 */
export interface InviteMemberParams {
	email?: string | undefined;
	pubkey?: string | undefined;
	role: string;
}

/**
 * API error response from the bunker
 */
interface ApiErrorResponse {
	error?: string;
	message?: string;
}

/**
 * HTTP client for the bunker admin API.
 *
 * All requests are authenticated using NIP-98 HTTP Auth headers.
 * The client creates a kind 27235 event signed by the user's signer,
 * base64-encodes it, and sends it as `Authorization: Nostr <base64>`.
 */
export class TeamsApiClient {
	constructor(
		private readonly bunkerUrl: string,
		private readonly signer: NostrSigner,
	) {}

	/**
	 * Create a NIP-98 Authorization header for the given URL and method.
	 *
	 * 1. Creates a kind 27235 unsigned event with URL and method tags
	 * 2. Signs it with the signer
	 * 3. Base64-encodes the signed event JSON
	 * 4. Returns `Nostr <base64>`
	 */
	async createAuthHeader(url: string, method: string) {
		const event = {
			kind: HTTP_AUTH_KIND,
			created_at: Math.floor(Date.now() / 1000),
			tags: [
				['u', url],
				['method', method.toUpperCase()],
			],
			content: '',
		};

		const signedEvent = await this.signer.signEvent(event);
		const base64 = btoa(JSON.stringify(signedEvent));
		return `Nostr ${base64}`;
	}

	/**
	 * Make an authenticated request to the bunker admin API.
	 */
	private async request<T>(path: string, method: string, body?: unknown): Promise<T> {
		const url = `${this.bunkerUrl}${path}`;
		const authHeader = await this.createAuthHeader(url, method);

		const headers: Record<string, string> = {
			Authorization: authHeader,
			'Content-Type': 'application/json',
		};

		const response = await fetch(url, {
			method,
			headers,
			body: body ? JSON.stringify(body) : undefined,
		});

		if (!response.ok) {
			let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
			try {
				const errorBody = (await response.json()) as ApiErrorResponse;
				if (errorBody.error) {
					errorMessage = errorBody.error;
				} else if (errorBody.message) {
					errorMessage = errorBody.message;
				}
			} catch {
				// Use default error message if body parsing fails
			}
			throw new Error(errorMessage);
		}

		// Handle 204 No Content
		if (response.status === 204) {
			return undefined as T;
		}

		return (await response.json()) as T;
	}

	/**
	 * Create a new team.
	 */
	async createTeam(name: string, slug: string) {
		return this.request<Team>('/api/admin/teams', 'POST', { name, slug });
	}

	/**
	 * List all teams.
	 */
	async listTeams() {
		return this.request<Team[]>('/api/admin/teams', 'GET');
	}

	/**
	 * Get a team with its members.
	 */
	async getTeam(teamId: string) {
		return this.request<{ team: Team; members: Member[] }>(`/api/admin/teams/${teamId}`, 'GET');
	}

	/**
	 * List members of a team.
	 */
	async listMembers(teamId: string) {
		return this.request<Member[]>(`/api/admin/teams/${teamId}/members`, 'GET');
	}

	/**
	 * Invite a member to a team.
	 */
	async inviteMember(teamId: string, params: InviteMemberParams) {
		return this.request<Invitation>(`/api/admin/teams/${teamId}/invite`, 'POST', params);
	}

	/**
	 * Remove a member from a team.
	 */
	async removeMember(teamId: string, pubkey: string) {
		return this.request<void>(`/api/admin/teams/${teamId}/members/${pubkey}`, 'DELETE');
	}

	/**
	 * Rotate a team's signing key.
	 */
	async rotateKey(teamId: string) {
		return this.request<KeyRotationResult>(`/api/admin/teams/${teamId}/rotate-key`, 'POST');
	}
}

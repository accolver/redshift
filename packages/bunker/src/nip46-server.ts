/**
 * NIP-46 Remote Signer Server for @redshift/bunker
 *
 * Implements the server side of the NIP-46 protocol. Subscribes to Nostr relays
 * for Kind 24133 events addressed to team pubkeys, decrypts requests using NIP-44,
 * routes to method handlers, checks RBAC permissions, and publishes encrypted responses.
 *
 * Architecture:
 *   BunkerServer
 *   ├── Subscribes to relays for Kind 24133 events with p-tag matching team pubkeys
 *   ├── Decrypts incoming requests using NIP-44
 *   ├── Routes to method handlers (connect, get_public_key, sign_event, etc.)
 *   ├── Each handler checks session + RBAC permissions
 *   ├── Signs/encrypts response and publishes back to relay
 *   └── Manages sessions via SessionManager
 */

import type { Database } from 'bun:sqlite';
import { nip44 } from 'nostr-tools';
import type { EventTemplate, Event as NostrEvent } from 'nostr-tools/core';
import { finalizeEvent } from 'nostr-tools/pure';
import type { Nip46Request, Nip46Response, Nip46ServerConfig, TeamKeyInfo } from './nip46-types.js';
import { NIP46_KIND } from './nip46-types.js';
import { getRequiredPermission, hasPermission } from './rbac.js';
import { type CreateSessionOptions, SessionManager } from './session-manager.js';
import type { Member } from './types.js';

/** Error codes for NIP-46 responses */
const ERROR_CODES = {
	UNAUTHORIZED: 'unauthorized',
	FORBIDDEN: 'forbidden',
	INVALID_REQUEST: 'invalid_request',
	INTERNAL_ERROR: 'internal_error',
	SESSION_EXPIRED: 'session_expired',
	UNKNOWN_METHOD: 'unknown_method',
} as const;

/**
 * Callback type for publishing events to relays.
 * The server doesn't manage relay connections directly — the caller provides
 * a publish function that handles the actual relay communication.
 */
export type PublishFn = (event: NostrEvent) => Promise<void>;

/**
 * BunkerServer implements the NIP-46 remote signer protocol.
 *
 * It processes incoming NIP-46 requests, validates sessions and permissions,
 * and delegates signing/encryption to the appropriate team key.
 *
 * Usage:
 * ```typescript
 * const server = new BunkerServer(db, config);
 * server.registerTeamKey({ teamId, pubkey, privateKey });
 *
 * // When a Kind 24133 event arrives from relay subscription:
 * await server.handleEvent(event, publishFn);
 * ```
 */
export class BunkerServer {
	/** Session manager for tracking active connections */
	readonly sessions: SessionManager;

	/** Team keys indexed by pubkey */
	private readonly teamKeys = new Map<string, TeamKeyInfo>();

	/** Database for member lookups */
	private readonly db: Database;

	/** Server configuration */
	private readonly config: Nip46ServerConfig;

	constructor(db: Database, config: Nip46ServerConfig) {
		this.db = db;
		this.config = config;
		this.sessions = new SessionManager(db);
	}

	/**
	 * Start the server — initializes session manager.
	 */
	start() {
		this.sessions.start();
	}

	/**
	 * Stop the server — cleans up session manager.
	 */
	stop() {
		this.sessions.stop();
	}

	/**
	 * Register a team's key pair with the server.
	 * The server will respond to NIP-46 requests addressed to this pubkey.
	 */
	registerTeamKey(keyInfo: TeamKeyInfo) {
		this.teamKeys.set(keyInfo.pubkey, keyInfo);
	}

	/**
	 * Unregister a team's key pair.
	 */
	unregisterTeamKey(pubkey: string) {
		this.teamKeys.delete(pubkey);
	}

	/**
	 * Get all registered team pubkeys (for relay subscription filter).
	 */
	getTeamPubkeys() {
		return Array.from(this.teamKeys.keys());
	}

	/**
	 * Handle an incoming Kind 24133 event from a relay.
	 *
	 * This is the main entry point for processing NIP-46 requests.
	 * It decrypts the event, parses the request, routes to the appropriate
	 * handler, and publishes the encrypted response.
	 *
	 * @param event - The incoming Kind 24133 Nostr event
	 * @param publish - Function to publish the response event to relays
	 */
	async handleEvent(event: NostrEvent, publish: PublishFn) {
		// Validate event kind
		if (event.kind !== NIP46_KIND) {
			return;
		}

		// Find which team this request is addressed to (via p-tag)
		const pTag = event.tags.find((t) => t[0] === 'p');
		const teamPubkey = pTag?.[1];
		if (!teamPubkey) {
			return; // No p-tag, ignore
		}

		// Look up the team key
		const teamKey = this.teamKeys.get(teamPubkey);
		if (!teamKey) {
			return; // Not addressed to a team we manage
		}

		// Decrypt the request using NIP-44
		let decrypted: string;
		try {
			const conversationKey = nip44.v2.utils.getConversationKey(teamKey.privateKey, event.pubkey);
			decrypted = nip44.v2.decrypt(event.content, conversationKey);
		} catch {
			// Cannot decrypt — likely not intended for us or corrupted
			return;
		}

		// Parse the request JSON
		let request: Nip46Request;
		try {
			request = parseNip46Request(decrypted);
		} catch {
			// Invalid request format — send error response
			await this.sendResponse(
				event.pubkey,
				teamKey,
				{ id: 'unknown', result: '', error: ERROR_CODES.INVALID_REQUEST },
				publish,
			);
			return;
		}

		// Route to the appropriate handler
		let response: Nip46Response;
		try {
			response = await this.routeRequest(request, event.pubkey, teamKey);
		} catch {
			response = {
				id: request.id,
				result: '',
				error: ERROR_CODES.INTERNAL_ERROR,
			};
		}

		// Send the encrypted response
		await this.sendResponse(event.pubkey, teamKey, response, publish);
	}

	/**
	 * Route a parsed NIP-46 request to the appropriate handler.
	 */
	private async routeRequest(
		request: Nip46Request,
		senderPubkey: string,
		teamKey: TeamKeyInfo,
	): Promise<Nip46Response> {
		switch (request.method) {
			case 'connect':
				return this.handleConnect(request, senderPubkey, teamKey);
			case 'get_public_key':
				return this.handleGetPublicKey(request, senderPubkey, teamKey);
			case 'sign_event':
				return this.handleSignEvent(request, senderPubkey, teamKey);
			case 'nip44_encrypt':
				return this.handleNip44Encrypt(request, senderPubkey, teamKey);
			case 'nip44_decrypt':
				return this.handleNip44Decrypt(request, senderPubkey, teamKey);
			default:
				return {
					id: request.id,
					result: '',
					error: ERROR_CODES.UNKNOWN_METHOD,
				};
		}
	}

	/**
	 * Handle `connect` request.
	 *
	 * Validates the client pubkey against the authorized member list,
	 * creates a session, and returns "ack".
	 *
	 * Params: [clientPubkey, secret?]
	 */
	private handleConnect(
		request: Nip46Request,
		senderPubkey: string,
		teamKey: TeamKeyInfo,
	): Nip46Response {
		const clientPubkey = request.params[0] ?? senderPubkey;

		// Look up the member by pubkey in this team
		const member = this.findMember(clientPubkey, teamKey.teamId);
		if (!member) {
			return {
				id: request.id,
				result: '',
				error: ERROR_CODES.UNAUTHORIZED,
			};
		}

		// Create a session
		const sessionOptions: CreateSessionOptions = {
			clientPubkey: senderPubkey,
			memberId: member.id,
			teamId: teamKey.teamId,
			teamPubkey: teamKey.pubkey,
			role: member.role,
			timeoutSeconds: this.config.sessionTimeoutSeconds,
		};

		this.sessions.createSession(sessionOptions);

		// Log the connection
		this.logAudit(teamKey.teamId, senderPubkey, 'nip46_connect', clientPubkey);

		return {
			id: request.id,
			result: 'ack',
		};
	}

	/**
	 * Handle `get_public_key` request.
	 *
	 * Returns the team's public key for the active session.
	 * Requires readSecrets permission.
	 */
	private handleGetPublicKey(
		request: Nip46Request,
		senderPubkey: string,
		teamKey: TeamKeyInfo,
	): Nip46Response {
		// Check session and permissions
		const authResult = this.checkAuth(request, senderPubkey);
		if (authResult !== null) {
			return authResult;
		}

		return {
			id: request.id,
			result: teamKey.pubkey,
		};
	}

	/**
	 * Handle `sign_event` request.
	 *
	 * Parses the unsigned event, checks RBAC permissions (writeSecrets),
	 * signs with the team's private key, and returns the signed event JSON.
	 *
	 * Params: [unsignedEventJSON]
	 */
	private handleSignEvent(
		request: Nip46Request,
		senderPubkey: string,
		teamKey: TeamKeyInfo,
	): Nip46Response {
		// Check session and permissions
		const authResult = this.checkAuth(request, senderPubkey);
		if (authResult !== null) {
			return authResult;
		}

		const eventJson = request.params[0];
		if (!eventJson) {
			return {
				id: request.id,
				result: '',
				error: ERROR_CODES.INVALID_REQUEST,
			};
		}

		// Parse the unsigned event
		let eventTemplate: EventTemplate;
		try {
			const parsed: unknown = JSON.parse(eventJson);
			eventTemplate = validateEventTemplate(parsed);
		} catch {
			return {
				id: request.id,
				result: '',
				error: ERROR_CODES.INVALID_REQUEST,
			};
		}

		// Sign the event with the team's private key
		const signedEvent = finalizeEvent(eventTemplate, teamKey.privateKey);

		// Log the signing action
		this.logAudit(teamKey.teamId, senderPubkey, 'nip46_sign_event', `kind:${eventTemplate.kind}`);

		return {
			id: request.id,
			result: JSON.stringify(signedEvent),
		};
	}

	/**
	 * Handle `nip44_encrypt` request.
	 *
	 * Encrypts plaintext using NIP-44 with the team's private key
	 * and the specified third-party pubkey.
	 *
	 * Params: [thirdPartyPubkey, plaintext]
	 */
	private handleNip44Encrypt(
		request: Nip46Request,
		senderPubkey: string,
		teamKey: TeamKeyInfo,
	): Nip46Response {
		// Check session and permissions
		const authResult = this.checkAuth(request, senderPubkey);
		if (authResult !== null) {
			return authResult;
		}

		const thirdPartyPubkey = request.params[0];
		const plaintext = request.params[1];

		if (!thirdPartyPubkey || plaintext === undefined) {
			return {
				id: request.id,
				result: '',
				error: ERROR_CODES.INVALID_REQUEST,
			};
		}

		try {
			const conversationKey = nip44.v2.utils.getConversationKey(
				teamKey.privateKey,
				thirdPartyPubkey,
			);
			const ciphertext = nip44.v2.encrypt(plaintext, conversationKey);

			this.logAudit(teamKey.teamId, senderPubkey, 'nip46_encrypt', thirdPartyPubkey);

			return {
				id: request.id,
				result: ciphertext,
			};
		} catch {
			return {
				id: request.id,
				result: '',
				error: ERROR_CODES.INTERNAL_ERROR,
			};
		}
	}

	/**
	 * Handle `nip44_decrypt` request.
	 *
	 * Decrypts ciphertext using NIP-44 with the team's private key
	 * and the specified third-party pubkey.
	 *
	 * Params: [thirdPartyPubkey, ciphertext]
	 */
	private handleNip44Decrypt(
		request: Nip46Request,
		senderPubkey: string,
		teamKey: TeamKeyInfo,
	): Nip46Response {
		// Check session and permissions
		const authResult = this.checkAuth(request, senderPubkey);
		if (authResult !== null) {
			return authResult;
		}

		const thirdPartyPubkey = request.params[0];
		const ciphertext = request.params[1];

		if (!thirdPartyPubkey || ciphertext === undefined) {
			return {
				id: request.id,
				result: '',
				error: ERROR_CODES.INVALID_REQUEST,
			};
		}

		try {
			const conversationKey = nip44.v2.utils.getConversationKey(
				teamKey.privateKey,
				thirdPartyPubkey,
			);
			const plaintext = nip44.v2.decrypt(ciphertext, conversationKey);

			this.logAudit(teamKey.teamId, senderPubkey, 'nip46_decrypt', thirdPartyPubkey);

			return {
				id: request.id,
				result: plaintext,
			};
		} catch {
			return {
				id: request.id,
				result: '',
				error: ERROR_CODES.INTERNAL_ERROR,
			};
		}
	}

	/**
	 * Check session validity and RBAC permissions for a request.
	 *
	 * @returns null if authorized, or an error Nip46Response
	 */
	private checkAuth(request: Nip46Request, senderPubkey: string): Nip46Response | null {
		// Get the active session
		const active = this.sessions.getSession(senderPubkey);
		if (!active) {
			return {
				id: request.id,
				result: '',
				error: ERROR_CODES.SESSION_EXPIRED,
			};
		}

		// Check RBAC permission
		const requiredPermission = getRequiredPermission(request.method, request.params);
		if (requiredPermission !== null && !hasPermission(active.role, requiredPermission)) {
			return {
				id: request.id,
				result: '',
				error: ERROR_CODES.FORBIDDEN,
			};
		}

		// Update activity timestamp
		this.sessions.touchSession(senderPubkey);

		return null;
	}

	/**
	 * Send an encrypted NIP-46 response to the client.
	 */
	private async sendResponse(
		clientPubkey: string,
		teamKey: TeamKeyInfo,
		response: Nip46Response,
		publish: PublishFn,
	) {
		// Encrypt the response using NIP-44
		const conversationKey = nip44.v2.utils.getConversationKey(teamKey.privateKey, clientPubkey);
		const encrypted = nip44.v2.encrypt(JSON.stringify(response), conversationKey);

		// Create and sign the response event
		const responseEvent = finalizeEvent(
			{
				kind: NIP46_KIND,
				content: encrypted,
				created_at: Math.floor(Date.now() / 1000),
				tags: [['p', clientPubkey]],
			},
			teamKey.privateKey,
		);

		await publish(responseEvent);
	}

	/**
	 * Find a member by pubkey in a specific team.
	 */
	private findMember(pubkey: string, teamId: string): Member | null {
		const row = this.db
			.query<Member, [string, string]>('SELECT * FROM members WHERE pubkey = ? AND team_id = ?')
			.get(pubkey, teamId);

		return row ?? null;
	}

	/**
	 * Log an audit event.
	 */
	private logAudit(teamId: string, actorPubkey: string, action: string, target: string | null) {
		const id = crypto.randomUUID();
		const now = Math.floor(Date.now() / 1000);

		this.db
			.query(
				'INSERT INTO audit_events (id, team_id, actor_pubkey, action, target, created_at) VALUES (?, ?, ?, ?, ?, ?)',
			)
			.run(id, teamId, actorPubkey, action, target, now);
	}
}

/**
 * Parse and validate a NIP-46 request from decrypted JSON.
 *
 * @throws Error if the JSON is not a valid NIP-46 request
 */
export function parseNip46Request(json: string): Nip46Request {
	const parsed: unknown = JSON.parse(json);

	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error('NIP-46 request must be a JSON object');
	}

	const obj = parsed as { id: unknown; method: unknown; params: unknown };

	if (typeof obj.id !== 'string' || obj.id.length === 0) {
		throw new Error('NIP-46 request must have a non-empty string "id"');
	}

	if (typeof obj.method !== 'string' || obj.method.length === 0) {
		throw new Error('NIP-46 request must have a non-empty string "method"');
	}

	// params is optional but must be an array of strings if present
	let params: string[] = [];
	if (obj.params !== undefined) {
		if (!Array.isArray(obj.params)) {
			throw new Error('NIP-46 request "params" must be an array');
		}
		params = (obj.params as unknown[]).map((p) => {
			if (typeof p !== 'string') {
				throw new Error('NIP-46 request params must be strings');
			}
			return p;
		});
	}

	return {
		id: obj.id,
		method: obj.method as Nip46Request['method'],
		params,
	};
}

/**
 * Validate that a parsed object is a valid unsigned event template.
 *
 * @throws Error if the object is not a valid event template
 */
function validateEventTemplate(parsed: unknown): EventTemplate {
	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error('Event template must be a JSON object');
	}

	const obj = parsed as {
		kind: unknown;
		created_at: unknown;
		content: unknown;
		tags: unknown;
	};

	if (typeof obj.kind !== 'number' || !Number.isInteger(obj.kind)) {
		throw new Error('Event template must have an integer "kind"');
	}

	if (typeof obj.created_at !== 'number') {
		throw new Error('Event template must have a number "created_at"');
	}

	if (typeof obj.content !== 'string') {
		throw new Error('Event template must have a string "content"');
	}

	if (!Array.isArray(obj.tags)) {
		throw new Error('Event template must have an array "tags"');
	}

	// Validate tags are arrays of strings
	for (const tag of obj.tags as unknown[]) {
		if (!Array.isArray(tag)) {
			throw new Error('Each tag must be an array');
		}
		for (const item of tag as unknown[]) {
			if (typeof item !== 'string') {
				throw new Error('Tag items must be strings');
			}
		}
	}

	return {
		kind: obj.kind,
		created_at: obj.created_at,
		content: obj.content,
		tags: obj.tags as string[][],
	};
}

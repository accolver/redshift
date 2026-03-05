// Nostr protocol types
// NOTE: This NostrEvent type should eventually be shared from @redshift/crypto
// once the relay package is added as a workspace member.
export interface NostrEvent {
	id: string;
	pubkey: string;
	created_at: number;
	kind: number;
	tags: string[][];
	content: string;
	sig: string;
}

export interface NostrFilter {
	ids?: string[];
	authors?: string[];
	kinds?: number[];
	since?: number;
	until?: number;
	limit?: number;
	cursor?: string;
	'#p'?: string[];
	'#e'?: string[];
	'#t'?: string[];
	'#d'?: string[];
	'#a'?: string[];
	'#r'?: string[];
	'#q'?: string[];
	'#k'?: string[];
	'#l'?: string[];
	'#L'?: string[];
	search?: string;
}

/**
 * Type-safe accessor for tag filter properties on NostrFilter.
 * Use this when the tag name is dynamic (e.g., iterating over unknown tag names).
 */
export function getTagFilter(filter: NostrFilter, tagName: string): string[] | undefined {
	const key = `#${tagName}` as keyof NostrFilter;
	return filter[key] as string[] | undefined;
}

/**
 * Type-safe setter for tag filter properties on NostrFilter.
 * Use this when the tag name is dynamic.
 */
export function setTagFilter(filter: NostrFilter, tagName: string, values: string[]): void {
	const key = `#${tagName}` as keyof NostrFilter;
	(filter as Record<string, unknown>)[key] = values;
}

/**
 * Type-safe deleter for tag filter properties on NostrFilter.
 * Use this when the tag name is dynamic.
 */
export function deleteTagFilter(filter: NostrFilter, tagName: string): void {
	const key = `#${tagName}` as keyof NostrFilter;
	delete (filter as Record<string, unknown>)[key];
}

/**
 * Iterate over all tag filter entries (#p, #e, #t, etc.) in a NostrFilter.
 * Returns [tagKey, values] pairs where tagKey starts with '#'.
 */
export function getTagFilterEntries(filter: NostrFilter): Array<[string, string[]]> {
	const entries: Array<[string, string[]]> = [];
	for (const [key, values] of Object.entries(filter)) {
		if (key.startsWith('#') && Array.isArray(values) && values.length > 0) {
			entries.push([key, values as string[]]);
		}
	}
	return entries;
}

export interface RelayInfo {
	name: string;
	description: string;
	pubkey: string;
	contact: string;
	supported_nips: number[];
	software: string;
	version: string;
	icon: string;
	limitation?: {
		payment_required?: boolean;
		restricted_writes?: boolean;
		[key: string]: boolean | number | string | undefined;
	};
	privacy_policy?: string;
	terms_of_service?: string;
	payments_url?: string;
	fees?: {
		admission?: Array<{ amount: number; unit: string }>;
		subscription?: Array<{ amount: number; unit: string; period: number }>;
		publication?: Array<{ kinds: number[]; amount: number; unit: string }>;
	};
}

export interface Subscription {
	id: string;
	filters: NostrFilter[];
}

export interface QueryResult {
	events: NostrEvent[];
	bookmark: string | null;
}

// Worker environment type
export interface Env {
	RELAY_DATABASE: D1Database;
	RELAY_WEBSOCKET: DurableObjectNamespace;
}

// Durable Object types
export interface RateLimiterConfig {
	rate: number;
	capacity: number;
}

export interface WebSocketSession {
	id: string;
	webSocket: WebSocket;
	subscriptions: Map<string, NostrFilter[]>;
	pubkeyRateLimiter: RateLimiter;
	reqRateLimiter: RateLimiter;
	bookmark: string;
	host: string;
	// NIP-42 Authentication
	challenge?: string;
	authenticatedPubkeys: Set<string>;
}

export class RateLimiter {
	private tokens: number;
	private lastRefillTime: number;
	private capacity: number;
	private fillRate: number;

	constructor(rate: number, capacity: number) {
		this.tokens = capacity;
		this.lastRefillTime = Date.now();
		this.capacity = capacity;
		this.fillRate = rate;
	}

	removeToken(): boolean {
		this.refill();
		if (this.tokens < 1) {
			return false;
		}
		this.tokens -= 1;
		return true;
	}

	private refill(): void {
		const now = Date.now();
		const elapsedTime = now - this.lastRefillTime;
		const tokensToAdd = Math.floor(elapsedTime * this.fillRate);
		this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
		this.lastRefillTime = now;
	}
}

// NIP-05 response type
export interface Nip05Response {
	names: Record<string, string>;
	relays?: Record<string, string[]>;
}

// WebSocket message types for Nostr protocol
export type NostrMessage =
	| ['EVENT', string, NostrEvent]
	| ['EOSE', string]
	| ['OK', string, boolean, string]
	| ['NOTICE', string]
	| ['REQ', string, ...NostrFilter[]]
	| ['CLOSE', string]
	| ['CLOSED', string, string]
	| ['AUTH', string] // Relay sends challenge string
	| ['AUTH', NostrEvent]; // Client sends signed auth event (kind 22242)

// WebSocket event types for Cloudflare Workers
export interface WebSocketEventMap {
	close: CloseEvent;
	error: Event;
	message: MessageEvent;
	open: Event;
}

// Request body types for internal RPC calls
export interface BroadcastEventRequest {
	event: NostrEvent;
}

// Simplified DO-to-DO broadcast request
export interface DOBroadcastRequest {
	event: NostrEvent;
	sourceDoId: string;
}

// Health check response
export interface HealthCheckResponse {
	status: string;
	doName: string;
	sessions: number;
	activeWebSockets: number;
}

// Durable Object interface with hibernation support
export interface DurableObject {
	fetch(request: Request): Promise<Response>;
	// WebSocket hibernation handlers (optional)
	webSocketMessage?(ws: WebSocket, message: string | ArrayBuffer): void | Promise<void>;
	webSocketClose?(
		ws: WebSocket,
		code: number,
		reason: string,
		wasClean: boolean,
	): void | Promise<void>;
	webSocketError?(ws: WebSocket, error: unknown): void | Promise<void>;
}

// Durable Object stub with location hint support
export interface DurableObjectStub {
	fetch(request: Request): Promise<Response>;
}

// Extended Durable Object namespace with location hints
export interface DurableObjectNamespace {
	idFromName(name: string): DurableObjectId;
	get(id: DurableObjectId, options?: { locationHint?: string }): DurableObjectStub;
}

export interface DurableObjectId {
	toString(): string;
	equals(other: DurableObjectId): boolean;
}

// Extended DurableObjectState with hibernation support
export interface DurableObjectState {
	storage: DurableObjectStorage;
	blockConcurrencyWhile<T>(fn: () => Promise<T>): Promise<T>;
	// WebSocket hibernation methods
	acceptWebSocket(ws: WebSocket): void;
	getWebSockets(): WebSocket[];
}

export interface DurableObjectStorage {
	get<T = unknown>(key: string): Promise<T | undefined>;
	get<T = unknown>(keys: string[]): Promise<Map<string, T>>;
	put<T = unknown>(key: string, value: T): Promise<void>;
	put(entries: Record<string, unknown>): Promise<void>;
	delete(key: string): Promise<boolean>;
	delete(keys: string[]): Promise<number>;
	setAlarm(scheduledTime: number | Date): Promise<void>;
	getAlarm(): Promise<number | null>;
	deleteAlarm(): Promise<void>;
}

// Extended WebSocket interface with hibernation attachment methods
declare global {
	interface WebSocket {
		serializeAttachment(value: unknown): void;
		deserializeAttachment(): unknown;
	}
}

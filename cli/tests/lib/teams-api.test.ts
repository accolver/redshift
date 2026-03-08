/**
 * Teams API Client Tests
 *
 * L2: Function-Author - Tests for TeamsApiClient
 * L4: Integration-Contractor - NIP-98 auth header contract
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { verifyEvent } from 'nostr-tools/pure';
import { NsecSigner } from '../../src/lib/signer';
import { TeamsApiClient } from '../../src/lib/teams-api';
import type { Invitation, KeyRotationResult, Member, Team } from '../../src/lib/teams-api';

// Create a test signer
const testSecretKey = generateSecretKey();
const testPubkey = getPublicKey(testSecretKey);
const testSigner = new NsecSigner(testSecretKey);

// Mock server state
let mockServer: ReturnType<typeof Bun.serve> | null = null;
let lastRequest: {
	url: string;
	method: string;
	headers: Record<string, string>;
	body: unknown;
} | null = null;
let mockResponse: { status: number; body: unknown } = { status: 200, body: {} };

const TEST_PORT = 19876;
const TEST_URL = `http://localhost:${TEST_PORT}`;

beforeAll(() => {
	mockServer = Bun.serve({
		port: TEST_PORT,
		async fetch(req) {
			const url = new URL(req.url);
			const headers: Record<string, string> = {};
			req.headers.forEach((value, key) => {
				headers[key] = value;
			});

			let body: unknown = null;
			if (req.method !== 'GET' && req.method !== 'HEAD') {
				try {
					body = await req.json();
				} catch {
					// No body or not JSON
				}
			}

			lastRequest = {
				url: url.pathname,
				method: req.method,
				headers,
				body,
			};

			if (mockResponse.status === 204) {
				return new Response(null, { status: 204 });
			}

			return new Response(JSON.stringify(mockResponse.body), {
				status: mockResponse.status,
				headers: { 'Content-Type': 'application/json' },
			});
		},
	});
});

afterEach(() => {
	lastRequest = null;
	mockResponse = { status: 200, body: {} };
});

afterAll(() => {
	if (mockServer) {
		mockServer.stop();
	}
});

describe('TeamsApiClient', () => {
	describe('createAuthHeader', () => {
		it('creates a valid NIP-98 auth header', async () => {
			const client = new TeamsApiClient(TEST_URL, testSigner);
			const header = await client.createAuthHeader('https://example.com/api/test', 'GET');

			expect(header).toMatch(/^Nostr /);

			// Decode and verify the event
			const base64 = header.slice(6);
			const decoded = JSON.parse(atob(base64));

			expect(decoded.kind).toBe(27235);
			expect(decoded.pubkey).toBe(testPubkey);
			expect(decoded.content).toBe('');

			// Check tags
			const urlTag = decoded.tags.find((t: string[]) => t[0] === 'u');
			expect(urlTag).toBeDefined();
			expect(urlTag[1]).toBe('https://example.com/api/test');

			const methodTag = decoded.tags.find((t: string[]) => t[0] === 'method');
			expect(methodTag).toBeDefined();
			expect(methodTag[1]).toBe('GET');

			// Verify signature
			expect(verifyEvent(decoded)).toBe(true);
		});

		it('uppercases the method in the tag', async () => {
			const client = new TeamsApiClient(TEST_URL, testSigner);
			const header = await client.createAuthHeader('https://example.com/api/test', 'post');

			const base64 = header.slice(6);
			const decoded = JSON.parse(atob(base64));

			const methodTag = decoded.tags.find((t: string[]) => t[0] === 'method');
			expect(methodTag[1]).toBe('POST');
		});

		it('sets created_at to current time', async () => {
			const client = new TeamsApiClient(TEST_URL, testSigner);
			const before = Math.floor(Date.now() / 1000);
			const header = await client.createAuthHeader('https://example.com/api/test', 'GET');
			const after = Math.floor(Date.now() / 1000);

			const base64 = header.slice(6);
			const decoded = JSON.parse(atob(base64));

			expect(decoded.created_at).toBeGreaterThanOrEqual(before);
			expect(decoded.created_at).toBeLessThanOrEqual(after);
		});
	});

	describe('createTeam', () => {
		it('sends POST to /api/admin/teams with name and slug', async () => {
			const team: Team = {
				id: 'team-1',
				name: 'My Team',
				slug: 'my-team',
				pubkey: 'abc123',
				memberCount: 1,
				createdAt: '2025-01-01T00:00:00Z',
			};
			mockResponse = { status: 200, body: team };

			const client = new TeamsApiClient(TEST_URL, testSigner);
			const result = await client.createTeam('My Team', 'my-team');

			expect(lastRequest?.url).toBe('/api/admin/teams');
			expect(lastRequest?.method).toBe('POST');
			expect(lastRequest?.body).toEqual({ name: 'My Team', slug: 'my-team' });
			expect(lastRequest?.headers.authorization).toMatch(/^Nostr /);
			expect(result.name).toBe('My Team');
			expect(result.slug).toBe('my-team');
		});
	});

	describe('listTeams', () => {
		it('sends GET to /api/admin/teams', async () => {
			const teams: Team[] = [
				{
					id: 'team-1',
					name: 'Team A',
					slug: 'team-a',
					pubkey: 'abc123',
					memberCount: 3,
					createdAt: '2025-01-01T00:00:00Z',
				},
			];
			mockResponse = { status: 200, body: teams };

			const client = new TeamsApiClient(TEST_URL, testSigner);
			const result = await client.listTeams();

			expect(lastRequest?.url).toBe('/api/admin/teams');
			expect(lastRequest?.method).toBe('GET');
			expect(result).toHaveLength(1);
			const firstTeam = result[0];
			expect(firstTeam).toBeDefined();
			expect(firstTeam?.name).toBe('Team A');
		});
	});

	describe('getTeam', () => {
		it('sends GET to /api/admin/teams/:id', async () => {
			const response = {
				team: {
					id: 'team-1',
					name: 'Team A',
					slug: 'team-a',
					pubkey: 'abc123',
					memberCount: 1,
					createdAt: '2025-01-01T00:00:00Z',
				},
				members: [
					{
						pubkey: 'member-pub-1',
						role: 'admin',
						email: 'admin@test.com',
						joinedAt: '2025-01-01T00:00:00Z',
					},
				],
			};
			mockResponse = { status: 200, body: response };

			const client = new TeamsApiClient(TEST_URL, testSigner);
			const result = await client.getTeam('team-1');

			expect(lastRequest?.url).toBe('/api/admin/teams/team-1');
			expect(lastRequest?.method).toBe('GET');
			expect(result.team.name).toBe('Team A');
			expect(result.members).toHaveLength(1);
		});
	});

	describe('listMembers', () => {
		it('sends GET to /api/admin/teams/:id/members', async () => {
			const members: Member[] = [
				{
					pubkey: 'member-pub-1',
					role: 'admin',
					email: 'admin@test.com',
					joinedAt: '2025-01-01T00:00:00Z',
				},
				{
					pubkey: 'member-pub-2',
					role: 'developer',
					joinedAt: '2025-02-01T00:00:00Z',
				},
			];
			mockResponse = { status: 200, body: members };

			const client = new TeamsApiClient(TEST_URL, testSigner);
			const result = await client.listMembers('team-1');

			expect(lastRequest?.url).toBe('/api/admin/teams/team-1/members');
			expect(lastRequest?.method).toBe('GET');
			expect(result).toHaveLength(2);
			const firstMember = result[0];
			expect(firstMember).toBeDefined();
			expect(firstMember?.role).toBe('admin');
		});
	});

	describe('inviteMember', () => {
		it('sends POST to /api/admin/teams/:id/invite with email', async () => {
			const invitation: Invitation = {
				id: 'inv-1',
				teamId: 'team-1',
				email: 'user@test.com',
				role: 'developer',
				status: 'pending',
				createdAt: '2025-01-01T00:00:00Z',
			};
			mockResponse = { status: 200, body: invitation };

			const client = new TeamsApiClient(TEST_URL, testSigner);
			const result = await client.inviteMember('team-1', {
				email: 'user@test.com',
				role: 'developer',
			});

			expect(lastRequest?.url).toBe('/api/admin/teams/team-1/invite');
			expect(lastRequest?.method).toBe('POST');
			expect(lastRequest?.body).toEqual({
				email: 'user@test.com',
				role: 'developer',
			});
			expect(result.status).toBe('pending');
		});

		it('sends POST with pubkey instead of email', async () => {
			const invitation: Invitation = {
				id: 'inv-2',
				teamId: 'team-1',
				pubkey: 'npub123',
				role: 'admin',
				status: 'pending',
				createdAt: '2025-01-01T00:00:00Z',
			};
			mockResponse = { status: 200, body: invitation };

			const client = new TeamsApiClient(TEST_URL, testSigner);
			const result = await client.inviteMember('team-1', {
				pubkey: 'npub123',
				role: 'admin',
			});

			expect(lastRequest?.body).toEqual({
				pubkey: 'npub123',
				role: 'admin',
			});
			expect(result.role).toBe('admin');
		});
	});

	describe('removeMember', () => {
		it('sends DELETE to /api/admin/teams/:id/members/:pubkey', async () => {
			mockResponse = { status: 204, body: null };

			const client = new TeamsApiClient(TEST_URL, testSigner);
			await client.removeMember('team-1', 'member-pub-1');

			expect(lastRequest?.url).toBe('/api/admin/teams/team-1/members/member-pub-1');
			expect(lastRequest?.method).toBe('DELETE');
		});
	});

	describe('rotateKey', () => {
		it('sends POST to /api/admin/teams/:id/rotate-key', async () => {
			const result: KeyRotationResult = {
				oldPubkey: 'old-pub-key',
				newPubkey: 'new-pub-key',
			};
			mockResponse = { status: 200, body: result };

			const client = new TeamsApiClient(TEST_URL, testSigner);
			const rotateResult = await client.rotateKey('team-1');

			expect(lastRequest?.url).toBe('/api/admin/teams/team-1/rotate-key');
			expect(lastRequest?.method).toBe('POST');
			expect(rotateResult.oldPubkey).toBe('old-pub-key');
			expect(rotateResult.newPubkey).toBe('new-pub-key');
		});
	});

	describe('error handling', () => {
		it('throws on non-OK response with error body', async () => {
			mockResponse = { status: 403, body: { error: 'Not authorized' } };

			const client = new TeamsApiClient(TEST_URL, testSigner);

			await expect(client.listTeams()).rejects.toThrow('Not authorized');
		});

		it('throws on non-OK response with message body', async () => {
			mockResponse = { status: 404, body: { message: 'Team not found' } };

			const client = new TeamsApiClient(TEST_URL, testSigner);

			await expect(client.getTeam('nonexistent')).rejects.toThrow('Team not found');
		});

		it('throws generic error when body has no error field', async () => {
			mockResponse = { status: 500, body: {} };

			const client = new TeamsApiClient(TEST_URL, testSigner);

			await expect(client.listTeams()).rejects.toThrow('HTTP 500');
		});

		it('includes authorization header on all requests', async () => {
			mockResponse = { status: 200, body: [] };

			const client = new TeamsApiClient(TEST_URL, testSigner);
			await client.listTeams();

			expect(lastRequest?.headers.authorization).toBeDefined();
			expect(lastRequest?.headers.authorization).toMatch(/^Nostr /);
		});
	});
});

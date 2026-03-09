/**
 * Audit event query and management service for @redshift/bunker
 *
 * Provides querying, filtering, pagination, pruning, and summary
 * operations for audit events stored in the SQLite database.
 */

import type { Database } from 'bun:sqlite';
import { ValidationError } from './errors.js';
import type { AuditEvent } from './types.js';

/** Maximum allowed limit for query results */
const MAX_LIMIT = 500;

/** Default limit for query results */
const DEFAULT_LIMIT = 50;

/** Default retention period in days */
const DEFAULT_RETENTION_DAYS = 90;

/** Options for querying audit events */
export interface AuditQueryOptions {
	readonly teamId: string;
	readonly actorPubkey?: string | undefined;
	readonly action?: string | undefined;
	readonly since?: number | undefined;
	readonly until?: number | undefined;
	readonly limit?: number | undefined;
	readonly offset?: number | undefined;
}

/** Result of an audit event query */
export interface AuditQueryResult {
	readonly events: AuditEvent[];
	readonly total: number;
	readonly hasMore: boolean;
}

/**
 * AuditService handles querying and managing audit events.
 *
 * All queries use parameterized SQL to prevent injection.
 */
export class AuditService {
	private readonly db: Database;

	constructor(db: Database) {
		this.db = db;
	}

	/**
	 * Query audit events with filtering and pagination.
	 *
	 * @param options - Query filters and pagination
	 * @returns Matching events with total count and pagination info
	 * @throws {ValidationError} if limit exceeds maximum
	 */
	queryEvents(options: AuditQueryOptions) {
		if (options.limit !== undefined && options.limit > MAX_LIMIT) {
			throw new ValidationError(`Limit cannot exceed ${MAX_LIMIT}`);
		}

		if (options.limit !== undefined && options.limit < 1) {
			throw new ValidationError('Limit must be at least 1');
		}

		if (options.offset !== undefined && options.offset < 0) {
			throw new ValidationError('Offset must be non-negative');
		}

		const limit = Math.min(options.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
		const offset = options.offset ?? 0;

		// Build WHERE clause dynamically with parameter binding
		let whereClause = 'WHERE team_id = ?';
		const params: (string | number)[] = [options.teamId];

		if (options.actorPubkey) {
			whereClause += ' AND actor_pubkey = ?';
			params.push(options.actorPubkey);
		}

		if (options.action) {
			whereClause += ' AND action = ?';
			params.push(options.action);
		}

		if (options.since !== undefined) {
			whereClause += ' AND created_at >= ?';
			params.push(options.since);
		}

		if (options.until !== undefined) {
			whereClause += ' AND created_at <= ?';
			params.push(options.until);
		}

		// Get total count
		const countResult = this.db
			.query<{ count: number }, (string | number)[]>(
				`SELECT COUNT(*) as count FROM audit_events ${whereClause}`,
			)
			.get(...params);

		const total = countResult?.count ?? 0;

		// Get paginated results
		const events = this.db
			.query<AuditEvent, (string | number)[]>(
				`SELECT * FROM audit_events ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
			)
			.all(...params, limit, offset);

		const hasMore = offset + events.length < total;

		return { events, total, hasMore } satisfies AuditQueryResult;
	}

	/**
	 * Get a single audit event by ID.
	 *
	 * @param eventId - The audit event ID
	 * @returns The audit event or null if not found
	 */
	getEvent(eventId: string) {
		return (
			this.db.query<AuditEvent, [string]>('SELECT * FROM audit_events WHERE id = ?').get(eventId) ??
			null
		);
	}

	/**
	 * Delete audit events older than the specified retention period.
	 *
	 * @param retentionDays - Number of days to retain (default 90)
	 * @returns The number of events deleted
	 * @throws {ValidationError} if retentionDays is less than 1
	 */
	pruneOldEvents(retentionDays?: number) {
		const days = retentionDays ?? DEFAULT_RETENTION_DAYS;

		if (days < 1) {
			throw new ValidationError('Retention days must be at least 1');
		}

		const cutoff = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;

		const result = this.db.query('DELETE FROM audit_events WHERE created_at < ?').run(cutoff);

		return result.changes;
	}

	/**
	 * Get event counts grouped by action type for a team.
	 *
	 * @param teamId - The team ID
	 * @returns A record mapping action names to their counts
	 */
	getEventCounts(teamId: string) {
		const rows = this.db
			.query<{ action: string; count: number }, [string]>(
				'SELECT action, COUNT(*) as count FROM audit_events WHERE team_id = ? GROUP BY action',
			)
			.all(teamId);

		const counts: Record<string, number> = {};
		for (const row of rows) {
			counts[row.action] = row.count;
		}

		return counts;
	}
}

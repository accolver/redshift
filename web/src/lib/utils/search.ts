/**
 * Fuzzy search utilities for secret keys and other text
 */

/**
 * Normalize a search query by converting spaces to underscores and lowercasing
 */
function normalizeQuery(query: string): string {
	return query.toLowerCase().replace(/\s+/g, '_');
}

/**
 * Check if a text matches a search query with fuzzy matching
 * - Spaces in query are treated as underscores
 * - Supports partial matching (query chars must appear in order)
 *
 * @param text - The text to search in (e.g., "GOOGLE_CLIENT_ID")
 * @param query - The search query (e.g., "client id")
 * @returns true if the text matches the query
 */
export function fuzzyMatch(text: string, query: string): boolean {
	if (!query.trim()) return true;

	const normalizedText = text.toLowerCase();
	const normalizedQuery = normalizeQuery(query);

	// First check direct inclusion (with spaces as underscores)
	if (normalizedText.includes(normalizedQuery)) {
		return true;
	}

	// Then check if all query parts (split by underscore/space) exist in text
	const queryParts = query
		.toLowerCase()
		.split(/[\s_]+/)
		.filter(Boolean);
	return queryParts.every((part) => normalizedText.includes(part));
}

/**
 * Calculate a match score for ranking search results
 * Higher score = better match
 *
 * @param text - The text to search in
 * @param query - The search query
 * @returns A score from 0-100, or -1 if no match
 */
export function matchScore(text: string, query: string): number {
	if (!query.trim()) return 0;

	const normalizedText = text.toLowerCase();
	const normalizedQuery = normalizeQuery(query);

	// Exact match (highest score)
	if (normalizedText === normalizedQuery) {
		return 100;
	}

	// Starts with query (high score)
	if (normalizedText.startsWith(normalizedQuery)) {
		return 90;
	}

	// Contains exact query (good score)
	if (normalizedText.includes(normalizedQuery)) {
		return 80;
	}

	// All query parts exist in order (decent score)
	const queryParts = query
		.toLowerCase()
		.split(/[\s_]+/)
		.filter(Boolean);
	if (queryParts.length > 0) {
		let lastIndex = -1;
		let allInOrder = true;

		for (const part of queryParts) {
			const index = normalizedText.indexOf(part, lastIndex + 1);
			if (index === -1) {
				allInOrder = false;
				break;
			}
			lastIndex = index;
		}

		if (allInOrder) {
			return 70;
		}

		// All parts exist but not in order (lower score)
		if (queryParts.every((part) => normalizedText.includes(part))) {
			return 60;
		}
	}

	// No match
	return -1;
}

/**
 * Filter and sort items by search query
 *
 * @param items - Array of items to search
 * @param query - The search query
 * @param getText - Function to extract searchable text from an item
 * @returns Filtered and sorted array of items
 */
export function searchAndSort<T>(items: T[], query: string, getText: (item: T) => string): T[] {
	if (!query.trim()) return items;

	const scored = items
		.map((item) => ({
			item,
			score: matchScore(getText(item), query),
		}))
		.filter(({ score }) => score >= 0)
		.sort((a, b) => b.score - a.score);

	return scored.map(({ item }) => item);
}

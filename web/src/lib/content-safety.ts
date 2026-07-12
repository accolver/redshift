import sanitizeHtml from 'sanitize-html';

const BLOG_TAGS = [
	'a',
	'code',
	'em',
	'h2',
	'h3',
	'li',
	'ol',
	'p',
	'pre',
	'strong',
	'table',
	'tbody',
	'td',
	'th',
	'thead',
	'tr',
	'ul',
];

/** The sole boundary for rendering HTML that may later come from an external CMS. */
export function sanitizeBlogHtml(content: string) {
	return sanitizeHtml(content, {
		allowedTags: BLOG_TAGS,
		allowedAttributes: {
			a: ['href', 'target', 'rel'],
			code: ['class'],
			pre: ['class'],
		},
		allowedSchemes: ['https', 'http', 'mailto'],
		allowProtocolRelative: false,
		transformTags: {
			a: (_tagName, attributes) => ({
				tagName: 'a',
				attribs: {
					...attributes,
					...(attributes.target === '_blank' ? { rel: 'noopener noreferrer' } : {}),
				},
			}),
		},
	});
}

/** Serialize JSON for an inline script data block without permitting an end-tag breakout. */
export function serializeScriptJson(value: unknown) {
	return JSON.stringify(value)
		.replaceAll('<', '\\u003c')
		.replaceAll('>', '\\u003e')
		.replaceAll('&', '\\u0026')
		.replaceAll('\u2028', '\\u2028')
		.replaceAll('\u2029', '\\u2029');
}

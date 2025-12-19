# Blog Article Generation Guide

This document provides instructions for generating blog articles for Redshift.

## Core Principles

### 1. Straight to the Point

- **No fluff**: Every sentence should provide value
- **Lead with the insight**: Put the most important information first
- **Respect reader time**: Developers are busy; don't waste their attention
- **Active voice**: "Redshift encrypts your secrets" not "Your secrets are
  encrypted by Redshift"

### 2. SEO & Organic Discoverability

- **Title**: Include primary keyword, keep under 60 characters
- **Description**: Compelling summary with keywords, 150-160 characters
- **Slug**: Lowercase, hyphenated, keyword-rich (e.g.,
  `why-your-secrets-deserve-sovereignty`)
- **Headings**: Use H2s liberally with relevant keywords
- **Internal links**: Link to `/docs`, `/pricing`, `/admin`, and other blog
  posts
- **External links**: Link to authoritative sources (Nostr NIPs, security
  resources)

### 3. Telos Alignment

Before writing any article, validate against the Telos Guardian (L9):

**Does this article serve the ultimate purpose?**

> Empower developers with sovereign, censorship-resistant control over their
> application secrets, ensuring no third party can access, revoke, or compromise
> their sensitive data.

Articles should:

- Educate about decentralization, sovereignty, and censorship resistance
- Demonstrate Redshift's value proposition
- Build trust through transparency and technical depth
- Convert readers into users without being salesy

**Topics that align with Telos:**

- Decentralization and why it matters for developers
- Nostr protocol and its applications beyond social media
- Secret management best practices
- Migration guides from centralized providers
- Security and encryption explainers
- Developer sovereignty and data ownership
- Censorship resistance and why it's important

**Topics to avoid:**

- Generic "top 10" listicles without substance
- Content that doesn't connect to Redshift's mission
- Overly promotional content without educational value
- Anything that undermines user privacy or sovereignty

## Article Structure

```typescript
{
  slug: 'kebab-case-url-friendly-slug',
  title: 'Clear, Keyword-Rich Title Under 60 Characters',
  description: 'Compelling 150-160 character summary that includes primary keyword and entices clicks.',
  date: 'YYYY-MM-DD',
  author: 'Redshift Team',
  readingTime: 'X min read',
  tags: ['relevant', 'keywords', 'max-5'],
  content: `
    <p class="lead">
      Opening paragraph that hooks the reader and summarizes the key insight.
    </p>

    <h2>First Major Section</h2>
    <p>Content...</p>

    <h2>Second Major Section</h2>
    <p>Content...</p>

    <!-- Continue with logical sections -->

    <h2>Conclusion/CTA Section</h2>
    <p>
      Wrap up with actionable next steps.
      <a href="/admin">Get started with Redshift</a>
    </p>
  `
}
```

## Content Guidelines

### HTML Elements to Use

- `<p class="lead">` for opening paragraph (larger, more prominent text)
- `<h2>` for major sections (never skip to h3 without h2)
- `<h3>` for subsections within h2
- `<ul>` and `<ol>` for lists (use liberally for scannability)
- `<strong>` for emphasis (use sparingly)
- `<code>` for inline code
- `<pre><code>` for code blocks
- `<a href="">` for links (always include)
- `<table>` for comparisons or structured data

### Writing Style

- **Technical but accessible**: Explain concepts clearly without dumbing down
- **Concrete examples**: Use real scenarios, not abstract descriptions
- **Show, don't tell**: "Doppler stores your secrets on their servers" not
  "Doppler is centralized"
- **First person plural**: "We" for Redshift, "you" for the reader
- **No jargon without explanation**: Define terms the first time they appear

### Code Examples

- Keep code examples short and focused
- Always include the command prompt (`$`) for terminal commands
- Use realistic but safe values (never real secrets)

## Adding a New Article

1. Open `web/src/lib/blog/posts.ts`
2. Add new post object to the `posts` array
3. Follow the structure and guidelines above
4. Test locally: `bun run dev` and navigate to `/blog`
5. Verify the article renders correctly and all links work

## Future Blog Post Ideas

Keep this checklist updated with ideas for future articles:

### Technical Deep Dives

- [x] NIP-59 Gift Wrap Encryption Explained
- [ ] How Nostr Relays Work: A Developer's Guide
- [ ] Building CLI Tools with Bun: Lessons from Redshift
- [ ] End-to-End Encryption Without a Server

### Guides & Tutorials

- [x] Setting Up Redshift for Your CI/CD Pipeline
- [ ] Sharing Secrets Securely with Your Team
- [ ] Running Your Own Nostr Relay for Secret Storage
- [x] Using NIP-07 Browser Extensions: A Complete Guide

### Industry & Philosophy

- [x] The Hidden Costs of Centralized Secret Management
- [x] Why Open Source Matters for Security Tools
- [ ] Vendor Lock-in: The Silent Threat to Your Infrastructure
- [x] The Case for Self-Sovereign Developer Identity

### Comparisons & Migrations

- [x] Redshift vs. HashiCorp Vault: When to Choose Each
- [ ] Migrating from AWS Secrets Manager to Redshift
- [ ] Redshift vs. 1Password Developer Tools

### Use Cases

- [x] Secret Management for Open Source Projects
- [x] Protecting API Keys in Serverless Functions
- [x] Managing Secrets Across Multiple Environments

### News & Updates

- [ ] Introducing Teams: Collaborative Secret Management
- [ ] Redshift Cloud: Managed Relay Announcement
- [ ] Monthly Security Audit Report Template

## SEO Checklist

Before publishing, verify:

- [ ] Title under 60 characters with primary keyword
- [ ] Description 150-160 characters with keyword
- [ ] Slug is URL-friendly and keyword-rich
- [ ] At least 3 internal links to other Redshift pages
- [ ] At least 1 external link to authoritative source
- [ ] All images have alt text (if applicable)
- [ ] Code examples are correct and runnable
- [ ] No broken links
- [ ] JSON-LD structured data is valid
- [ ] Article aligns with Telos (L9) purpose

## Technical Notes

- Blog posts are statically generated at build time
- Posts are stored in `web/src/lib/blog/posts.ts`
- The `entries()` function in `[slug]/+page.ts` generates static paths
- Typography uses `@tailwindcss/typography` with Tokyo Night theme
- All posts should include structured data (JSON-LD) for SEO

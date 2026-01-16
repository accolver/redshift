# Redshift Relay Privacy Policy

**Effective Date**: January 2025
**Last Updated**: January 2025

## 1. Introduction

This Privacy Policy describes how the Redshift relay service
(`wss://relay.redshiftapp.com`) collects, uses, and protects your information.
We are committed to user privacy and data sovereignty.

**Key Principle**: We cannot access your secrets. All Redshift data is encrypted
client-side before it reaches our servers. We only store and transmit encrypted
blobs.

## 2. Information We Collect

### 2.1 Information We Can See

| Data Type               | Purpose                    | Retention         |
| ----------------------- | -------------------------- | ----------------- |
| **IP Address**          | Abuse prevention, security | 7 days (logs)     |
| **Nostr Public Key**    | Authentication (NIP-42)    | Duration of sub   |
| **Connection Metadata** | Rate limiting, debugging   | 24 hours          |
| **Encrypted Events**    | Service delivery           | Per retention     |
| **Event Timestamps**    | Sync, ordering             | With events       |
| **Event Tags**          | Filtering, routing         | With events       |

### 2.2 Information We Cannot See

Due to NIP-59 Gift Wrap encryption, we **cannot access**:

- Secret names or identifiers
- Secret values or content
- Project names or structure
- Any plaintext metadata
- Who you're sharing secrets with

This is enforced cryptographically, not by policy.

### 2.3 Payment Information

Bitcoin payments are processed through BTCPay Server. We record:

- BTCPay invoice ID (for subscription verification)
- Payment timestamp
- Subscription expiry date

We do **not** store:

- Bitcoin addresses (beyond what's necessary for payment)
- Transaction details on our systems
- Any fiat payment information (we are Bitcoin-only)

## 3. How We Use Your Information

We use collected information solely to:

- **Provide the Service**: Store and deliver your encrypted events
- **Authenticate**: Verify your subscription status via NIP-42
- **Prevent Abuse**: Rate limiting, spam prevention, security monitoring
- **Improve Service**: Aggregate, anonymized metrics for capacity planning
- **Comply with Law**: Respond to valid legal requests (see Section 7)

We do **not**:

- Sell your data to third parties
- Use your data for advertising
- Profile your behavior for marketing
- Share data with affiliates for commercial purposes

## 4. Data Storage and Security

### 4.1 Infrastructure

- **Relay**: Cloudflare Workers (global edge network)
- **Storage**: Cloudflare Durable Objects and R2
- **Backups**: Cloudflare R2 with geographic replication

### 4.2 Security Measures

- End-to-end encryption (NIP-59 Gift Wrap)
- NIP-42 authentication required for all operations
- Rate limiting to prevent abuse
- Automatic encrypted backups
- No plaintext secrets ever touch our servers

### 4.3 Data Location

Data may be processed and stored in multiple geographic regions through
Cloudflare's global network. Primary regions include the United States and
Europe.

## 5. Data Retention

| Data Type            | Active Subscriber | After Subscription Ends |
| -------------------- | ----------------- | ----------------------- |
| Encrypted events     | Indefinite        | 30 days                 |
| Audit logs           | 7 days            | Deleted immediately     |
| Access tokens        | 30 days (refresh) | Deleted on expiry       |
| Connection logs      | 24 hours          | 24 hours                |
| IP address logs      | 7 days            | 7 days                  |
| Payment records      | 2 years           | 2 years (legal)         |

## 6. Data Sharing

We do not sell, rent, or share your personal information with third parties
except:

### 6.1 Service Providers

We use the following service providers who may process data on our behalf:

- **Cloudflare**: Infrastructure hosting (Workers, R2, Durable Objects)
- **BTCPay Server**: Payment processing (self-hosted)
- **Voltage Cloud**: Lightning payment infrastructure

These providers are bound by their own privacy policies and data protection
agreements.

### 6.2 Legal Requirements

We may disclose information if required by law, court order, or government
request. However:

- We will notify you unless legally prohibited
- We cannot provide plaintext secrets (we don't have them)
- We will challenge overbroad requests

## 7. Your Rights

### 7.1 Access and Portability

You can:

- Export all your encrypted events using any Nostr client
- Request a copy of metadata we hold about your account
- View your subscription status and history

### 7.2 Deletion

You can:

- Delete specific events using NIP-09 deletion events
- Request account deletion (removes metadata, tokens)
- Note: Encrypted backups may persist per retention schedule

### 7.3 Correction

Contact us to correct any inaccurate account metadata.

### 7.4 For EU/EEA Residents (GDPR)

If you are in the European Union or European Economic Area, you have additional
rights including:

- Right to access your personal data
- Right to rectification of inaccurate data
- Right to erasure ("right to be forgotten")
- Right to restrict processing
- Right to data portability
- Right to object to processing
- Right to withdraw consent

To exercise these rights, contact us at the address below.

### 7.5 For California Residents (CCPA)

California residents have the right to:

- Know what personal information is collected
- Know whether personal information is sold or disclosed
- Say no to the sale of personal information
- Access their personal information
- Request deletion of personal information
- Not be discriminated against for exercising these rights

We do not sell personal information.

## 8. Cookies and Tracking

The relay service itself does not use cookies or tracking technologies. The
relay operates over WebSocket protocol and uses NIP-42 for authentication.

Our marketing website (redshiftapp.com) may use minimal analytics. See that
site's privacy policy for details.

## 9. Children's Privacy

This Service is not intended for users under 18 years of age. We do not
knowingly collect information from children. If we learn we have collected
information from a child, we will delete it.

## 10. International Data Transfers

Your data may be transferred to and processed in countries other than your own.
We use Cloudflare's global network, which has data processing agreements and
standard contractual clauses for international transfers.

## 11. Changes to This Policy

We may update this Privacy Policy from time to time. We will notify active
subscribers of material changes. The "Last Updated" date at the top indicates
when the policy was last revised.

## 12. Contact Us

For privacy-related questions or to exercise your rights:

- **Nostr**: npub1... (relay operator's pubkey)
- **Email**: privacy@redshiftapp.com
- **Website**: https://redshiftapp.com

For urgent privacy concerns, please include "PRIVACY" in your subject line.

---

## Summary: Our Privacy Commitment

1. **We can't read your secrets** - All data is encrypted client-side
2. **We don't track you** - No cookies, no behavioral profiling
3. **We don't sell data** - Your information is not for sale
4. **We minimize collection** - Only what's necessary to operate
5. **We're transparent** - This policy tells you exactly what we do
6. **You control your data** - Export, delete, or leave anytime

Your sovereignty over your own data is not just our policy - it's
cryptographically enforced.

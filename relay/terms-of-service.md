# Redshift Relay Terms of Service

**Effective Date**: January 2025
**Last Updated**: January 2025

## 1. Introduction

These Terms of Service ("Terms") govern your use of the Redshift managed relay
service ("Service") operated at `wss://relay.redshiftapp.com`. By connecting to
or using this relay, you agree to be bound by these Terms.

The Redshift relay is a **specialized Nostr relay** designed exclusively for
storing encrypted application data (NIP-59 Gift Wrapped events) for Redshift
Cloud subscribers. This is not a general-purpose social relay.

## 2. Service Description

The Redshift relay provides:

- **Managed infrastructure** for storing encrypted secrets and application data
- **NIP-42 authentication** requiring valid subscription tokens
- **99.5% uptime SLA** for paid subscribers
- **Automatic encrypted backups** to Cloudflare R2
- **7-day audit log retention** for Cloud tier subscribers

### What We Store

We only store NIP-59 Gift Wrapped events (encrypted blobs) with the
`["t", "redshift-secrets"]` tag. **We cannot access your secret names, values,
or metadata.** All encryption and decryption happens client-side.

## 3. Eligibility

To use this Service, you must:

- Be of legal age in your jurisdiction (typically 18 years or older)
- Have a valid Redshift Cloud subscription ($5/month)
- Possess a valid Nostr keypair for NIP-42 authentication
- Agree to these Terms and our Privacy Policy

## 4. Subscription and Payment

### 4.1 Pricing

Access to the Redshift relay requires an active Cloud subscription at $5 USD per
month, payable in Bitcoin (Lightning Network or on-chain).

### 4.2 Payment Processing

Payments are processed through BTCPay Server. We do not store payment card
information. All transactions are Bitcoin-native.

### 4.3 Refund Policy

**All sales are final.** Due to the nature of cryptocurrency payments and
instant service activation, we do not offer refunds, returns, or cancellations.

### 4.4 Subscription Renewal

Subscriptions are valid for 30 days from payment. You will receive notification
before expiration. Failure to renew will result in loss of relay access, though
your encrypted data will be retained for 30 days to allow renewal.

## 5. Acceptable Use

By using this Service, you agree to:

- Use the relay only for its intended purpose (Redshift secret storage)
- Not attempt to bypass authentication or access controls
- Not flood, spam, or otherwise abuse the relay infrastructure
- Comply with all applicable laws in your jurisdiction
- Act in good faith and not seek to harm the relay operators
- Not attempt to reverse engineer or attack the relay software

### 5.1 Prohibited Activities

You may not use this Service to:

- Store or transmit illegal content
- Circumvent the subscription or payment system
- Interfere with other users' access to the Service
- Attempt to access other users' encrypted data
- Resell or redistribute relay access
- Use automated systems to abuse rate limits

## 6. Content and Encryption

### 6.1 Your Content

You retain ownership of all content you publish to the relay. By using the
Service, you grant us the limited right to store, transmit, and replicate your
encrypted events as necessary to provide the Service.

### 6.2 Encryption Guarantee

All Redshift secrets are encrypted client-side using NIP-59 Gift Wrap before
transmission. **We have no ability to decrypt or access your plaintext data.**
This is by design and fundamental to our security model.

### 6.3 Content Removal

Due to the encrypted nature of stored data, we cannot selectively remove
specific secrets. If you need to delete content, use your Redshift client to
publish deletion events (NIP-09).

## 7. Service Availability

### 7.1 Uptime Commitment

We commit to 99.5% uptime for the relay service, measured monthly. This equates
to a maximum of approximately 3.6 hours of downtime per month.

### 7.2 Maintenance

We may perform scheduled maintenance with advance notice when possible.
Emergency maintenance may occur without notice to address security or stability
issues.

### 7.3 Service Modifications

We reserve the right to modify, suspend, or discontinue the Service at any time.
We will provide reasonable notice for significant changes when possible.

## 8. Data and Backups

### 8.1 Automatic Backups

Encrypted event data is automatically backed up to Cloudflare R2 storage with
geographic replication.

### 8.2 Data Retention

- **Active subscribers**: Data retained indefinitely while subscription is
  active
- **Lapsed subscriptions**: Data retained for 30 days after subscription expires
- **Audit logs**: Retained for 7 days (Cloud tier feature)

### 8.3 Data Portability

Your encrypted data uses standard Nostr event formats and can be exported to any
compatible relay.

## 9. Privacy

Your use of this Service is also governed by our
[Privacy Policy](/relay/privacy-policy.md). We collect minimal data necessary to
operate the service and combat abuse.

## 10. Disclaimers

### 10.1 "As Is" Service

THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY
KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.

### 10.2 No Guarantee

We do not guarantee that the Service will be uninterrupted, error-free, or free
of harmful components. While we implement security measures, no system is
completely secure.

## 11. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW, REDSHIFT AND ITS OPERATORS SHALL NOT BE
LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR
INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.

Our total liability for any claims arising from or relating to these Terms or
the Service shall not exceed the amount you paid for the Service in the 12
months preceding the claim.

## 12. Termination

### 12.1 By You

You may cancel your subscription at any time through the Redshift web interface.
Your access will continue until the end of your current billing period.

### 12.2 By Us

We reserve the right to suspend or terminate your access to the Service at any
time, with or without cause, and with or without notice. Reasons for termination
may include:

- Violation of these Terms
- Non-payment or payment fraud
- Abuse of the relay infrastructure
- Legal requirements

### 12.3 Effect of Termination

Upon termination, your right to access the Service ceases immediately. We may
retain encrypted backup data for a reasonable period to allow for appeals or
re-subscription.

## 13. Changes to Terms

We may update these Terms from time to time. We will notify active subscribers
of material changes via the email or Nostr pubkey associated with their account.
Continued use of the Service after changes constitutes acceptance of the new
Terms.

## 14. Governing Law

These Terms shall be governed by and construed in accordance with the laws of
the jurisdiction in which the relay operator resides, without regard to
conflicts of law principles.

## 15. Dispute Resolution

Any disputes arising from these Terms or the Service shall first be addressed
through good-faith negotiation. If resolution cannot be reached, disputes may be
submitted to binding arbitration in accordance with applicable arbitration
rules.

## 16. Severability

If any provision of these Terms is found to be unenforceable, the remaining
provisions shall continue in full force and effect.

## 17. Contact

For questions about these Terms, contact us at:

- **Nostr**: npub1... (relay operator's pubkey)
- **Email**: support@redshiftapp.com
- **Website**: https://redshiftapp.com

---

By using the Redshift relay, you acknowledge that you have read, understood, and
agree to be bound by these Terms of Service.

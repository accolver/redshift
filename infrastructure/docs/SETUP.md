# Infrastructure Setup Guide

This document outlines the manual steps required to set up the Cloud tier
infrastructure for Redshift.

## Overview

The Cloud tier requires three main infrastructure components:

1. **BTCPay Server** - Payment processing with Lightning Network support
2. **Voltage Cloud** - Hosted Lightning Network node (LND)
3. **Nosflare** - Cloudflare-native Nostr relay

## 1. Voltage Cloud Setup

Voltage Cloud provides hosted Lightning Network nodes that integrate with BTCPay
Server.

### 1.1 Create Account

1. Go to https://voltage.cloud
2. Sign up for an account
3. Verify your email

### 1.2 Deploy Lightning Node

1. Click "Create Node"
2. Select "Neutrino Lightning Node" ($9.99/month) for cost efficiency
   - Alternative: "Standard Lightning Node" ($26.99/month) for full features
3. Choose a region close to your BTCPay Server
4. Set a secure password for the node
5. Wait for node provisioning (~5-10 minutes)

### 1.3 Get Connection Details

After node is ready:

1. Go to "Connect" tab
2. Copy the following for BTCPay configuration:
   - **REST Host**: `https://your-node.m.voltageapp.io:8080`
   - **Macaroon**: Download the admin macaroon (base64)
   - **TLS Certificate**: Usually not needed for Voltage (they handle TLS)

### 1.4 Channel Management

Voltage handles inbound liquidity, but you may want to:

1. Open channels to well-connected nodes for better routing
2. Use Voltage's "Flow" feature for automated liquidity management
3. Monitor channel health in the dashboard

## 2. BTCPay Server Setup

BTCPay Server handles invoice creation, payment detection, and webhooks.

### 2.1 Deployment Options

**Option A: Self-hosted (Recommended for production)**

Deploy on a VPS (e.g., Hetzner, DigitalOcean):

```bash
# SSH into your server
ssh user@your-server.com

# Clone BTCPay Server docker deployment
git clone https://github.com/btcpayserver/btcpayserver-docker.git
cd btcpayserver-docker

# Configure (external Lightning via Voltage)
export BTCPAY_HOST="btcpay.yourdomain.com"
export NBITCOIN_NETWORK="mainnet"
export BTCPAYGEN_CRYPTO1="btc"
export BTCPAYGEN_LIGHTNING="none"  # We'll use Voltage instead
export BTCPAYGEN_REVERSEPROXY="nginx"
export BTCPAYGEN_ADDITIONAL_FRAGMENTS="opt-add-configurator"

# Run setup
./btcpay-setup.sh -i
```

**Option B: BTCPay Cloud (Simpler)**

1. Go to https://btcpayserver.org/cloud
2. Sign up for hosted BTCPay
3. Follow their setup wizard

### 2.2 Connect Voltage Lightning

1. In BTCPay Server, go to **Server Settings > Services**
2. Click "Add Lightning Node"
3. Select "Custom LND"
4. Enter Voltage connection details:
   - **REST URL**: `https://your-node.m.voltageapp.io:8080`
   - **Macaroon**: Paste the admin macaroon (hex or base64)
   - Leave TLS certificate empty (Voltage uses public CA)
5. Test connection and save

### 2.3 Create Store

1. Go to **Stores > Create Store**
2. Name: "Redshift Cloud"
3. Default currency: USD
4. Configure payment methods:
   - Enable "BTC (On-Chain)"
   - Enable "BTC (Lightning)"

### 2.4 Configure Pricing

1. Go to **Store Settings > Rates**
2. Set rate source (e.g., Kraken, CoinGecko)
3. Set rate spread if desired (e.g., 1% for volatility buffer)

### 2.5 Create API Keys

1. Go to **Account > API Keys**
2. Click "Generate Key"
3. Set permissions:
   - `btcpay.store.cancreateinvoice`
   - `btcpay.store.canviewinvoices`
   - `btcpay.store.webhooks.canmodifywebhooks`
4. Copy the API key (shown only once)

### 2.6 Configure Webhook

1. Go to **Store Settings > Webhooks**
2. Click "Create Webhook"
3. Configure:
   - **Payload URL**: `https://api.redshiftapp.com/webhooks/btcpay`
   - **Secret**: Generate a secure random string (32+ chars)
   - **Events**: Select:
     - `InvoiceSettled`
     - `InvoiceExpired`
     - `InvoiceInvalid`
4. Save and copy the webhook secret

### 2.7 Environment Variables

Store these securely (in Redshift itself!):

```bash
BTCPAY_URL=https://btcpay.yourdomain.com
BTCPAY_STORE_ID=your-store-id
BTCPAY_API_KEY=your-api-key
BTCPAY_WEBHOOK_SECRET=your-webhook-secret
```

## 3. Nosflare Relay Setup

Nosflare is a Cloudflare Workers-based Nostr relay with R2 storage.

### 3.1 Prerequisites

1. Cloudflare account with Workers Paid plan ($5/month)
2. Domain configured in Cloudflare (for custom relay URL)
3. Wrangler CLI installed: `npm install -g wrangler`

### 3.2 Fork and Configure

```bash
# Clone Nosflare
git clone https://github.com/Spl0itable/nosflare.git
cd nosflare

# Install dependencies
npm install

# Login to Cloudflare
wrangler login
```

### 3.3 Create R2 Bucket

```bash
# Create R2 bucket for event archival
wrangler r2 bucket create redshift-relay-events
```

### 3.4 Create Required Queues

```bash
# Create queues for event processing
wrangler queues create redshift-relay-broadcast
wrangler queues create redshift-relay-indexing
```

### 3.5 Configure wrangler.toml

Edit `wrangler.toml`:

```toml
name = "redshift-relay"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
RELAY_NAME = "Redshift Cloud Relay"
RELAY_DESCRIPTION = "Managed relay for Redshift Cloud subscribers"
RELAY_PUBKEY = "your-operator-pubkey-hex"
RELAY_CONTACT = "support@redshiftapp.com"

# Supported NIPs
SUPPORTED_NIPS = "1,2,4,9,11,12,15,16,17,20,22,23,33,40,42,50,51,58,65,71,78,89,94"

# Rate limiting
MAX_SUBSCRIPTIONS_PER_CONNECTION = 20
MAX_FILTERS_PER_SUBSCRIPTION = 10

[[r2_buckets]]
binding = "EVENTS_BUCKET"
bucket_name = "redshift-relay-events"

[[queues.producers]]
binding = "BROADCAST_QUEUE"
queue = "redshift-relay-broadcast"

[[queues.producers]]
binding = "INDEX_QUEUE"
queue = "redshift-relay-indexing"

[[queues.consumers]]
queue = "redshift-relay-broadcast"

[[queues.consumers]]
queue = "redshift-relay-indexing"

[[durable_objects.bindings]]
name = "CONNECTIONS"
class_name = "ConnectionDO"

[[durable_objects.bindings]]
name = "EVENTS"
class_name = "EventShardDO"

[[migrations]]
tag = "v1"
new_classes = ["ConnectionDO", "EventShardDO"]
```

### 3.6 Configure Access Control (Optional)

For pay-to-relay functionality, create `src/auth.ts`:

```typescript
// This will be called by the relay to validate access tokens
export async function validateAccessToken(
  pubkey: string,
  env: Env,
): Promise<boolean> {
  // Query for valid access token event
  // Kind 30078, d-tag "com.redshiftapp.access-token", t-tag "redshift-cloud"
  // Check expiration timestamp
  // Verify relay operator signature

  // For now, allow all (implement after @redshift/cloud package)
  return true;
}
```

### 3.7 Deploy

```bash
# Deploy to Cloudflare Workers
wrangler deploy

# Test deployment
curl https://redshift-relay.your-account.workers.dev
```

### 3.8 Configure Custom Domain

1. In Cloudflare Dashboard, go to your Workers
2. Select "redshift-relay"
3. Go to "Triggers" > "Custom Domains"
4. Add: `relay.redshiftapp.com`
5. Wait for DNS propagation

### 3.9 Test Relay

```bash
# Using websocat or similar
websocat wss://relay.redshiftapp.com

# Send a REQ to test
["REQ", "test", {"kinds": [1], "limit": 1}]
```

## 4. DNS Configuration

Configure DNS records in Cloudflare:

| Type  | Name   | Content                    | Proxy |
| ----- | ------ | -------------------------- | ----- |
| CNAME | relay  | redshift-relay.workers.dev | Yes   |
| CNAME | api    | redshift-api.workers.dev   | Yes   |
| A     | btcpay | your-btcpay-server-ip      | No    |
| CNAME | status | statuspage.betterstack.com | No    |

## 5. Monitoring Setup

### 5.1 BetterStack (Recommended)

1. Sign up at https://betterstack.com
2. Create monitors for:
   - `wss://relay.redshiftapp.com` (WebSocket)
   - `https://btcpay.yourdomain.com` (HTTPS)
   - `https://api.redshiftapp.com/health` (HTTPS)
3. Configure alerting (email, Slack, etc.)
4. Create public status page at `status.redshiftapp.com`

### 5.2 Cloudflare Analytics

1. Go to Workers > Analytics
2. Monitor:
   - Request volume
   - Error rates
   - Latency percentiles
   - CPU time

## 6. Security Checklist

- [ ] BTCPay Server uses HTTPS with valid certificate
- [ ] Voltage node password is strong and unique
- [ ] BTCPay API key has minimal required permissions
- [ ] Webhook secret is cryptographically random (32+ bytes)
- [ ] Cloudflare Workers secrets are stored securely
- [ ] Access logs are enabled and monitored
- [ ] Rate limiting is configured on all endpoints
- [ ] DDoS protection enabled (Cloudflare default)

## 7. Cost Summary

| Service            | Monthly Cost |
| ------------------ | ------------ |
| Voltage Neutrino   | $9.99        |
| BTCPay VPS         | ~$5-10       |
| Cloudflare Workers | $5 (base)    |
| Cloudflare R2      | ~$0-5        |
| Domain             | ~$1          |
| Monitoring         | $0-20        |
| **Total**          | **~$21-51**  |

Break-even at 5-10 subscribers ($5/month each).

## 8. Next Steps

After infrastructure is set up:

1. Deploy the `@redshift/payments` package webhook handler
2. Configure access token generation in `@redshift/cloud`
3. Enable relay authentication with Nosflare
4. Set up audit log retention policies
5. Launch beta testing

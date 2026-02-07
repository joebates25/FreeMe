# FreeMe

A mobile-friendly web app that schedules a delayed phone call to give you an excuse to leave awkward situations. Pick a delay (1-60 minutes), hit schedule, and close your browser — the call will still come through.

## How It Works

1. A **Cloudflare Worker** serves an HTML form and handles the `/schedule` endpoint
2. A **Durable Object** stores the scheduled call and sets an alarm for the requested time
3. When the alarm fires, the Durable Object calls the **Twilio REST API** to place an outbound call

## Prerequisites

- [Bun](https://bun.sh) (or Node.js with npm)
- A [Cloudflare](https://dash.cloudflare.com) account
- A [Twilio](https://www.twilio.com) account with a phone number

## Setup

### 1. Install dependencies

```bash
bun install
```

### 2. Configure Twilio credentials

**For local development**, create a `.dev.vars` file in the project root:

```
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_FROM_NUMBER=+1xxxxxxxxxx
TWILIO_TO_NUMBER=+1xxxxxxxxxx
```

**For production**, set each secret via Wrangler:

```bash
bunx wrangler secret put TWILIO_ACCOUNT_SID
bunx wrangler secret put TWILIO_AUTH_TOKEN
bunx wrangler secret put TWILIO_FROM_NUMBER
bunx wrangler secret put TWILIO_TO_NUMBER
```

## Development

Start the local dev server:

```bash
bun run dev
```

The app will be available at `http://localhost:8787`.

## Deployment

Deploy to Cloudflare Workers:

```bash
bun run deploy
```

Make sure your production secrets are set before deploying (see setup above).

## Project Structure

```
src/index.ts    - Worker entry point + CallScheduler Durable Object
wrangler.toml   - Cloudflare Workers & Durable Objects configuration
.dev.vars       - Local development secrets (gitignored)
```

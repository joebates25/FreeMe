# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

A mobile-accessible web app that lets users trigger a delayed phone call (e.g., 1-60 minutes later) to provide an excuse to leave awkward situations.

## Architecture

- **Cloudflare Worker** serves HTML form and handles `/schedule` endpoint
- **Durable Object** with alarm stores scheduled call and triggers at the specified time
- **Twilio REST API** (not SDK) makes outbound calls via Basic auth

User can close browser after scheduling - the alarm persists server-side.

## Build Commands

```bash
bun install              # Install wrangler
bun run dev              # Local dev server at localhost:8787
bun run deploy           # Deploy to Cloudflare Workers
```

## Secrets Setup (Production)

```bash
bunx wrangler secret put TWILIO_ACCOUNT_SID
bunx wrangler secret put TWILIO_AUTH_TOKEN
bunx wrangler secret put TWILIO_FROM_NUMBER
bunx wrangler secret put TWILIO_TO_NUMBER
```

Local development uses `.dev.vars` file (gitignored).

## Key Files

- `src/index.ts` - Worker entry point + CallScheduler Durable Object
- `wrangler.toml` - Cloudflare configuration with Durable Objects binding
- `.dev.vars` - Local development secrets

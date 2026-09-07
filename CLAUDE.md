# Middleware API

Supabase, Vercel, and GitHub operations for this project go through an internal
middleware service rather than direct API calls.

Its hostname, endpoints, and current operational state are documented in the
private `Yiipi24/middleware-api` repository, along with the credentials each
environment needs. This repository is public, so those details are deliberately
not recorded here.

## Network access

The middleware host is not on the default allowlist, so sessions in a `Trusted`
cloud environment cannot reach it — the proxy answers `403` to CONNECT and curl
reports `CONNECT tunnel failed`. Run in the `middleware` cloud environment,
which allows the host explicitly. A host added to that environment's **Custom /
Allowed domains** list took effect on a session that was already running, so a
`403` is worth re-testing before assuming a restart is needed.

`curl -sS "$HTTPS_PROXY/__agentproxy/status"` distinguishes a network-policy
denial from a service failure, which otherwise look alike from inside a
session.

### Running the app against the real database

`npm run dev` needs the Supabase project host (`<ref>.supabase.co`) on the same
allowed-domains list, plus `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in the
environment.

That is not enough on its own: **Node ignores `HTTPS_PROXY`**, so `fetch` — the
one `@supabase/supabase-js` uses — goes out directly and the egress proxy
answers `403 Host not in allowlist` even for a host that is allowed. `curl`
works at the same moment, which makes this look like an allowlist problem when
it is not. Start the dev server through the proxy instead:

```bash
NODE_OPTIONS=--use-env-proxy npm run dev
```

The MCP tools are not affected: connector traffic does not go through the
session's allowlist, which is why Supabase MCP queries keep working while the
app cannot reach the same project.

## Current state

The Supabase endpoints are not usable as of 2026-09-03 — see the middleware
repository for the diagnosis and progress. Use the Supabase MCP tools for
Supabase work in the meantime. The Vercel and GitHub endpoints work.

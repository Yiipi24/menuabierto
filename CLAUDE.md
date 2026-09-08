# Middleware API

Supabase, Vercel, and GitHub operations for this project go through an internal
middleware service rather than direct API calls.

Its hostname, endpoints, and current operational state are documented in the
private `Yiipi24/middleware-api` repository, along with the credentials each
environment needs. This repository is public, so those details are deliberately
not recorded here.

**It is read-only.** Its controllers expose four `GET` routes and nothing else:
a repository summary, its pull requests, the deployment list and one
deployment. There is no endpoint that creates a pull request, merges, or
triggers a deploy. So "go through the middleware instead of the MCP tools"
holds for reading; every write still goes through the GitHub and Vercel tools.
Worth knowing before planning a release around it.

## Network access

The middleware host is not on the default allowlist, so sessions in a `Trusted`
cloud environment cannot reach it — the proxy answers `403` to CONNECT and curl
reports `CONNECT tunnel failed`. Run in the `middleware` cloud environment,
which allows the host explicitly. A host added to that environment's **Custom /
Allowed domains** list took effect on a session that was already running, so a
`403` is worth re-testing before assuming a restart is needed.

`curl -sS "$HTTPS_PROXY/__agentproxy/status"` distinguishes a network-policy
denial from a service failure, which otherwise look alike from inside a
session. It also names the host it rejected, which is what tells apart "the
site is down" from "this session cannot reach it".

The production domain is on that same list: `menuabierto.com`. Without it, a
smoke test against the deployed site fails exactly like the middleware does —
`403` to CONNECT — and reads as an outage when it is only the session's egress
policy. `www.menuabierto.com` is a separate entry and is **not** on the list,
so smoke-test the apex. Vercel's own `web_fetch_vercel_url` reaches a
deployment without going through the proxy at all, and is the way around this
when the domain cannot be added.

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

## A panel route answers 200 to an anonymous request

`/panel/...` pages call `redirect("/entrar")` when there is no session, but a
`curl` without cookies gets `200`, not `307`. That is not a leak and not a bug:
in Next 15 the redirect is emitted after the response has started streaming, so
the status line is already sent and the redirect travels inside the payload as
`NEXT_REDIRECT` for the client to act on.

The way to confirm it is the body, not the status: it carries `NEXT_REDIRECT`
and none of the page's data — no restaurant name, no rows, nothing the loader
would have fetched. Only the `<title>` from the route's exported `metadata`
makes it into the shell. Check that before treating a `200` here as an incident.

## Current state

The Supabase endpoints are not usable as of 2026-09-03 — see the middleware
repository for the diagnosis and progress. Use the Supabase MCP tools for
Supabase work in the meantime. The Vercel and GitHub endpoints work.

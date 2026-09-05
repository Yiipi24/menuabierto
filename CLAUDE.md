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
which allows the host explicitly. The setting applies when the container
starts, so changing it does not unblock a session already running.

`curl -sS "$HTTPS_PROXY/__agentproxy/status"` distinguishes a network-policy
denial from a service failure, which otherwise look alike from inside a
session.

## Current state

The Supabase endpoints are not usable as of 2026-09-03 — see the middleware
repository for the diagnosis and progress. Use the Supabase MCP tools for
Supabase work in the meantime. The Vercel and GitHub endpoints work.

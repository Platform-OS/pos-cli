MCP Server for platformOS — Implementation Plan

Date: 2026-01-16
Repository: pos-cli

Goal
----
Create an MCP (Managed Control Plane) server that exposes a simple HTTP API to help teams work with platformOS APIs (GraphQL, Liquid evaluator, logs, modules, portal) via a centrally hosted server. The server will reuse and extend existing CLI code (pos-cli) found in this repository where possible, providing proxy endpoints, authentication helpers, caching, rate-limiting, and an optional GUI integration.

Why
---
- Provide a single hosted endpoint for internal tools and editors that need access to platformOS APIs.
- Abstract per-environment tokens and device auth flows so editors/clients don't need direct credentials.
- Reuse existing, well-tested CLI logic (gateway/proxy, swagger-client, portal) to speed implementation.

Scope / non-goals
-----------------
Included:
- HTTP proxy endpoints for GraphQL (/graphql), Liquid (/api/liquid), logs (/api/logs, /api/logsv2), and module management/sync endpoints used by pos-cli.
- Authentication layer: using platformOS partner portal tokens and device flow; support storing per-environment credentials.
- Optional GUI integration: serve existing GUI assets (gui/next, gui/graphql, gui/liquid, gui/admin) behind MCP.
- Caching of instance metadata and short-term tokens, configurable rate-limiting, and logging.

Excluded (for MVP):
- Full multi-tenant billing, quota UI, or complex role-based access control.
- Database-backed long-term storage beyond minimal configuration persistence (MVP can use filesystem or in-memory; later use Redis/Postgres).

High-level architecture
-----------------------
- HTTP server (Express) — based on lib/server.js but reorganized as an MCP service.
- Auth layer — manage credentials per "environment" or per "tenant". Support:
  - API token injection (Bearer token)
  - Partner portal device flow (Portal.requestDeviceAuthorization + fetchDeviceAccessToken)
- Gateway/Proxy — reuse lib/proxy to talk to platformOS instance APIs, plus swagger-client for logs/openobserve.
- Routes:
  - /v1/environments — CRUD environment configs (admin API)
  - /v1/{env}/graphql — proxy GraphQL queries
  - /v1/{env}/liquid — proxy Liquid evaluator
  - /v1/{env}/logs and /v1/{env}/logsv2 — proxy log APIs
  - /v1/{env}/modules/* — module operations (push/pull/sync)
  - /info — server info
  - /gui/* — optional UI assets
- Persistence: start with filesystem-based environment storage (e.g., JSON files in ./mcp-data or ./config), move to DB if needed.
- Security: JWT for clients talking to MCP, TLS termination expected at deployment (or Docker + reverse proxy), CORS strictness per configuration.

Re-use from repository
----------------------
These files/classes are directly reusable or a good reference:
- lib/server.js — existing Express server; use structure and static serving as a starting point.
- lib/proxy.js — existing Gateway implementation used by server.js.
- lib/swagger-client.js — logsv2/Swagger/OpenObserve integration.
- lib/portal.js — partner portal helpers (device auth, tokens).
- bin/pos-cli-gui-serve.js — shows how CLI boots server and integrates swagger client.
- gui/* — built UI assets for serving from MCP.

Design decisions / recommended changes
------------------------------------
1. Separate MCP-specific code under a new folder mcp/ (or server/mcp) to avoid cluttering lib/.
   - mcp/server.js — Express server setup (based on lib/server.js) but under MCP responsibilities (multi-tenant routing, auth).
   - mcp/routes/*.js — route handlers per domain (graphql, liquid, logs, modules, admin).
   - mcp/auth.js — client authentication & tenant token manager.
   - mcp/storage.js — environment config storage (filesystem MVP + interface for DB later).
   - mcp/proxy-wrapper.js — thin adapter that instantiates Gateway with proper env from storage and call underlying functions (graph, liquid, logs, sync).

2. Authentication model
   - Two types of actors:
     a) Admins/operators (manage environments) — secure endpoints to add/remove environments.
     b) Clients (editors, internal tools) — call MCP using an API key or short-lived JWT issued by MCP.
   - MCP will store per-environment credentials: { name, url, email, token } and optionally device flow state.
   - For initial MVP, support a static ADMIN_API_KEY (env var) to protect admin routes; clients can use simple API_KEYs in headers (x-api-key) configured in environment or a config file. Longer term: OAuth/JWT.

3. Request flow
   - Client requests POST /v1/{env}/graphql with JSON body (GraphQL request). MCP authenticates client, looks up environment credentials, instantiates Gateway (or reuses pool), forwards the request using Gateway.graph and returns the result.
   - For logs and swagger-based APIs use SwaggerProxy.client-like flow to build client with log proxy URL and securities.

4. Concurrency & pooling
   - Use a small pool/cache of Gateway clients per environment to avoid re-auth overhead.
   - Respect CONCURRENCY environment variable as existing code uses.

5. Configuration & secrets
   - MCP reads a config dir (./mcp-config or /etc/mcp) with environment definitions. Provide CLI or admin API to add envs.
   - Support ENV variables for global config: MCP_ADMIN_KEY, PORT, HOST, DATA_DIR, LOG_LEVEL.

6. Rate limiting & quotas
   - Add express-rate-limit middleware per-client and per-environment (configurable). Useful to protect platformOS instances.

7. Observability
   - Log requests, response times, errors.
   - Expose /health and /metrics endpoints (Prometheus metrics) later.

Implementation plan (milestones & tasks)
----------------------------------------
MVP (2–3 sprints / ~2–4 weeks depending on team size)
- Tasks:
  1. Project scaffolding (1 day)
     - Add mcp/ directory and initial package exports.
     - Copy lib/server.js into mcp/server.js and rework for multi-tenant routing.
  2. Storage & config (1 day)
     - Implement mcp/storage.js that reads/writes ./mcp-data/environments/*.json.
     - Provide a seed config example file (mcp-data/example.json).
  3. Auth (1–2 days)
     - Implement mcp/auth.js supporting ADMIN_API_KEY and simple client API keys in mcp-config/clients.json.
     - Add middleware to validate client requests.
  4. Proxy wrapper (2 days)
     - Implement mcp/proxy-wrapper.js that uses lib/proxy to forward GraphQL, liquid and other requests based on env data from storage.
  5. Routes (2 days)
     - Implement routes: /v1/:env/graphql, /v1/:env/liquid, /v1/:env/logs, /v1/:env/logsv2, /v1/:env/sync (file uploads).
     - Mirror behavior of lib/server.js for these endpoints but use env-specific credentials.
  6. Admin routes (1 day)
     - Implement CRUD for environments: POST /v1/environments, GET /v1/environments, DELETE /v1/environments/:name (protected by ADMIN_API_KEY).
  7. Serve GUI assets (0.5 day)
     - Static serve gui assets behind /gui and link to environment selection UI.
  8. Tests & examples (1–2 days)
     - Add basic integration tests using jest/mocha to exercise proxy endpoints (mocking Gateway if needed).
  9. Dockerization (0.5 day)
     - Add Dockerfile and docker-compose example (MCP + optional reverse proxy). Reuse repo Dockerfile as reference.

Deliverable: Running MCP server that can be run locally via docker-compose or node mcp/server.js and will proxy GraphQL/log requests for configured environments.

Phase 2 (hardening & features)
- Persist clients and environments to Redis/Postgres.
- Implement device authorization flow endpoints so clients can request device activation for new environments.
- Add JWT-based client registration and tokens (short-lived), refresh tokens.
- Add rate-limiting, request throttling, and caching for metadata.
- Add Prometheus metrics and /metrics endpoint.
- Add RBAC for environments.
- Add CI tests, E2E tests cloning some pos-cli flows.

Phase 3 (scale & SaaS)
- Multi-region deployment, autoscaling, request auditing, billing, and GUI for admin operations.
- Integration with PlatformOS partner portal to automatically refresh module versions.

API surface (suggested endpoints)
---------------------------------
- Admin
  - POST /v1/environments
    body: { name, url, email, token } (token optional — use device flow)
  - GET /v1/environments
  - GET /v1/environments/:name
  - DELETE /v1/environments/:name
  - POST /v1/environments/:name/device_authorize -> triggers portal.requestDeviceAuthorization
  - POST /v1/environments/:name/device_token -> exchanges device code
- Client
  - POST /v1/:env/graphql -> proxy to platformOS GraphQL
  - POST /v1/:env/liquid -> proxy to Liquid evaluator
  - GET /v1/:env/logs?lastId= -> proxy
  - POST /v1/:env/logsv2 -> proxy swagger-client style
  - PUT /v1/:env/sync -> multipart file upload (reuse existing handling in lib/server.js)
  - POST /v1/:env/modules/push -> modules push operation
  - Any other pos-cli endpoints needed by the GUI can be proxied similarly.

Authentication & headers
------------------------
- Clients must send X-API-KEY or Authorization: Bearer <token> (MVP supports X-API-KEY only).
- Admin endpoints require ADMIN_API_KEY header or ENV variable.
- Requests forwarded to platformOS will use environment-specific stored token/email.

Storage format (filesystem MVP)
-------------------------------
Directory: ./mcp-data/environments
Each environment: <name>.json
{
  "name": "staging",
  "url": "https://staging.myinstance.platformos.net",
  "email": "bot@org.com",
  "token": "<access_token>",
  "created_at": 1670000000
}

Clients file: ./mcp-data/clients.json
[{"name":"editor","api_key":"somesecret","scopes":["graphql","liquid"]}]

Implementation notes / code pointers
-----------------------------------
- Use lib/proxy.js Gateway API to avoid duplicating logic. It already implements graph(), liquid(), logs(), sync() used by lib/server.js.
- For Logsv2/Swagger integration reuse lib/swagger-client.js and wrap it so MCP can call with instance context.
- For partner portal/device flow use lib/portal.js methods: requestDeviceAuthorization and fetchDeviceAccessToken.
- Many CLI commands in bin/ map to higher-level workflows; consult them when implementing modules endpoints.

Testing
-------
- Unit tests for auth middleware, storage, and proxy wrapper (mock Gateway API).
- Integration tests that run an Express server and assert route behavior (use nock to mock outgoing HTTP to platformOS/portal).
- E2E tests using a docker-compose stack including MCP + a simple mock upstream (or recorded fixtures).

Security considerations
-----------------------
- Do NOT persist platformOS tokens in plaintext in production. Use secrets manager or database encryption.
- Enforce TLS between clients and MCP.
- Rate-limit per-client and per-environment to protect platformOS.
- Log sanitization: do not write tokens to logs.

Operational concerns
--------------------
- Add health checks (/health) for orchestration.
- Add graceful shutdown (close Gateway sessions, flush logs).
- Rotate stored tokens and support refresh flows if platformOS supports it.

Deliverables & file changes (concrete)
--------------------------------------
Create new files (MVP):
- mcp/server.js  (based on lib/server.js)
- mcp/auth.js    (middleware + API key management)
- mcp/storage.js (fs-backed environments + clients)
- mcp/proxy-wrapper.js (environment-aware wrapper around lib/proxy)
- mcp/routes/admin.js
- mcp/routes/proxy.js
- mcp/Dockerfile (or reuse top-level Dockerfile with adjustments)
- mcp/README.md (how to run, env vars)

Modify/rewire (small):
- Expose Gateway as importable class (already at lib/proxy). Ensure it can be instantiated repeatedly without global state.
- Possibly add small helpers in lib to support pooling/reuse.

Timeline & estimates (rough)
---------------------------
- Scaffolding + simple proxy endpoints + storage + auth: 5–8 days
- Tests + Docker + docs: 2–3 days
- Device flow + UI + hardening: 3–7 days

Acceptance criteria (MVP)
-------------------------
- MCP server starts, loads environment configs from mcp-data, and exposes /v1/:env/graphql and /v1/:env/logs endpoints.
- A client with a valid API key can make a GraphQL request through MCP and receive the platformOS response (mocked in tests).
- Admin can add an environment via POST /v1/environments with ADMIN_API_KEY.
- Static GUI can be served and configured to call MCP endpoints.

Next steps (immediate)
----------------------
1. Create the mcp/ scaffolding and implement storage + auth middleware.
2. Implement proxy wrapper that reuses lib/proxy and add environment lookup.
3. Implement routes and test with a mocked Gateway to prove end-to-end.
4. Add Dockerfile and compose for local runs.

Notes from repo scan
--------------------
- Existing lib/server.js already implements many route handlers we need (graphql, liquid, logs, logsv2, sync). Use it as a direct reference or fork its code into the MCP server for multi-tenant support.
- lib/swagger-client.js contains OpenObserve/logsv2 helper code that will be useful for logsv2 endpoints.
- lib/portal.js has device OAuth helpers — reuse them to implement device flow for adding environments without directly passing tokens.
- There are many bin/pos-cli-* commands that show how the CLI uses these libraries; reference them while building specific endpoints.

If you want, I can: 
- Create the mcp/ scaffolding and the initial files (storage, auth, skeleton server) in this repository.
- Implement one endpoint (POST /v1/:env/graphql) as a working example and tests.

End of plan.

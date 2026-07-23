---
id: TASK-1.1
title: 'DnsPortalClient: per-portal API client with typed errors'
status: Done
assignee: []
created_date: '2026-07-23 09:12'
updated_date: '2026-07-23 18:27'
labels:
  - dns
dependencies: []
parent_task_id: TASK-1
priority: high
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
lib/dns/portalClient.js wrapping lib/apiRequest.js with explicit {baseUrl, token, readOnly}. Methods: static authenticate (POST /api/authenticate), listInstances, searchInstances({domain}), listDomains(uuid,{version:2}), getDomain, upsertDomain, refreshDomain. Typed errors: PortalAuthError (401), PortalAccessError (instance WRITE missing - message names portal+uuid+fix), DestructiveChangeError (422 body prefix 'Destructive DNS change blocked'). readOnly:true makes POST methods throw (old-stack safety invariant). Do NOT touch lib/portal.js.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 nock tests: Bearer header, version=2 query, 401->PortalAuthError, 422 destructive->DestructiveChangeError, readOnly POST throws
<!-- AC:END -->

---
id: TASK-1.2
title: 'auth.js: resolvePortalContext for source/target sides'
status: Done
assignee: []
created_date: '2026-07-23 09:13'
updated_date: '2026-07-23 09:19'
labels:
  - dns
dependencies:
  - TASK-1.1
parent_task_id: TASK-1
priority: high
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
lib/dns/auth.js resolvePortalContext(envName, {portalUrl, token, email, instanceUuid, label}). Resolution: .pos via fetchSettings (partner_portal_url + token) -> flag overrides -> email/password prompt fallback (JWT via authenticate, never persisted). Token smoke-test via listInstances. Instance UUID: flag, else searchInstances({domain: hostname(settings.url)}); ambiguous -> list candidates and exit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 tests: .pos path, flag overrides, ambiguous-uuid error, prompt fallback on 401
<!-- AC:END -->

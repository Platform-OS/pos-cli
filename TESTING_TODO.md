# Testing TODO - Missing Scenarios, Optimizations, and Improvements

This document tracks testing gaps, missing scenarios, and potential improvements for the pos-cli test suite.

## Overview

Current test coverage is organized into:
- **Unit tests** (`test/unit/`) - 22 test files with 329 tests
- **Integration tests** (`test/integration/`) - 9 test files requiring real platformOS instances
- **E2E tests** (`gui/next/playwright/`) - 6 active Playwright test files for GUI

### Recent Progress (2026-01-20)

Fixed existing test failures:
- [x] Fixed 21 failing generator tests (path resolution bug)
- [x] Fixed 2 failing manifest tests (updated assertions to match code behavior)

New unit tests added:
- [x] `ServerError.test.js` - 28 tests for HTTP error handling
- [x] `settings.test.js` - 13 tests for environment settings
- [x] `validators.test.js` - 33 tests for all validators (email, url, existence, directoryExists, directoryEmpty)
- [x] `duration.test.js` - 16 tests for time formatting
- [x] `data-utils.test.js` - 24 tests for isValidJSON and waitForStatus
- [x] `directories.test.js` - 17 tests for directory constants and methods

**Total tests added: 131 new tests**

---

## 1. Missing Unit Tests (High Priority)

### 1.1 Core Library Modules Without Tests

| Module | File | Priority | Status | Notes |
|--------|------|----------|--------|-------|
| ServerError | `lib/ServerError.js` | **Critical** | ✅ Done | 28 tests added in `ServerError.test.js` |
| Settings | `lib/settings.js` | **Critical** | ✅ Done | 13 tests added in `settings.test.js` |
| Watch Queue | `lib/watch.js` | **High** | ⏳ Pending | Queue logic, concurrency, debouncing untested. Only `shouldBeSynced` is tested. |
| Environments | `lib/environments.js` | **High** | ⏳ Pending | Device auth flow, token management. No dedicated tests. |
| Assets Orchestration | `lib/assets.js` | **High** | ⏳ Pending | Asset deployment orchestration. No tests. |
| S3 Upload | `lib/s3UploadFile.js` | **High** | ⏳ Pending | Direct S3 upload logic. No tests. |
| Presign URL | `lib/presignUrl.js` | **High** | ⏳ Pending | Only minimal test exists. Needs error handling tests. |
| Logsv2 HTTP | `lib/logsv2/http.js` | **Medium** | ⏳ Pending | OpenObserve API client. No tests. |
| Server | `lib/server.js` | **Medium** | ⏳ Pending | Express server for GUI. Only integration tested. |
| Overwrites | `lib/overwrites.js` | **Medium** | ⏳ Pending | Module overwrite management. No tests. |
| Download File | `lib/downloadFile.js` | **Medium** | ⏳ Pending | URL download utility. No tests. |
| Unzip | `lib/unzip.js` | **Medium** | ⏳ Pending | Archive extraction. No tests. |
| Duration | `lib/duration.js` | **Low** | ✅ Done | 16 tests added in `duration.test.js` |
| Directories | `lib/directories.js` | **Low** | ✅ Done | 17 tests added in `directories.test.js` |
| Swagger Client | `lib/swagger-client.js` | **Low** | ⏳ Pending | OpenAPI client. No tests. |

### 1.2 Missing Tests for Existing Modules

#### Deploy Strategy (`lib/deploy/`)

```
TODO:
- [ ] Test directAssetsUploadStrategy.js specifically
  - [ ] Asset collection from app/assets/ and modules/*/public/assets/
  - [ ] S3 presigned URL flow
  - [ ] Manifest generation and submission
  - [ ] CDN propagation waiting
  - [ ] Error handling during asset upload
  - [ ] Partial deployment with assets

- [ ] Test defaultStrategy.js specifically
  - [ ] Full archive creation
  - [ ] Legacy marketplace_builder/ directory support

- [ ] Test strategy.js selector
  - [ ] Correct strategy selection based on options
  - [ ] Fallback behavior
```

#### Data Operations (`lib/data/`)

```
Status: Partially Complete (see data-utils.test.js)

- [x] waitForStatus.js - ✅ 10 tests
  - [x] Polling logic with timeout
  - [x] Various status transitions (pending -> success, pending -> error)
  - [x] Network error handling during polling
  - [x] Callback on status changes
  - [x] Status as object with name property

- [x] isValidJSON.js - ✅ 14 tests
  - [x] Valid JSON (objects, arrays, strings, numbers, booleans, null)
  - [x] Invalid JSON detection
  - [x] Empty/undefined handling

- [ ] uploadFiles.js
  - [ ] File upload flow
  - [ ] Multi-file upload
  - [ ] Error handling

- [ ] fetchFiles.js
  - [ ] File download for data records
  - [ ] Error handling
```

#### Validators (`lib/validators/`)

```
Status: ✅ Complete (see validators.test.js - 33 tests)

- [x] email.js - 6 tests for email format validation
- [x] url.js - 8 tests for URL format validation
- [x] existence.js - 9 tests for argument existence checks
- [x] directoryExists.js - 5 tests for directory validation
- [x] directoryEmpty.js - 5 tests for empty directory detection
```

#### Test Runner (`lib/test-runner/`)

```
TODO:
- [ ] index.js - Test orchestration logic
- [ ] formatters.js - Result formatting
- [ ] logStream.js - Log streaming during tests
```

#### Utils (`lib/utils/`)

```
TODO:
- [ ] create-directory.js - Safe directory creation
- [ ] password.js - Password input masking (if testable)
```

---

## 2. Missing Integration Test Scenarios

### 2.1 Deploy Scenarios

```
TODO:
- [ ] Partial deployment (-p flag)
  - [ ] Only changed files are deployed
  - [ ] Asset handling in partial deploy

- [ ] Deploy with modules that have dependencies
  - [ ] Dependency resolution during deploy
  - [ ] Template value injection

- [ ] Deploy rollback on failure
  - [ ] What happens when deploy fails mid-way?

- [ ] Deploy with .posignore patterns
  - [ ] Files matching patterns are excluded

- [ ] Deploy with large number of files (stress test)
  - [ ] Memory usage
  - [ ] Timeout handling
```

### 2.2 Sync Scenarios

```
TODO:
- [ ] LiveReload integration
  - [ ] Browser refresh on file change

- [ ] Concurrent file changes
  - [ ] Queue handles rapid changes correctly
  - [ ] No race conditions

- [ ] Sync with --direct-assets-upload (-a flag)
  - [ ] Asset sync to S3

- [ ] Sync error recovery
  - [ ] Network failure during sync
  - [ ] Server error during sync
  - [ ] Retry behavior

- [ ] Sync with different concurrency levels
  - [ ] Default (3)
  - [ ] High concurrency (10)
  - [ ] Low concurrency (1)
```

### 2.3 Module Scenarios

```
TODO:
- [ ] modules-install.test.js
  - [ ] Fresh module installation
  - [ ] Module with dependencies
  - [ ] Conflict resolution

- [ ] modules-remove.test.js
  - [ ] Clean removal
  - [ ] Removal with dependent modules

- [ ] modules-init.test.js
  - [ ] Create new module from template
  - [ ] Template customization

- [ ] modules-version.test.js
  - [ ] Version display
  - [ ] Version comparison

- [ ] modules-overwrites-list.test.js
  - [ ] List module file overwrites

- [ ] modules-overwrites-diff.test.js
  - [ ] Show diff of overwritten files
```

### 2.4 Data Operation Scenarios

```
TODO:
- [ ] data-export.test.js
  - [ ] Export users
  - [ ] Export models/tables
  - [ ] Export with file attachments
  - [ ] Large data export (pagination)

- [ ] data-import.test.js
  - [ ] Import JSON data
  - [ ] Import with file associations
  - [ ] Import validation errors
  - [ ] Duplicate handling

- [ ] data-update.test.js
  - [ ] Update specific records
  - [ ] Batch updates

- [ ] data-clean.test.js
  - [ ] Clean all data
  - [ ] Clean specific types
  - [ ] Confirmation required
```

### 2.5 Other Commands

```
TODO:
- [ ] logsv2-search.test.js
  - [ ] SQL query execution
  - [ ] Time range filtering
  - [ ] Result formatting

- [ ] logsv2-alerts.test.js
  - [ ] List alerts
  - [ ] Create alert
  - [ ] Trigger alert

- [ ] migrations.test.js
  - [ ] List migrations
  - [ ] Generate migration
  - [ ] Run migration

- [ ] constants.test.js
  - [ ] List constants
  - [ ] Set constant
  - [ ] Unset constant

- [ ] exec-graphql.test.js
  - [ ] Execute GraphQL query
  - [ ] Variable substitution
  - [ ] Error handling

- [ ] exec-liquid.test.js
  - [ ] Execute Liquid template
  - [ ] Context variables

- [ ] pull.test.js
  - [ ] Pull deployed files
  - [ ] Conflict handling

- [ ] clone-init.test.js
  - [ ] Initialize clone configuration

- [ ] uploads-push.test.js
  - [ ] Push files to CDN
```

---

## 3. Test Quality Improvements

### 3.1 Error Handling Coverage

```
TODO: Ensure all error paths are tested
- [ ] 401 Unauthorized - token expired, invalid token
- [ ] 403 Forbidden - insufficient permissions
- [ ] 404 Not Found - missing resources
- [ ] 422 Unprocessable Entity - validation errors
- [ ] 429 Too Many Requests - rate limiting
- [ ] 500 Internal Server Error
- [ ] 502 Bad Gateway
- [ ] 503 Service Unavailable
- [ ] 504 Gateway Timeout
- [ ] Network errors (ECONNREFUSED, ETIMEDOUT, etc.)
- [ ] DNS resolution failures
- [ ] SSL/TLS certificate errors
```

### 3.2 Edge Cases

```
TODO: Test edge cases across modules
- [ ] Empty files
- [ ] Very large files (>100MB)
- [ ] Files with special characters in names
- [ ] Unicode/emoji in file content
- [ ] Binary files
- [ ] Symlinks
- [ ] Permission denied scenarios
- [ ] Disk full scenarios
- [ ] Invalid JSON/YAML syntax
- [ ] Circular dependencies in modules
- [ ] Very deep directory nesting
- [ ] Very long file paths
```

### 3.3 Concurrent Operations

```
TODO: Test race conditions and concurrency
- [ ] Multiple sync operations simultaneously
- [ ] Concurrent deploy attempts
- [ ] Parallel module downloads
- [ ] Multiple GUI server instances
```

---

## 4. Test Infrastructure Improvements

### 4.1 Mock Data Organization

```
Current: Mock data embedded in test files
Improvement: Centralized mock data in fixtures

TODO:
- [ ] Create test/fixtures/mocks/ directory
- [ ] Organize mocks by API endpoint:
      mocks/
      ├── api/
      │   ├── marketplace_releases/
      │   │   ├── success.json
      │   │   ├── pending.json
      │   │   └── error.json
      │   ├── instance/
      │   ├── logs/
      │   └── graph/
      └── portal/
          ├── jwt.json
          ├── modules.json
          └── versions.json
```

### 4.2 Test Utilities

```
TODO: Add helper utilities
- [ ] createTempProject() - Create temporary test project with fixtures
- [ ] mockGateway() - Pre-configured Gateway mock for common scenarios
- [ ] mockPortal() - Pre-configured Portal mock
- [ ] withEnv() - Helper to run code with specific env vars
- [ ] expectApiCall() - Assert API was called with specific params
```

### 4.3 Test Categories/Tags

```
TODO: Add test categorization for selective running
- [ ] @slow - Long-running tests
- [ ] @network - Tests requiring network access
- [ ] @flaky - Tests with intermittent failures
- [ ] @smoke - Critical path tests for CI
```

### 4.4 Code Coverage

```
TODO: Set up code coverage reporting
- [ ] Configure Vitest coverage with v8 or istanbul
- [ ] Set coverage thresholds:
      - Statements: 70%
      - Branches: 60%
      - Functions: 70%
      - Lines: 70%
- [ ] Add coverage badge to README
- [ ] Generate coverage reports in CI
```

---

## 5. Performance & Optimization

### 5.1 Test Speed

```
TODO: Improve test execution speed
- [ ] Lazy import modules to reduce startup time
- [ ] Use beforeAll instead of beforeEach where safe
- [ ] Parallelize independent test files
- [ ] Cache compiled modules between test runs
- [ ] Profile slow tests and optimize
```

### 5.2 Flaky Test Mitigation

```
TODO: Reduce test flakiness
- [ ] Add retry logic for network-dependent tests
- [ ] Use deterministic timestamps in tests
- [ ] Ensure proper cleanup in afterEach/afterAll
- [ ] Add timeout configuration per test type
- [ ] Document known flaky tests and reasons
```

### 5.3 CI/CD Integration

```
TODO: Improve CI test reliability
- [ ] Run unit tests first (fast feedback)
- [ ] Run integration tests in isolated environment
- [ ] Cache node_modules between runs
- [ ] Run tests in matrix (Node 20, 22, 24)
- [ ] Fail fast on critical test failures
```

---

## 6. Documentation

### 6.1 Test Documentation

```
TODO: Improve test documentation
- [ ] Add JSDoc comments to test utilities
- [ ] Document test fixtures and their purpose
- [ ] Create examples for common test patterns
- [ ] Document credential setup for integration tests
```

### 6.2 Contributing Guide

```
TODO: Create testing section in CONTRIBUTING.md
- [ ] How to run tests
- [ ] How to write new tests
- [ ] Mock strategy guidelines
- [ ] When to write unit vs integration tests
- [ ] Test naming conventions
```

---

## 7. Specific Bug/Scenario Tests

### 7.1 Reported Issues (Example Placeholders)

```
TODO: Add regression tests for known issues
- [ ] #XXX: Deploy fails with special characters in filename
- [ ] #XXX: Sync ignores nested .posignore files
- [ ] #XXX: Module download hangs on slow network
```

### 7.2 Platform-Specific Tests

```
TODO: Test platform-specific behavior
- [ ] Windows path handling (backslashes)
- [ ] macOS case-insensitive filesystem
- [ ] Linux permission handling
- [ ] WSL interoperability
```

---

## 8. Audit Rule Coverage

### 8.1 Missing Audit Rule Tests

```
Current coverage in test/unit/audit.test.js is limited.

TODO: Expand audit rule testing
- [ ] tags.js - All deprecated tag patterns
  - [ ] query_graph (deprecated, use graphql)
  - [ ] enable_profiler
  - [ ] Other deprecated tags

- [ ] filters.js - Liquid filter validation
  - [ ] Deprecated filters
  - [ ] Custom filter validation

- [ ] extensions.js - File extension validation
  - [ ] Invalid extensions
  - [ ] Case sensitivity

- [ ] fileName.js - Filename validation
  - [ ] Reserved names
  - [ ] Special characters
  - [ ] Length limits

- [ ] duplicateFile.js - Duplicate detection
  - [ ] Same name, different case
  - [ ] Same content, different path

- [ ] orphanedIncludes.js - Unused partials
  - [ ] Complex include patterns
  - [ ] Dynamic includes

- [ ] detailed.js - Detailed analysis
  - [ ] Full code analysis
```

---

## Priority Order

1. **Critical** (Week 1) - ✅ Mostly Complete
   - [x] ServerError.js tests - 28 tests
   - [x] Settings.js tests - 13 tests
   - [ ] Watch queue logic tests
   - [ ] Deploy strategy tests

2. **High** (Week 2-3)
   - [ ] Assets orchestration tests
   - [ ] S3 upload tests
   - [ ] Environments.js tests
   - [x] Data operation tests (partial) - 24 tests
   - [ ] Error handling coverage

3. **Medium** (Week 4-5)
   - [ ] Logsv2 tests
   - [x] Validator tests - 33 tests
   - [ ] Test runner tests
   - [ ] Edge case coverage

4. **Low** (Ongoing)
   - [x] Duration.js tests - 16 tests
   - [x] Directories.js tests - 17 tests
   - [ ] Documentation improvements
   - [ ] Performance optimizations
   - [ ] Platform-specific tests

---

## Tracking Progress

Update this file as tests are added:

- [ ] = Not started
- [~] = In progress
- [x] = Completed

### Summary

| Category | Tests Before | Tests After | Change |
|----------|-------------|-------------|--------|
| Unit Tests | 198 | 329 | +131 |
| Test Files | 16 | 22 | +6 |
| Test Failures | 23 | 0 | Fixed |

### New Test Files Added

1. `test/unit/ServerError.test.js` - 28 tests
2. `test/unit/settings.test.js` - 13 tests
3. `test/unit/validators.test.js` - 33 tests
4. `test/unit/duration.test.js` - 16 tests
5. `test/unit/data-utils.test.js` - 24 tests
6. `test/unit/directories.test.js` - 17 tests

### Test Files Fixed

1. `test/unit/generators.test.js` - Fixed path resolution (21 tests)
2. `test/unit/manifest.test.js` - Updated assertions (2 tests)

Last updated: 2026-01-20

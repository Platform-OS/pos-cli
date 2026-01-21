# Windows Compatibility Guide

This document tracks cross-platform compatibility issues between Windows and Unix-like systems (Linux, macOS) and their solutions.

## Overview

pos-cli must work identically on Windows, Linux, and macOS. The primary differences between these platforms that affect the codebase are:

1. **Path Separators**: Windows uses backslash (`\`), Unix uses forward slash (`/`)
2. **Line Endings**: Windows uses CRLF (`\r\n`), Unix uses LF (`\n`)
3. **Command Execution**: Different shell commands and path handling
4. **File System**: Case sensitivity and character restrictions differ

## Test Failures on Windows (CI Build)

### Current Status
- **Total Tests**: 499
- **Failures**: 19
- **Skipped**: 1
- **Passing**: 479

### Failure Categories

#### 1. Line Ending Issues (6 failures)

**Problem**: Code assumes Unix line endings (`\n`) but Windows uses CRLF (`\r\n`)

**Affected Files**:
- `lib/files.js` - `.posignore` file parsing
- `lib/templates.js` - Template processing
- `lib/assets/manifest.js` - File size calculations

**Specific Failures**:
1. `test/unit/templates.test.js` (2 failures)
   - Test expects: `slug: aStringValue\n`
   - Windows gives: `slug: aStringValue\r\n`
   - Root cause: Template fixture has Windows line endings on Windows

2. `test/unit/files.test.js` (1 failure)
   - Test expects: `['foo', 'bar', 'baz']`
   - Windows gives: `['foo', 'bar', '', 'baz']` (empty string with `\r`)
   - Root cause: `.split('\n')` leaves `\r` characters on Windows
   - Location: `lib/files.js:62`

3. `test/unit/manifest.test.js` (2 failures)
   - Test expects: `file_size: 20`
   - Windows gives: `file_size: 21`
   - Root cause: File has CRLF on Windows (1 extra byte per line ending)
   - Location: Manifest generation in `lib/assets/manifest.js`

**Solution Strategy**:
- Use `split(/\r?\n/)` instead of `split('\n')` to handle both endings
- Normalize line endings in test comparisons
- Use `.trim()` to remove trailing whitespace including `\r`
- For file size tests, either normalize fixtures or make tests platform-aware

#### 2. Path Separator Issues (9 failures)

**Problem**: Mix of forward slashes and backslashes in paths

**Affected Files**:
- `lib/shouldBeSynced.js` - Module path detection
- Audit tests - Path output formatting

**Specific Failures**:
1. `test/unit/sync.test.js` (2 failures)
   - "syncs files in modules/public directory" - returns `false` instead of `true`
   - "syncs files in modules/private directory" - returns `false` instead of `true`
   - Root cause: Path separator handling in `isValidModuleFile()` function
   - Location: `lib/shouldBeSynced.js:48-58`
   - Current code has Windows detection (`win = path.sep === path.win32.sep`)
   - Regex patterns don't match when paths use forward slashes in tests

2. `test/unit/audit.test.js` (7 failures)
   - Tests use `path.join()` which creates `app\views\pages\error.liquid` on Windows
   - But output uses forward slashes: `app/views/pages/error.liquid`
   - Root cause: Inconsistent path normalization in audit output

**Solution Strategy**:
- Always normalize paths to forward slashes for internal use
- Use `path.normalize()` consistently
- Convert paths using `.replace(/\\/g, '/')` after path operations
- Make regex patterns platform-agnostic or normalize input first

#### 3. Sync Output Format Changes (6 failures)

**Problem**: Output format changed in recent updates

**Affected Files**:
- `test/integration/sync.test.js`

**Specific Failures**:
- Tests expect: `[Sync] Synced asset: app/assets/bar.js`
- Actual output: `[14:59:35] [Sync] Synced: assets/bar.js`
- Changes: Added timestamps, changed labels, removed `app/` prefix

**Solution Strategy**:
- Update test expectations to match new output format
- Use regex patterns that ignore timestamps: `/\[Sync\] Synced: assets\/bar\.js/`
- Or update sync command to restore old format

#### 4. Command Exit Code Issues (3 failures)

**Problem**: CLI command not found in test environment

**Affected Files**:
- `test/integration/test-run.test.js`

**Specific Failures**:
- Expected exit code: `1` (validation error)
- Actual exit code: `127` (command not found)
- Tests affected: environment validation, connection refused, invalid URL

**Solution Strategy**:
- Ensure CLI is properly linked before running integration tests
- Check PATH configuration in CI environment
- May be Windows-specific issue with `npm link` or global installation

## Common Cross-Platform Patterns

### Pattern 1: Path Handling

**Problem**: Path separators differ between platforms

**Bad**:
```javascript
// Hard-coded forward slashes
if (filePath.startsWith('modules/')) { ... }

// String concatenation
const fullPath = 'app/' + filename;
```

**Good**:
```javascript
// Use path.join for construction
const fullPath = path.join('app', filename);

// Normalize for comparison
const normalized = filePath.replace(/\\/g, '/');
if (normalized.startsWith('modules/')) { ... }

// Or use path.sep explicitly
const re = new RegExp(`^modules\\${path.sep}`);
```

### Pattern 2: Line Ending Handling

**Problem**: Text files have different line endings

**Bad**:
```javascript
// Assumes Unix line endings
const lines = content.split('\n');

// Direct string comparison with \n
if (content.endsWith('\n')) { ... }
```

**Good**:
```javascript
// Handle both CRLF and LF
const lines = content.split(/\r?\n/);

// Normalize before comparison
const normalized = content.replace(/\r\n/g, '\n');

// Or use .trim() to ignore trailing whitespace
const lines = content.split(/\r?\n/).filter(line => line.trim());
```

### Pattern 3: File Operations

**Problem**: File size and encoding differ

**Bad**:
```javascript
// Hard-coded expectations
expect(fs.statSync(file).size).toBe(20);
```

**Good**:
```javascript
// Read and normalize
const content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
expect(Buffer.from(content).length).toBe(20);

// Or calculate expected size dynamically
const expectedSize = fs.statSync(file).size;
```

### Pattern 4: Regular Expressions

**Problem**: Path separators in regex patterns

**Bad**:
```javascript
// Unix-only pattern
const re = /^modules\/.*\/(public|private)/;
```

**Good**:
```javascript
// Dynamic pattern based on platform
const sep = path.sep === '\\' ? '\\\\' : '/';
const re = new RegExp(`^modules${sep}.*${sep}(public|private)`);

// Or normalize input first
const normalized = filePath.replace(/\\/g, '/');
const re = /^modules\/.*\/(public|private)/;
if (re.test(normalized)) { ... }
```

## Implementation Checklist

### Core Library Fixes

- [x] Identify all line-ending-sensitive operations
- [ ] `lib/files.js:62` - Fix `.split('\n')` to handle CRLF
- [ ] `lib/shouldBeSynced.js:48-58` - Normalize paths before regex matching
- [ ] Review all `String.split('\n')` calls in codebase
- [ ] Review all hardcoded path separators in strings

### Test Fixes

- [ ] `test/unit/templates.test.js` - Normalize expected output
- [ ] `test/unit/files.test.js` - Update `.posignore` parsing expectations
- [ ] `test/unit/manifest.test.js` - Make file size tests platform-aware
- [ ] `test/unit/sync.test.js` - Fix module path test expectations
- [ ] `test/unit/audit.test.js` - Normalize paths in assertions
- [ ] `test/integration/sync.test.js` - Update output format expectations
- [ ] `test/integration/test-run.test.js` - Fix CLI availability in CI

### Testing Strategy

1. **Local Testing**: Run tests on both platforms during development
2. **CI Testing**: Automated tests on Windows, Linux, macOS
3. **Manual Testing**: Test CLI commands on all platforms
4. **Path Testing**: Specific tests for path handling edge cases
5. **Line Ending Testing**: Tests with fixtures in both CRLF and LF formats

### Best Practices Going Forward

1. **Always use `path.join()` for path construction**
2. **Normalize paths to forward slashes for internal logic**
3. **Use `/\r?\n/` for splitting text by lines**
4. **Filter empty lines with `.filter(Boolean)` or `.filter(line => line.trim())`**
5. **Test on Windows in CI before merging**
6. **Use `.gitattributes` to control line endings in repository**
7. **Document platform-specific behavior in code comments**

## Git Configuration

Add to `.gitattributes`:
```gitattributes
# Auto-detect text files and normalize to LF
* text=auto

# Explicitly set line endings for specific files
*.js text eol=lf
*.json text eol=lf
*.md text eol=lf
*.yml text eol=lf

# Test fixtures - preserve line endings
test/fixtures/** -text

# Windows batch files
*.bat text eol=crlf
```

## Resources

- Node.js Path Module: https://nodejs.org/api/path.html
- Cross-Platform Best Practices: https://shapeshed.com/writing-cross-platform-node/
- Git Line Ending Handling: https://git-scm.com/docs/gitattributes

## Status

Last updated: 2026-01-21
Windows CI: Failing (19 tests)
Ubuntu CI: Passing (all tests)
Target: All tests passing on both platforms

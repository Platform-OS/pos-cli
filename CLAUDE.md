# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

pos-cli is a command-line interface tool for deploying and managing platformOS applications. It provides sync mode for development, deployment capabilities, module management, data operations, and a local admin GUI. The codebase is structured as a Node.js CLI with 50+ commands and extensive integration with the platformOS API.

## Common Commands

### Development
```bash
npm ci                    # Install dependencies
npm start                 # Start development environment
npm run build             # Build production assets (for GUI components)
npm test                  # Run all tests (requires test environment credentials)
npm run test-watch        # Run tests in watch mode
```

### Testing
Tests are integration tests that require actual platformOS instances. Configure via environment variables:
```bash
# Set in .env file or environment
MPKIT_URL=https://your-test-instance.example.com
MPKIT_EMAIL=your-email@example.com
MPKIT_TOKEN=your-token

npm test                  # Run all tests with Jest
DEBUG=1 npm test          # Run with debug output
```

Tests run with `--runInBand` to prevent race conditions. Fixtures are in `/test/fixtures/`.

### Local Development Workflow
```bash
# After forking the repo:
npm unlink .
npm uninstall -g @platformos/pos-cli
npm link                  # Link local version globally
npm install
```

## Architecture

### Directory Structure

```
pos-cli/
├── bin/              # CLI command entry points (60+ executables)
│   ├── pos-cli.js               # Main entry point
│   ├── pos-cli-deploy.js        # Deploy command
│   ├── pos-cli-sync.js          # Sync command
│   ├── pos-cli-env-add.js       # Environment management
│   ├── pos-cli-modules-*.js     # Module commands
│   ├── pos-cli-gui-serve.js     # GUI server
│   ├── pos-cli-check.js         # Liquid code quality check
│   ├── pos-cli-check-init.js    # Generate .platformos-check.yml
│   ├── pos-cli-check-run.js     # Run platformos-check linter
│   ├── pos-cli-lsp.js           # Language Server Protocol server
│   ├── pos-cli-mcp.js           # MCP server entry point
│   ├── pos-cli-mcp-config.js    # Display MCP tool configuration
│   └── pos-cli-fetch-logs.js    # Fetch logs as NDJSON (for scripting/MCP)
├── lib/              # Core business logic
│   ├── proxy.js                 # Gateway class - main API client
│   ├── ServerError.js           # Centralized error handling
│   ├── settings.js              # Environment configuration (.pos file)
│   ├── environments.js          # Authentication flows
│   ├── portal.js                # Partner Portal API client
│   ├── watch.js                 # File watching for sync mode
│   ├── archive.js               # Deployment archive creation
│   ├── push.js                  # Archive upload
│   ├── check.js                 # Liquid/JSON linter (platformos-check)
│   ├── templates.js             # Mustache template processing
│   ├── modules.js               # Module lifecycle management
│   ├── deploy/                  # Deployment strategies
│   ├── audit/                   # Code quality checks
│   ├── data/                    # Import/export/clean
│   ├── assets/                  # Asset deployment
│   ├── logsv2/                  # OpenObserve logs integration
│   └── validators/              # Input validation
├── mcp-min/          # MCP server implementation
│   ├── index.js                 # Starts stdio + HTTP/SSE transports
│   ├── stdio-server.js          # MCP over stdio (for editor integrations)
│   ├── http-server.js           # HTTP/SSE transport (port 5910)
│   ├── tools.js                 # Tool registry
│   ├── tools.config.json        # Enable/disable tools, customize descriptions
│   └── <tool-name>/             # One directory per tool group (deploy/, data/, etc.)
├── gui/              # Web UI applications
│   ├── admin/                   # Admin panel (Svelte, pre-built)
│   ├── graphql/                 # GraphiQL IDE (React, pre-built)
│   ├── liquid/                  # Liquid evaluator (pre-built)
│   └── next/                    # Main GUI (Next.js, pre-built)
├── test/             # Integration tests
│   └── fixtures/                # Test projects
└── scripts/          # Utility scripts
```

### Command Structure Pattern

**Entry Points (bin/)**: Each command is a separate executable. Commands are thin wrappers that:
1. Parse arguments using Commander.js
2. Fetch authentication data from settings
3. Delegate to lib/ modules for implementation

Example:
```javascript
// bin/pos-cli-deploy.js
import { fetchSettings } from '../lib/settings';
import deployStrategy from '../lib/deploy/strategy.js';

program
  .argument('[environment]', 'name of environment')
  .option('-p --partial-deploy', 'Partial deployment')
  .action(async (environment, params) => {
    const authData = fetchSettings(environment);
    deployStrategy.run({ strategy: 'directAssetsUpload', opts: { ... } });
  });
```

**Implementation (lib/)**: Contains all core logic, organized by functional area.

### Key Architectural Patterns

#### 1. Gateway Pattern - API Client
**File**: `lib/proxy.js`

The `Gateway` class is the central API client for all platformOS API communication:
```javascript
class Gateway {
  constructor({ url, token, email }) {
    this.url = url;
    this.api_url = `${url}/api/app_builder`;
    this.authorizedRequest = requestPromise.defaults({
      headers: { Authorization: `Token ${token}` }
    });
  }

  ping()          // Health check
  sync(formData)  // Sync single file
  push(formData)  // Deploy archive
  graph(json)     // GraphQL query
  // ... 20+ API methods
}
```

All commands that interact with platformOS instances use this Gateway class.

#### 2. Strategy Pattern - Deployment
**Files**: `lib/deploy/strategy.js`, `lib/deploy/directAssetsUploadStrategy.js`, `lib/deploy/defaultStrategy.js`, `lib/deploy/dryRunStrategy.js`

Three deployment strategies:
- **directAssetsUpload** (modern, default): Separates code and assets. Assets upload directly to S3, then manifest sent to API
- **default** (legacy): Everything in one archive
- **dryRun**: Uploads release archive (no assets) with `dry_run=true` flag; server validates and reports files that would be upserted/deleted without applying any changes

Strategy selection:
```javascript
import defaultStrategy from './defaultStrategy.js';
import directAssetsUploadStrategy from './directAssetsUploadStrategy.js';
import dryRunStrategy from './dryRunStrategy.js';

const strategies = {
  default: defaultStrategy,
  directAssetsUpload: directAssetsUploadStrategy,
  dryRun: dryRunStrategy,
};

const run = ({ strategy, opts }) => strategies[strategy](opts);

export { run };
```

#### 3. MCP Server Pattern
**Directory**: `mcp-min/`

The MCP (Model Context Protocol) server exposes platformOS operations as tools for AI clients. It runs two transports simultaneously:
- **stdio** (`stdio-server.js`): Standard MCP transport for editor/AI integrations
- **HTTP/SSE** (`http-server.js`): REST + Server-Sent Events on port 5910 (env: `MCP_MIN_PORT`)

Tools are registered in `tools.js` and can be enabled/disabled via `tools.config.json` (or `MCP_TOOLS_CONFIG` env var). Each tool group lives in its own directory (`deploy/`, `data/`, `logs/`, etc.) and calls the Gateway directly (no CLI subprocess spawning).

```javascript
// mcp-min/index.js
startStdio();                          // stdio transport
await startHttp({ port: PORT });       // HTTP/SSE transport
```

Tools include: envs-list, env-add, deploy-start/status/wait, sync-file, logs-fetch, graphql-exec, liquid-exec, data-import/export/clean/validate, migrations-list/generate/run, tests-run/run-async, constants-list/set/unset, generators-list/help/run, check-run, uploads-push, portal tools (instance-create, partners-list, partner-get, endpoints-list).

#### 4. File Watching Pattern - Sync Mode

**File**: `lib/watch.js`

Sync mode watches files and pushes changes in real-time:
```javascript
const queue = Queue((task, callback) => {
  switch (task.op) {
    case 'push': push(gateway, task.path).then(callback);
    case 'delete': deleteFile(gateway, task.path).then(callback);
  }
}, program.concurrency); // Default: 3 concurrent connections

chokidar.watch(directories)
  .on('change', fp => shouldBeSynced(fp) && enqueuePush(fp))
  .on('add', fp => shouldBeSynced(fp) && enqueuePush(fp))
  .on('unlink', fp => shouldBeSynced(fp) && enqueueDelete(fp));
```

Key features:
- Queue-based async processing with configurable concurrency
- Respects .posignore patterns
- Optional LiveReload integration
- Debouncing to prevent excessive uploads

#### 5. Template Processing Pattern
**File**: `lib/templates.js`

Modules support ERB/EJS-style templates (`<%= var =%>`) for configuration:
```javascript
const fillInTemplateValues = (filePath, templateData) => {
  if (qualifedForTemplateProcessing(filePath) && hasTemplateValues(templateData)) {
    const fileBody = fs.readFileSync(filePath, 'utf8');
    return mustache.render(fileBody, templateData, {}, ['<%=', '=%>']);
  }
  return fs.createReadStream(filePath);
};
```

Values sourced from `modules/*/template-values.json`. Processed during sync and deploy.

#### 6. Authentication Flow
**Files**: `lib/environments.js`, `lib/envs/add.js`

Two authentication methods:
- **Device Authorization Flow** (modern, OAuth-style): Opens browser for authentication, no password in CLI
- **Email/Password Flow** (legacy): Direct credentials

Tokens stored in `.pos` configuration file (JSON format).

#### 7. Error Handling
**File**: `lib/ServerError.js`

Centralized error handling with specific handlers for different HTTP status codes (401, 404, 500, 502, 504, etc.). Each handler provides user-friendly messages and controls process exit behavior.

### Important Technical Details

#### Configuration Files
- `.pos` - Environment credentials (URL, token, email) as JSON
- `.posignore` - Files to exclude from sync/deploy (gitignore syntax)
- `app/pos-modules.json` - Installed modules list
- `modules/*/template-values.json` - Module configuration and dependencies

#### platformOS Directory Structure
pos-cli expects projects to follow this structure:
```
project/
├── app/ (or marketplace_builder/)  # Main application
│   ├── assets/                     # Static assets
│   ├── views/                      # Liquid templates
│   ├── graphql/                    # GraphQL queries/mutations
│   ├── schema/                     # Data models
│   ├── authorization_policies/     # Access control
│   ├── migrations/                 # Database migrations
│   └── pos-modules.json            # Module dependencies
├── modules/                        # Installed/local modules
│   └── <module-name>/
│       ├── public/                 # Public module files
│       ├── private/                # Private module files
│       └── template-values.json    # Module config
├── .pos                            # Environment configuration
└── .posignore                      # Ignore patterns
```

Run all commands from project root (one level above `app/` or `modules/`).

#### API Architecture
Main endpoints (`${INSTANCE_URL}/api/app_builder/`):
- `/marketplace_releases` (POST) - Deploy archive
- `/marketplace_releases/sync` (PUT) - Sync single file
- `/marketplace_releases/sync` (DELETE) - Delete file
- `/marketplace_releases/:id` (GET) - Check deploy status
- `/logs` (GET) - Streaming logs
- `/exports`, `/imports` - Data operations
- `/migrations` - Migration management
- `/installed_modules` - Module operations

GraphQL endpoint: `${INSTANCE_URL}/api/graph`

#### Asset Deployment Flow (directAssetsUpload)
1. Create release.zip WITHOUT assets → `/tmp/release.zip`
2. Upload release.zip to API
3. Collect all assets from `app/assets/` and `modules/*/public/assets/`
4. Create assets.zip
5. Get presigned S3 URL from platformOS
6. Upload directly to S3
7. Generate manifest.json with file paths and hashes
8. Send manifest to API → triggers CDN sync

This approach significantly speeds up deployments with large asset libraries.

#### Environment Variables
Key variables that affect behavior:
- `MPKIT_URL/MPKIT_EMAIL/MPKIT_TOKEN` - Direct auth (bypasses .pos file)
- `CONFIG_FILE_PATH` - Custom config file location
- `TEMPLATE_VALUES_FILE_PATH` - Custom template values path
- `CI` - Disables audit checks and notifications
- `DEBUG` - Enables debug logging
- `NO_COLOR` - Disables colored output
- `CONCURRENCY` - Override sync concurrency (default: 3)

#### Module System
Complete lifecycle:
- **Init**: Create from template (github.com/Platform-OS/pos-module-template)
- **Install**: Add to app/pos-modules.json, resolve dependencies, update lock file, and automatically download all module files to `modules/`
- **Publish**: Version and push to marketplace (requires Partner Portal account)
- **Pull**: Get deployed version from instance
- **Update**: Update version in pos-modules.json, resolve dependencies, update lock file, and automatically download updated module files to `modules/`

Note: `pos-cli modules download` has been removed. `install` and `update` always download all module files and dependencies automatically.

Module dependencies specified in `template-values.json`:
```json
{
  "machine_name": "my-module",
  "version": "1.0.0",
  "dependencies": ["core", "admin"]
}
```

#### GUI Server
Express server (`lib/server.js`) serves three pre-built web apps:
- Admin panel (port 3333, configurable with --port)
- GraphiQL browser (http://localhost:3333/gui/graphql)
- Liquid evaluator (http://localhost:3333/gui/liquid)

Can run with sync: `pos-cli gui serve staging --sync --open`

### Key Dependencies
- **commander** v14 - CLI framework
- **chokidar** - File watching with native fsevents on macOS
- **express** - GUI server
- **yazl** - Zip creation
- **request/request-promise** - HTTP client
- **mustache** - Template rendering (ERB/EJS-style)
- **fast-glob** - File pattern matching
- **inquirer/prompts** - Interactive CLI prompts
- **chalk** - Terminal colors
- **ora** - Loading spinners
- **yeoman-generator** - Code generators

### Testing Philosophy
Integration tests against real platformOS instances for reliability. Tests cover:
- Deploy (various strategies, error handling)
- Sync (file changes, assets, deletion)
- Modules (download, push, update)
- Data operations (import/export)
- Audit rules
- File validation

Tests require environment variables (MPKIT_URL, MPKIT_EMAIL, MPKIT_TOKEN) pointing to test instances.

## Development Practices

### Code Quality
- Code must be tested (see test/ directory for patterns)
- PRs should explain what the feature does and why
- Be consistent with existing patterns (Gateway for API calls, thin bin/ files, logic in lib/)
- Code should be generic and reusable

### Adding New Commands
1. Create bin file: `bin/pos-cli-mycommand.js`
2. Add to package.json `bin` section
3. Implement logic in lib/ module
4. Use Gateway class for API calls
5. Use settings.fetchSettings() for environment auth
6. Add integration tests in test/
7. Update README.md with command documentation

### Working with GUI Components
GUI apps are pre-built (in dist/ or build/ directories). To modify:
1. Navigate to specific GUI directory (e.g., `gui/admin/`)
2. Make changes to source files
3. Run build process (`npm run build`)
4. Commit built assets (they're included in npm package)

### Error Handling Guidelines
- Use ServerError handlers for API errors
- Provide user-friendly error messages
- Log to logger for consistent formatting
- Decide whether error should exit process or allow retry

### External Service Dependencies
- **platformOS API** - Main backend (deploy, sync, data, logs)
- **Partner Portal** - Authentication via JWT, module marketplace
- **S3** - Direct asset uploads (presigned URLs)
- **OpenObserve** - Log aggregation and search (logs v2)
- **CDN** - Asset delivery and verification

## Cross-Platform Compatibility

pos-cli must work correctly on both Windows and Linux/macOS. Follow these patterns to ensure cross-platform compatibility:

### Path Handling Patterns

#### 1. **Use Node.js `path` Module for Filesystem Operations**
Always use `path` module functions for filesystem operations, never hardcode path separators:

**✓ Correct:**
```javascript
const filePath = path.join(baseDir, 'app', 'views', 'page.liquid');
const absPath = path.resolve(relativePath);
const relPath = path.relative(baseDir, absPath);
const dir = path.dirname(filePath);
const filename = path.basename(filePath);
const ext = path.extname(filePath);
```

**✗ Incorrect:**
```javascript
const filePath = baseDir + '/app/views/page.liquid';  // Breaks on Windows
const parts = filePath.split('/');  // Breaks on Windows (use path.sep)
```

#### 2. **Normalize Paths to Forward Slashes for API/Output**
The platformOS API and user-facing output should always use forward slashes. Use this pattern:

```javascript
// Pattern from lib/watch.js
const filePathUnixified = filePath =>
  filePath.replace(/\\/g, '/');  // Convert backslashes to forward slashes

// Alternative pattern from lib/check.js
const normalizedPath = filePath.split(path.sep).join('/');
```

**When to use:**
- Before sending paths to platformOS API
- For user-facing output (logs, error messages)
- For pattern matching with regex
- For JSON output

#### 3. **Path Splitting with `path.sep`**
When you need to split a path into components, use `path.sep`:

```javascript
// Extract module name from path like "modules/my-module/file.js"
const moduleName = filePath.split(path.sep)[1];

// Join path components
const normalizedPath = filePath.split(path.sep).join('/');
```

#### 4. **Complete Path Normalization Pattern**
For complex path operations (like in lib/check.js), use this comprehensive pattern:

```javascript
import { fileURLToPath } from 'url';
import path from 'path';

// 1. Convert URI to path (if from external source)
let absolutePath = fileURLToPath(uri);

// 2. Normalize OS-specific separators
absolutePath = path.normalize(absolutePath);

// 3. Generate relative path
let filePath = absolutePath;
if (basePath) {
  const normalizedBase = path.normalize(path.resolve(basePath));
  filePath = path.relative(normalizedBase, absolutePath);

  // 4. Convert to forward slashes for output
  filePath = filePath.split(path.sep).join('/');
}
```

#### 5. **URI to Path Conversion**
When converting file:// URIs to filesystem paths, use `fileURLToPath`:

```javascript
import { fileURLToPath } from 'url';

const uriToPath = (uri) => {
  try {
    return fileURLToPath(uri);  // Handles Windows drive letters correctly
  } catch (error) {
    // Fallback for non-standard URIs
    return uri.replace('file://', '');
  }
};
```

**Why:** On Windows, `file:///C:/path/file.txt` needs to become `C:\path\file.txt`, not `\C:\path\file.txt`.

#### 6. **Third-Party Normalization: `normalize-path`**
For consistent forward-slash conversion, the `normalize-path` package is available:

```javascript
import normalize from 'normalize-path';

const normalizedPath = normalize(windowsPath);  // Always returns forward slashes
```

**Used in:**
- `lib/shouldBeSynced.js` - For pattern matching
- `lib/assets/manifest.js` - For asset path normalization

#### 7. **Pattern Matching on Paths**
Always normalize paths before regex matching:

```javascript
const isAssetsPath = path => {
  const normalizedPath = path.replace(/\\/g, '/');
  return normalizedPath.startsWith('app/assets') ||
         /^modules\/\w+\/public\/assets/.test(normalizedPath);
};
```

### Testing Cross-Platform Code

When adding or modifying path-handling code:

1. **Test locally if possible** - If on Windows, test Windows behavior; if on Linux, test Linux behavior
2. **Check test output** - Look for path-related test failures in CI (tests run on both platforms)
3. **Verify path separators** - Ensure output paths use forward slashes consistently
4. **Test edge cases:**
   - Paths with spaces
   - Deeply nested paths
   - Paths at root level
   - Module paths vs app paths

### Common Mistakes to Avoid

**❌ Hardcoded path separators:**
```javascript
filePath.split('/');  // Breaks on Windows
filePath.includes('/');  // May not work on Windows
```

**❌ String concatenation for paths:**
```javascript
const fullPath = dir + '/' + filename;  // Use path.join() instead
```

**❌ Not normalizing before pattern matching:**
```javascript
if (filePath.startsWith('app/assets'))  // May fail on Windows
// Should be:
if (filePath.replace(/\\/g, '/').startsWith('app/assets'))
```

**❌ Using `path.relative()` without normalizing base:**
```javascript
path.relative(basePath, absolutePath);  // May give incorrect results
// Should normalize both first:
path.relative(path.normalize(path.resolve(basePath)), path.normalize(absolutePath));
```

### Key Files Demonstrating Best Practices

- **`lib/check.js`** - Comprehensive path normalization for linter output
- **`lib/watch.js`** - API-ready path preparation (`filePathUnixified`)
- **`lib/shouldBeSynced.js`** - Pattern matching with normalized paths
- **`lib/overwrites.js`** - Relative path generation
- **`lib/assets/manifest.js`** - Asset path normalization

## Network Error Handling (Node.js 22+ fetch / undici)

When `fetch()` fails in Node.js 22+, errors are wrapped in a chain up to 3 levels deep. `apiRequest.js` adds one more wrapper, so in `ServerError.requestHandler` the full chain is:

```
RequestError (pos-cli, apiRequest.js)
  └─ cause: TypeError: 'fetch failed'  (undici)
       └─ cause: NodeAggregateError | Error  (Node.js net.js)
```

**Why `NodeAggregateError`?** Node.js 22 enables Happy Eyeballs by default: when `localhost` resolves to multiple addresses (e.g. `::1` and `127.0.0.1`), all are tried concurrently and failures are collected in a `NodeAggregateError`. Crucially, `NodeAggregateError` **always copies `.code` from `errors[0].code`**, so `err.code === 'ECONNREFUSED'` works on both paths.

**The correct pattern — walk the cause chain recursively:**

```javascript
// lib/ServerError.js
const getNetworkErrorCode = (err, depth = 0) => {
  if (!err || depth > 5) return null;
  if (err.code) return err.code;
  return getNetworkErrorCode(err.cause, depth + 1);
};

// In requestHandler:
const causeCode = getNetworkErrorCode(reason);  // finds code at whatever depth it sits
```

**Why not hardcode `reason.cause?.cause?.code`?** The depth can vary between Node.js versions and platforms. Recursive traversal is robust to that.

**Error codes are cross-platform strings** — `'ECONNREFUSED'`, `'ENOTFOUND'`, `'ETIMEDOUT'` are identical on Linux, macOS, and Windows. Only the numeric `errno` value differs (e.g. `-111` on Linux vs `-4078` on Windows for ECONNREFUSED). Always match on `.code`, never on `errno`.

**Test assertions** for connection-error tests should match what the handler actually outputs:
```javascript
expect(stderr).toMatch(/Could not connect|Request to( the)? server failed/);
//                       ^ correct handling   ^ safe fallback for unknown errors
```

**Key file**: `lib/ServerError.js` — `getNetworkErrorCode` helper + `requestHandler`

## Node.js Version

- **Minimum**: Node.js 22
- **Recommended**: Node.js 22+
- **Tested on**: 22, 24
- Check enforced by `scripts/check-node-version.js` postinstall hook

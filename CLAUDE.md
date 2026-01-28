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
├── bin/              # CLI command entry points (54 executables)
│   ├── pos-cli.js               # Main entry point
│   ├── pos-cli-deploy.js        # Deploy command
│   ├── pos-cli-sync.js          # Sync command
│   ├── pos-cli-env-add.js       # Environment management
│   ├── pos-cli-modules-*.js     # Module commands
│   └── pos-cli-gui-serve.js     # GUI server
├── lib/              # Core business logic
│   ├── proxy.js                 # Gateway class - main API client
│   ├── ServerError.js           # Centralized error handling
│   ├── settings.js              # Environment configuration (.pos file)
│   ├── environments.js          # Authentication flows
│   ├── portal.js                # Partner Portal API client
│   ├── watch.js                 # File watching for sync mode
│   ├── archive.js               # Deployment archive creation
│   ├── push.js                  # Archive upload
│   ├── templates.js             # Mustache template processing
│   ├── modules.js               # Module lifecycle management
│   ├── deploy/                  # Deployment strategies
│   ├── audit/                   # Code quality checks
│   ├── data/                    # Import/export/clean
│   ├── assets/                  # Asset deployment
│   ├── logsv2/                  # OpenObserve logs integration
│   └── validators/              # Input validation
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
**Files**: `lib/deploy/strategy.js`, `lib/deploy/directAssetsUploadStrategy.js`, `lib/deploy/defaultStrategy.js`

Two deployment strategies:
- **directAssetsUpload** (modern, default): Separates code and assets. Assets upload directly to S3, then manifest sent to API
- **default** (legacy): Everything in one archive

Strategy selection:
```javascript
import defaultStrategy from './defaultStrategy.js';
import directAssetsUploadStrategy from './directAssetsUploadStrategy.js';

const strategies = {
  default: defaultStrategy,
  directAssetsUpload: directAssetsUploadStrategy,
};

const run = ({ strategy, opts }) => strategies[strategy](opts);

export { run };
```

#### 3. File Watching Pattern - Sync Mode
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

#### 4. Template Processing Pattern
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

#### 5. Authentication Flow
**Files**: `lib/environments.js`, `lib/envs/add.js`

Two authentication methods:
- **Device Authorization Flow** (modern, OAuth-style): Opens browser for authentication, no password in CLI
- **Email/Password Flow** (legacy): Direct credentials

Tokens stored in `.pos` configuration file (JSON format).

#### 6. Error Handling
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
- **Install**: Add to app/pos-modules.json, then deploy
- **Publish**: Version and push to marketplace (requires Partner Portal account)
- **Download**: Fetch specific version from marketplace
- **Pull**: Get deployed version from instance
- **Update**: Update installed versions

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
- **commander** v12 - CLI framework
- **chokidar** - File watching with native fsevents on macOS
- **express** - GUI server
- **archiver** - Zip creation
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

## Node.js Version

- **Minimum**: Node.js 22
- **Recommended**: Node.js 22+
- **Tested on**: 22, 24
- Check enforced by `scripts/check-node-version.js` postinstall hook

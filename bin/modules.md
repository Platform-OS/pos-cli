# Modules

## modules install (no arguments)

Reads `pos-module.json`, resolves the full dependency tree, writes `pos-module.lock.json`, and downloads all modules.

```mermaid
sequenceDiagram
    actor Dev
    participant pos-cli
    participant filesystem
    participant Portal

    Dev->>pos-cli: pos-cli modules install
    pos-cli->>filesystem: read pos-module.json (dependencies)
    pos-cli->>Portal: fetch available versions for all deps (batched)
    pos-cli->>pos-cli: resolve full dependency tree (BFS constraint accumulation)
    pos-cli->>filesystem: write pos-module.lock.json
    pos-cli->>Portal: download changed/missing modules as .zip
    pos-cli->>filesystem: unzip modules into modules/
```

## modules install \<module-name\>

Adds a new module to `pos-module.json`, resolves the full dependency tree, and downloads all modules.

```mermaid
sequenceDiagram
    actor Dev
    participant pos-cli
    participant filesystem
    participant Portal

    Dev->>pos-cli: pos-cli modules install core@^2.0.0
    pos-cli->>Portal: verify module + version exist in registry
    pos-cli->>filesystem: write updated pos-module.json (adds core to dependencies)
    pos-cli->>Portal: fetch available versions for all deps (batched)
    pos-cli->>pos-cli: resolve full dependency tree (BFS constraint accumulation)
    pos-cli->>filesystem: write pos-module.lock.json
    pos-cli->>Portal: download changed/missing modules as .zip
    pos-cli->>filesystem: unzip modules into modules/
```

## modules install --frozen (CI mode)

Skips resolution entirely. Uses `pos-module.lock.json` as the sole source of truth. Downloads only what is missing from disk. No registry calls for resolution — only downloads.

```mermaid
sequenceDiagram
    actor CI
    participant pos-cli
    participant filesystem
    participant Portal

    CI->>pos-cli: pos-cli modules install --frozen
    pos-cli->>filesystem: read pos-module.lock.json (fail if missing/empty)
    pos-cli->>pos-cli: validate all pos-module.json deps are in lock file
    pos-cli->>Portal: download only modules missing from modules/ on disk
    pos-cli->>filesystem: unzip modules into modules/
```

## modules update \<module-name\>

Updates a single module. Resolves the full dependency tree and downloads changed modules.

```mermaid
sequenceDiagram
    actor Dev
    participant pos-cli
    participant filesystem
    participant Portal

    Dev->>pos-cli: pos-cli modules update core
    pos-cli->>Portal: fetch latest stable version of core
    pos-cli->>filesystem: write updated pos-module.json (updates core entry)
    pos-cli->>Portal: fetch available versions for all deps (batched)
    pos-cli->>pos-cli: resolve full dependency tree (BFS constraint accumulation)
    pos-cli->>filesystem: write pos-module.lock.json
    pos-cli->>Portal: download changed/missing modules as .zip
    pos-cli->>filesystem: unzip modules into modules/
```

## modules update (no arguments)

Re-resolves all range constraints to the best available version. Exact-pinned entries are left unchanged (use `pos-cli modules update <name>` to bump a specific pin).

```mermaid
sequenceDiagram
    actor Dev
    participant pos-cli
    participant filesystem
    participant Portal

    Dev->>pos-cli: pos-cli modules update
    pos-cli->>filesystem: read pos-module.json (ranges stay as-is, exact pins unchanged)
    pos-cli->>Portal: fetch available versions for all deps (batched)
    pos-cli->>pos-cli: resolve full dependency tree (BFS constraint accumulation)
    pos-cli->>filesystem: write pos-module.lock.json (if changed)
    pos-cli->>Portal: download changed/missing modules as .zip
    pos-cli->>filesystem: unzip modules into modules/
```

## modules deploy (push to instance)

```mermaid
sequenceDiagram
    actor Dev
    participant pos-cli
    participant filesystem
    participant Platform
    participant Portal

    Dev->>pos-cli: pos-cli deploy
    pos-cli->>filesystem: read pos-module.lock.json
    pos-cli->>Platform: send pos-module.lock.json
    Platform->>Portal: fetch modules at locked versions
    Platform->>Platform: install modules on instance
    pos-cli->>Platform: send inline module files (overwrites)
    Platform->>Platform: apply overwrites
```

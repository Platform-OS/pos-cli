# Modules

```mermaid
sequenceDiagram
    actor Dev
    participant poscli
    participant filesystem
    participant Platform
    participant Portal
    Dev->>poscli: pos-cli modules setup
    poscli->>filesystem: read local modules
    poscli->>Portal: create pos-modules.lock.json
```


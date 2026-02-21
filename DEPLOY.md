# DEPLOY.md - Production Deployment

## Docker

### Development

```bash
docker build -t mcp-dev .
docker run -p 3030:3030 \\
  -e ADMIN_API_KEY=supersecret \\
  -v $(pwd)/.pos:/app/.pos:ro \\
  -v $(pwd)/mcp/clients.json:/app/clients.json:ro \\
  mcp-dev npm run dev
```

### Production Dockerfile

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
COPY clients.json ./
EXPOSE 3030
CMD [\"npm\", \"start\"]
```

**Build & Run**
```bash
npm run build
docker build -t mcp-prod -f Dockerfile.prod .
docker run -p 3030:3030 \\
  -e ADMIN_API_KEY=prod-key \\
  -v /path/to/.pos:/app/.pos:ro \\
  mcp-prod
```

## Environment Variables

| Var | Required | Default | Description |
|-----|----------|---------|-------------|
| `ADMIN_API_KEY` | Yes | - | Admin endpoint auth |
| `NODE_ENV` | No | `development` | Environment |
| `PORT` | No | `3030` | HTTP port |

## Production Checklist

- [ ] `npm run build`
- [ ] Set `ADMIN_API_KEY`
- [ ] Volume mount `.pos/envs/` (read-only)
- [ ] Volume mount `clients.json` (read-only)
- [ ] Firewall: port 3030
- [ ] Health check: `/health`
- [ ] PM2/ systemd supervision
- [ ] Log aggregation (stdout JSON)

## Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-server
spec:
  replicas: 2
  template:
    spec:
      containers:
      - name: mcp
        image: mcp-prod:latest
        env:
        - name: ADMIN_API_KEY
          valueFrom:
            secretKeyRef:
              name: mcp-secrets
              key: admin-key
        volumeMounts:
        - name: pos-config
          mountPath: /app/.pos
          readOnly: true
        ports:
        - containerPort: 3030
---
apiVersion: v1
kind: Secret
metadata:
  name: mcp-secrets
data:
  admin-key: <base64>
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: clients-config
data:
  clients.json: |-
    { \"ai-clients\": { \"token\": \"...\" } }
```

## Reverse Proxy (nginx)

```nginx
server {
  listen 80;
  location / {
    proxy_pass http://localhost:3030;
    proxy_set_header Authorization $http_authorization;
    proxy_set_header X-API-Key $admin_api_key;
  }
}
```

---
**Recommended: Docker + nginx + CloudWatch Logs**","path":"DEPLOY.md
# Server-Sent Events (SSE) Streaming Guide

This guide provides comprehensive documentation for using the Server-Sent Events (SSE) streaming capabilities in the pos-cli MCP server for real-time log monitoring.

## Overview

The MCP server provides two streaming tools for accessing platformOS logs in real-time:

- **`platformos.logs.stream`** - Basic streaming with automatic polling
- **`platformos.logs.live`** - Enhanced streaming with duplicate detection and heartbeats

Both tools use Server-Sent Events (SSE) to push log data to clients as it becomes available.

## Quick Start

### 1. Start the MCP Server

```bash
cd /path/to/pos-cli
npm run mcp
```

The server will start on `http://localhost:3030`.

### 2. Configure Authentication

Set your client secret token (from `clients.json`):

```bash
export CLIENT_SECRET="your-client-secret-here"
```

### 3. Start Streaming Logs

**Basic streaming:**
```bash
curl -X POST http://localhost:3030/call-stream \
  -H "Authorization: Bearer $CLIENT_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"tool":"platformos.logs.stream","input":{"env":"staging"}}'
```

**Enhanced streaming with filtering:**
```bash
curl -X POST http://localhost:3030/call-stream \
  -H "Authorization: Bearer $CLIENT_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"tool":"platformos.logs.live","input":{"env":"staging","filter":"error","interval":2000}}'
```

## Streaming Tools Reference

### platformos.logs.stream

Streams logs continuously by polling the platformOS API at regular intervals.

**Parameters:**
- `env` (string, required) - Environment name (e.g., "staging", "production")
- `interval` (number, optional) - Polling interval in milliseconds (default: 3000)
- `filter` (string, optional) - Filter logs by type (e.g., "error", "info", "debug")

**Example:**
```json
{
  "tool": "platformos.logs.stream",
  "input": {
    "env": "staging",
    "interval": 5000,
    "filter": "error"
  }
}
```

### platformos.logs.live

Enhanced streaming with duplicate detection, heartbeats, and configurable duration.

**Parameters:**
- `env` (string, required) - Environment name
- `interval` (number, optional) - Polling interval in milliseconds (default: 3000)
- `filter` (string, optional) - Filter logs by type
- `maxDuration` (number, optional) - Maximum streaming duration in milliseconds (default: 300000 = 5 minutes)

**Example:**
```json
{
  "tool": "platformos.logs.live",
  "input": {
    "env": "production",
    "filter": "error",
    "interval": 1000,
    "maxDuration": 600000
  }
}
```

## SSE Event Format

The server sends events in the following format:

```
event: data
data: {"type":"text","text":"{"id":"123","timestamp":"2024-01-01T12:00:00Z","type":"info","message":"Log message","env":"staging"}"}

event: error
data: {"type":"error","text":"{"type":"error","message":"Connection failed","timestamp":"2024-01-01T12:00:00Z"}"}

event: done
data: [DONE]

: heartbeat

```

### Event Types

- **`data`** - Contains log entry data
- **`error`** - Contains error information
- **`done`** - Signals stream completion
- **`heartbeat`** - Keep-alive signal (comment line starting with `:`)

### Log Entry Format

Each log entry is a JSON object with the following structure:

```json
{
  "id": "unique-log-id",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "type": "error|info|debug|warn",
  "message": "Human-readable log message",
  "data": {
    "additional": "contextual data"
  },
  "env": "environment-name"
}
```

## Client Implementation Examples

### Node.js SSE Client

```javascript
const EventSource = require('eventsource');

class LogStreamer {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  streamLogs(env, options = {}) {
    const { tool = 'platformos.logs.stream', interval = 3000, filter } = options;

    const url = `${this.baseUrl}/call-stream`;
    const body = JSON.stringify({
      tool,
      input: { env, interval, filter }
    });

    // For demo - in production, use a proper SSE client
    fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body
    }).then(async response => {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        console.log('Raw SSE data:', chunk);

        // Parse SSE events
        this.parseSSE(chunk);
      }
    });
  }

  parseSSE(data) {
    const lines = data.split('\n');
    let currentEvent = null;

    for (const line of lines) {
      if (line.startsWith('event:')) {
        currentEvent = line.substring(6).trim();
      } else if (line.startsWith('data:') && currentEvent) {
        const eventData = line.substring(5).trim();
        this.handleEvent(currentEvent, eventData);
      }
    }
  }

  handleEvent(eventType, data) {
    switch (eventType) {
      case 'data':
        try {
          const logEntry = JSON.parse(JSON.parse(data).text);
          console.log(`[${logEntry.type.toUpperCase()}] ${logEntry.message}`);
        } catch (e) {
          console.log('Log data:', data);
        }
        break;
      case 'error':
        console.error('Stream error:', data);
        break;
      case 'done':
        console.log('Stream completed');
        break;
    }
  }
}

// Usage
const streamer = new LogStreamer('http://localhost:3030', 'your-token');
streamer.streamLogs('staging', { filter: 'error' });
```

### Python SSE Client

```python
import requests
import json
import sseclient  # pip install sseclient-py

class LogStreamer:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.token = token
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }

    def stream_logs(self, env, tool='platformos.logs.stream', **options):
        url = f"{self.base_url}/call-stream"
        payload = {
            'tool': tool,
            'input': {'env': env, **options}
        }

        response = requests.post(url, json=payload, headers=self.headers, stream=True)
        response.raise_for_status()

        client = sseclient.SSEClient(response)

        for event in client.events():
            self.handle_event(event.event, event.data)

    def handle_event(self, event_type, data):
        if event_type == 'data':
            try:
                # Parse the nested JSON structure
                log_data = json.loads(json.loads(data).get('text', '{}'))
                timestamp = log_data.get('timestamp', 'unknown')
                log_type = log_data.get('type', 'info').upper()
                message = log_data.get('message', '')

                print(f"[{timestamp}] [{log_type}] {message}")
            except json.JSONDecodeError:
                print(f"Raw data: {data}")

        elif event_type == 'error':
            print(f"Error: {data}")
        elif event_type == 'done':
            print("Stream completed")
        elif event_type == 'heartbeat':
            print(".", end="", flush=True)  # Show heartbeat as dots

# Usage
streamer = LogStreamer('http://localhost:3030', 'your-token')
streamer.stream_logs('staging', filter='error', interval=2000)
```

### JavaScript (Browser) SSE Client

```javascript
class LogStreamer {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  async streamLogs(env, options = {}) {
    const { tool = 'platformos.logs.stream', interval = 3000, filter } = options;

    try {
      const response = await fetch(`${this.baseUrl}/call-stream`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tool,
          input: { env, interval, filter }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages
        const messages = buffer.split('\n\n');
        buffer = messages.pop(); // Keep incomplete message in buffer

        for (const message of messages) {
          this.processSSEMessage(message.trim());
        }
      }
    } catch (error) {
      console.error('Streaming error:', error);
    }
  }

  processSSEMessage(message) {
    const lines = message.split('\n');
    let eventType = '';
    let data = '';

    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventType = line.substring(6).trim();
      } else if (line.startsWith('data:')) {
        data += line.substring(5).trim();
      }
    }

    this.handleEvent(eventType, data);
  }

  handleEvent(eventType, data) {
    const output = document.getElementById('log-output');

    switch (eventType) {
      case 'data':
        try {
          const logEntry = JSON.parse(JSON.parse(data).text);
          const logDiv = document.createElement('div');
          logDiv.className = `log-entry log-${logEntry.type}`;
          logDiv.textContent = `[${logEntry.timestamp}] ${logEntry.message}`;
          output.appendChild(logDiv);
          output.scrollTop = output.scrollHeight;
        } catch (e) {
          console.error('Parse error:', e);
        }
        break;

      case 'error':
        const errorDiv = document.createElement('div');
        errorDiv.className = 'log-entry log-error';
        errorDiv.textContent = `ERROR: ${data}`;
        output.appendChild(errorDiv);
        break;

      case 'done':
        const doneDiv = document.createElement('div');
        doneDiv.className = 'log-entry log-info';
        doneDiv.textContent = 'Stream completed';
        output.appendChild(doneDiv);
        break;
    }
  }
}

// Usage in browser
const streamer = new LogStreamer('http://localhost:3030', 'your-token');
streamer.streamLogs('staging', { filter: 'error' });
```

### HTML for Browser Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>Log Streamer</title>
  <style>
    #log-output {
      height: 400px;
      overflow-y: scroll;
      background: #f5f5f5;
      padding: 10px;
      font-family: monospace;
      border: 1px solid #ccc;
    }
    .log-entry { margin: 2px 0; padding: 2px; }
    .log-error { color: red; }
    .log-info { color: blue; }
    .log-debug { color: gray; }
  </style>
</head>
<body>
  <h1>Real-time Log Streaming</h1>
  <div id="log-output"></div>
  <script src="log-streamer.js"></script>
</body>
</html>
```

## Advanced Usage Patterns

### Error Monitoring Dashboard

```javascript
class ErrorMonitor {
  constructor(streamer) {
    this.streamer = streamer;
    this.errorCount = 0;
    this.errors = [];
  }

  async monitor(env) {
    await this.streamer.streamLogs(env, {
      tool: 'platformos.logs.live',
      filter: 'error',
      interval: 1000
    });
  }

  handleEvent(eventType, data) {
    if (eventType === 'data') {
      const logEntry = JSON.parse(JSON.parse(data).text);
      if (logEntry.type === 'error') {
        this.errorCount++;
        this.errors.push(logEntry);

        // Alert if too many errors
        if (this.errorCount > 10) {
          this.sendAlert();
        }
      }
    }
  }

  sendAlert() {
    console.error(`High error rate detected: ${this.errorCount} errors`);
    // Send notification, webhook, etc.
  }
}
```

### Log Aggregation and Analysis

```javascript
class LogAnalyzer {
  constructor() {
    this.stats = {
      total: 0,
      byType: {},
      byHour: {},
      errors: []
    };
  }

  processLog(logEntry) {
    this.stats.total++;

    // Count by type
    this.stats.byType[logEntry.type] = (this.stats.byType[logEntry.type] || 0) + 1;

    // Count by hour
    const hour = new Date(logEntry.timestamp).getHours();
    this.stats.byHour[hour] = (this.stats.byHour[hour] || 0) + 1;

    // Collect errors
    if (logEntry.type === 'error') {
      this.stats.errors.push(logEntry);
    }
  }

  getReport() {
    return {
      totalLogs: this.stats.total,
      typeBreakdown: this.stats.byType,
      hourlyDistribution: this.stats.byHour,
      recentErrors: this.stats.errors.slice(-10)
    };
  }
}
```

## Troubleshooting

### Common Issues

1. **Connection drops frequently**
   - Check network connectivity
   - Reduce polling interval
   - Use `platformos.logs.live` for better connection management

2. **Missing logs**
   - Verify environment name is correct
   - Check authentication token
   - Ensure the environment has logging enabled

3. **High latency**
   - Increase polling interval
   - Check server response times
   - Use filtering to reduce data volume

4. **Memory usage**
   - Implement log rotation/cleanup
   - Limit streaming duration
   - Process logs in batches

### Connection Recovery

```javascript
class ResilientStreamer extends LogStreamer {
  constructor(baseUrl, token, maxRetries = 3) {
    super(baseUrl, token);
    this.maxRetries = maxRetries;
    this.retryCount = 0;
  }

  async streamLogs(env, options = {}) {
    try {
      await super.streamLogs(env, options);
      this.retryCount = 0; // Reset on success
    } catch (error) {
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(`Retrying connection (${this.retryCount}/${this.maxRetries})...`);

        // Exponential backoff
        const delay = Math.pow(2, this.retryCount) * 1000;
        setTimeout(() => this.streamLogs(env, options), delay);
      } else {
        console.error('Max retries exceeded');
      }
    }
  }
}
```

### Performance Optimization

- **Use appropriate polling intervals**: Balance between real-time needs and server load
- **Implement filtering**: Reduce data transfer by filtering on the server side
- **Batch processing**: Process multiple log entries together when possible
- **Connection pooling**: Reuse connections for multiple streaming sessions
- **Compression**: Enable gzip compression for large data transfers

## API Reference

### Endpoints

- `POST /call-stream` - Execute streaming tools via SSE
- `GET /health` - Server health check
- `GET /tools` - List available tools

### Authentication

All requests require Bearer token authentication:

```
Authorization: Bearer <client-secret>
```

### Response Codes

- `200` - Success, streaming begins
- `401` - Unauthorized (invalid token)
- `404` - Tool not found
- `400` - Invalid input parameters

### Rate Limiting

- Default: 100 requests per minute per client
- Streaming connections: 10 concurrent streams per client
- Burst limit: 20 requests per 10 seconds

## Best Practices

1. **Choose the right tool**: Use `logs.live` for production monitoring, `logs.stream` for development
2. **Implement proper error handling**: Always handle connection failures and parsing errors
3. **Use filtering**: Filter logs on the server side to reduce bandwidth and processing
4. **Monitor resource usage**: Watch memory usage and connection counts
5. **Implement reconnection logic**: Handle network interruptions gracefully
6. **Log your logging**: Keep track of your streaming client's performance
7. **Security**: Never expose streaming endpoints publicly without proper authentication

## Examples in the Repository

See the `examples/` directory for complete working examples:

- `examples/mcp-sse-client.js` - Node.js SSE client
- `examples/python-client.py` - Python client (REST API)
- `examples/mcp-client.js` - Basic MCP client

## Contributing

When contributing to the streaming functionality:

1. Test with both streaming tools
2. Verify SSE event parsing works correctly
3. Test error conditions and recovery
4. Update client examples as needed
5. Document any new features or parameters</content>
<parameter name="path">docs/SSE_GUIDE.md
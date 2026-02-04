// Minimal SSE utilities: framing and heartbeat
import { DEBUG, debugLog } from './config.js';

export const HEARTBEAT_INTERVAL_MS = 15000; // 15s

export function sseHandler(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive'
  });
  // initial comment to establish stream
  res.write(': connected\n\n');
  DEBUG && debugLog('SSE connection established');

  // heartbeat
  const interval = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
      DEBUG && debugLog('SSE heartbeat');
    } catch (e) {
      // ignore
    }
  }, HEARTBEAT_INTERVAL_MS);

  req.on('close', () => {
    clearInterval(interval);
    DEBUG && debugLog('SSE connection cleaned up');
  });
}

export function writeSSE(res, { event, data }) {
  // data is a string; escape newlines per SSE spec by sending multiple data: lines
  if (event) res.write(`event: ${event}\n`);
  if (data == null) data = '';
  const lines = String(data).split('\n');
  for (const line of lines) {
    res.write(`data: ${line}\n`);
  }
  res.write('\n');
}

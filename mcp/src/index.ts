#!/usr/bin/env node

import { McpServer } from './server/mcpServer';

async function bootstrap() {
  console.log('Starting platformOS MCP Server...');
  const server = new McpServer();
  await server.listen();

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('Shutting down gracefully...');
    process.exit(0);
  });
}

bootstrap().catch(console.error);
#!/usr/bin/env node
/**
 * MCP Client Example - Node.js
 * Demonstrates connecting to MCP server and calling tools
 */

const fetch = require('node-fetch'); // npm i node-fetch

async function main() {
  const BASE_URL = 'http://localhost:3030';
  const TOKEN = 'client-secret'; // from clients.json

  console.log('🤖 MCP Client Example\\n');

  // 1. List tools
  console.log('1. Listing tools...');
  const toolsRes = await fetch(`${BASE_URL}/tools`, {
    headers: { 'Authorization': `Bearer ${TOKEN}` }
  });
  const tools = await toolsRes.json();
  console.log(`Available: ${tools.tools.length} tools`);
  console.log(tools.tools.map(t => `  • ${t.name}`).join('\\n'));

  // 2. List environments
  console.log('\\n2. Listing environments...');
  const envRes = await fetch(`${BASE_URL}/call`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      tool: 'platformos.env.list',
      input: {}
    })
  });
  const envData = await envRes.json();
  const envs = JSON.parse(envData.content[0].text);
  console.log('Envs:', envs.envs?.map(e => e.name).join(', ') || 'None');

  // 3. GraphQL example (if staging env exists)
  if (envs.envs?.some(e => e.name === 'staging')) {
    console.log('\\n3. GraphQL query...');
    const gqlRes = await fetch(`${BASE_URL}/call`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tool: 'platformos.graphql.execute',
        input: {
          env: 'staging',
          query: `
            query {
              __schema {
                types {
                  name
                }
              }
            }
          `
        }
      })
    });
    const gqlData = await gqlRes.json();
    console.log('GraphQL:', JSON.parse(gqlData.content[0].text));
  }

  console.log('\\n✅ Demo complete! Check server logs.');
}

main().catch(console.error);
","path":"examples/mcp-client.js
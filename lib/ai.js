import fs from 'fs';
import path from 'path';
import logger from './logger.js';

const SERVERS = {
  platformos: { command: 'pos-cli-mcp' },
  'platformos-supervisor': { command: 'pos-cli-supervisor' }
};

const TOOLS = {
  claude: { label: 'Claude Code', file: '.mcp.json', key: 'mcpServers', entry: (server) => ({ ...server }) },
  cursor: { label: 'Cursor', file: '.cursor/mcp.json', key: 'mcpServers', entry: (server) => ({ ...server }) },
  vscode: { label: 'VS Code', file: '.vscode/mcp.json', key: 'servers', entry: (server) => ({ type: 'stdio', ...server }) },
  other: { label: 'Other' }
};

const promptForTool = async () => {
  const { select } = await import('@inquirer/prompts');
  try {
    return await select({
      message: 'Which AI tool do you use?',
      choices: Object.entries(TOOLS).map(([value, tool]) => ({ name: tool.label, value }))
    });
  } catch (error) {
    if (error.name === 'ExitPromptError') {
      process.exit(0);
    }
    throw error;
  }
};

const printManualSnippet = async () => {
  await logger.Info('Add these stdio MCP servers to your AI tool configuration:', { hideTimestamp: true });
  await logger.Log(JSON.stringify({ mcpServers: SERVERS }, null, 2));
};

const configureTool = async (toolId, rootPath) => {
  const tool = TOOLS[toolId];
  const configPath = path.join(rootPath, ...tool.file.split('/'));

  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (error) {
      return logger.Error(
        `${tool.file} exists but is not valid JSON: ${error.message}\n` +
          'Fix or remove the file and run pos-cli ai init again.'
      );
    }
  }

  const servers = (config[tool.key] = config[tool.key] || {});
  const added = [];
  const updated = [];

  for (const [name, server] of Object.entries(SERVERS)) {
    const desired = tool.entry(server);
    if (JSON.stringify(servers[name]) === JSON.stringify(desired)) continue;
    (servers[name] ? updated : added).push(name);
    servers[name] = desired;
  }

  if (added.length === 0 && updated.length === 0) {
    return logger.Success(`${tool.label} is already configured in ${tool.file} - nothing to do.`);
  }

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

  if (updated.length > 0) {
    await logger.Info(`Updated existing entries in ${tool.file}: ${updated.join(', ')}`);
  }
  await logger.Success(`Registered MCP servers (${Object.keys(SERVERS).join(', ')}) for ${tool.label} in ${tool.file}`);
};

const init = async ({ tool, rootPath = process.cwd() } = {}) => {
  const toolId = tool || (await promptForTool());
  if (toolId === 'other') return printManualSnippet();
  return configureTool(toolId, rootPath);
};

export { init, SERVERS, TOOLS };

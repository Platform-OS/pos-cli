import { config } from '../config';
import { FsStorage } from '../storage/fsStorage';
import { AuthManager } from '../authManager';
import express from 'express';
import { allTools, type Tool } from '../tools';

export class McpServer {
  private storage: FsStorage;
  private auth: AuthManager;
  private app: express.Express;
  private tools: Tool[];

  constructor() {
    this.storage = new FsStorage(config.cwd);
    this.auth = new AuthManager(this.storage);
    this.tools = allTools;
    this.app = express();
    this.app.use(express.json());
    this.setupRoutes();
  }

  private setupRoutes() {
    // Health check with ADMIN_API_KEY
    this.app.get('/health', (req, res) => {
      const apiKey = String(req.headers['x-api-key']) || String(req.query.apiKey);
      if (this.auth.validateAdmin(apiKey)) {
        res.json({ 
          status: 'ok', 
          tools: this.tools.map(t => t.name),
          toolCount: this.tools.length 
        });
      } else {
        res.status(401).json({ error: 'Unauthorized' });
      }
    });

    // MCP Tools list (requires MCP client token)
    this.app.get('/tools', (req, res) => {
      const token = String(req.headers.authorization?.replace('Bearer ', ''));
      const client = token ? this.auth.validateMcpClient(token) : null;
      if (client) {
        res.json({ 
          tools: this.tools.map(t => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema._def.schema // Approximate JSON schema
          })) 
        });
      } else {
        res.status(401).json({ error: 'Unauthorized' });
      }
    });

    // MCP Tool call execution
    this.app.post('/call', async (req, res) => {
      const token = String(req.headers.authorization?.replace('Bearer ', ''));
      const client = token ? this.auth.validateMcpClient(token) : null;
      if (!client) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { tool: toolName, input } = req.body;
      
      const tool = this.tools.find(t => t.name === toolName);
      if (!tool) {
        return res.status(404).json({ error: `Tool '${toolName}' not found` });
      }

      try {
        const validatedInput = tool.inputSchema.parse(input);
        const result = await tool.handler(validatedInput);
        res.json({ 
          content: [{ 
            type: 'text', 
            text: JSON.stringify(result, null, 2) 
          }] 
        });
      } catch (error) {
        console.error('Tool execution error:', error);
        res.status(400).json({ error: (error as Error).message });
      }
    });
  }

  async listen() {
    return new Promise<void>((resolve) => {
      this.app.listen(config.adminPort, () => {
        console.log(`MCP Admin server running on http://localhost:${config.adminPort}`);
        console.log(`Health: curl http://localhost:${config.adminPort}/health -H "x-api-key: $ADMIN_API_KEY"`);
        console.log(`Tools: curl http://localhost:${config.adminPort}/tools -H "Authorization: Bearer $CLIENT_SECRET"`);
        console.log(`Example call: curl -X POST http://localhost:${config.adminPort}/call \\`);
        console.log(`  -H "Authorization: Bearer $CLIENT_SECRET" \\`);
        console.log(`  -H "Content-Type: application/json" \\`);
        console.log(`  -d '{"tool":"platformos.env.list","input":{}}'`);
        resolve();
      });
    });
  }
}
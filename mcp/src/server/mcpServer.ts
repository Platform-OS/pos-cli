import express from 'express';

import { FsStorage } from '../storage/fsStorage';
import { AuthManager } from '../authManager';
import cors from 'cors';
import helmet from 'helmet';

import { allTools, type Tool } from '../tools';
import { config } from '../config';

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
    this.app.use(helmet());
    this.app.use(cors({
      origin: '*',
    }));
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
            description: t.description
            // inputSchema omitted for POC (add zod-to-json-schema later)
          })) 
        });
      } else {
        res.status(401).json({ error: 'Unauthorized' });
      }
    });

    // MCP Tool call execution (/call)
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

    // MCP Tool call stream SSE (/call-stream)
    this.app.post('/call-stream', async (req, res) => {
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

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });
        res.flushHeaders?.();

        const rawResult = await tool.handler(validatedInput);

        if (rawResult && typeof (rawResult as any)[Symbol.asyncIterator] === 'function') {
          // streaming
          (async () => {
            try {
              for await (const chunk of rawResult as any) {
                if (res.writableEnded) break;
                const part = { type: 'text', text: String(chunk) };
                res.write(`data: ${JSON.stringify(part)}\n\n`);
              }
            } catch (streamError) {
              console.error('Stream error:', streamError);
            } finally {
              if (!res.writableEnded) {
                res.write('data: [DONE]\n\n');
                res.end();
              }
            }
          })();
        } else {
          // sync
          const text = JSON.stringify(rawResult ?? null, null, 2);
          res.write(`data: ${JSON.stringify({type: 'text', text})}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        }
      } catch (error) {
        console.error('Tool execution error:', error);
        if (!res.headersSent) {
          res.status(400).json({ error: (error as Error).message });
        } else {
          res.write(`data: ${JSON.stringify({type: 'error', text: (error as Error).message})}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        }
      }
    });



  }

  public async listen() {
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
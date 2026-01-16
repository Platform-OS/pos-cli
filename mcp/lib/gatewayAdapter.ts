import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  data?: any;
}

export class PosCliGatewayAdapter {
  private binDir: string;

  constructor(cwd: string = process.cwd()) {
    this.binDir = path.join(cwd, '../../pos-cli/bin');
  }

  async exec(command: string, args: string[] = [], options: any = {}): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      const cmdPath = path.join(this.binDir, `pos-cli-${command}.js`);
      if (!fs.existsSync(cmdPath)) {
        return reject(new Error(`Command not found: ${command}`));
      }

      const proc = spawn('node', [cmdPath, ...args], {
        cwd: options.cwd || this.binDir,
        stdio: 'pipe',
        shell: true,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => { stdout += data; });
      proc.stderr.on('data', (data) => { stderr += data; });

      proc.on('close', (code) => {
        const result: CommandResult = {
          success: code === 0,
          stdout,
          stderr,
        };
        if (result.success && stdout.trim()) {
          try {
            result.data = JSON.parse(stdout);
          } catch {
            result.data = stdout.trim();
          }
        }
        resolve(result);
      });

      proc.on('error', reject);
    });
  }
}
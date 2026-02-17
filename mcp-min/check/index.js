// platformos.check - run platformos-check linter on the app
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const checkTool = {
  description: 'Run the platformos-check linter to analyze the app for best practice violations, errors, and style issues in Liquid and JSON files. Returns structured results (JSON by default). Supports category filtering, auto-correct, and custom config. Requires the platformos-check gem installed.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      appPath: {
        type: 'string',
        description: 'Path to the platformOS app (default: current directory)'
      },
      format: {
        type: 'string',
        enum: ['text', 'json'],
        description: 'Output format (default: json)',
        default: 'json'
      },
      category: {
        type: 'array',
        items: { type: 'string' },
        description: 'Only run checks matching these categories (can specify multiple)'
      },
      excludeCategory: {
        type: 'array',
        items: { type: 'string' },
        description: 'Exclude checks matching these categories (can specify multiple)'
      },
      autoCorrect: {
        type: 'boolean',
        description: 'Automatically fix offenses',
        default: false
      },
      failLevel: {
        type: 'string',
        enum: ['error', 'suggestion', 'style'],
        description: 'Minimum severity level to fail with error code'
      },
      config: {
        type: 'string',
        description: 'Path to custom .platformos-check.yml config file'
      },
      list: {
        type: 'boolean',
        description: 'List enabled checks without running them',
        default: false
      },
      print: {
        type: 'boolean',
        description: 'Print active config to STDOUT',
        default: false
      }
    }
  },
  handler: async (params = {}) => {
    const startedAt = new Date().toISOString();

    // Extract parameters used in both try and catch blocks
    const appPath = params.appPath || '.';
    const format = params.format || 'json';
    const autoCorrect = !!params.autoCorrect;
    const listChecks = !!params.list;
    const printConfig = !!params.print;

    try {

      // Build command
      let command = 'platformos-check';

      // Add options
      if (listChecks) {
        command += ' --list';
      } else if (printConfig) {
        command += ' --print';
      } else {
        // Only add format for normal checks
        command += ` --output ${format}`;

        if (autoCorrect) {
          command += ' --auto-correct';
        }

        if (params.failLevel) {
          command += ` --fail-level ${params.failLevel}`;
        }

        // Add categories
        if (params.category && Array.isArray(params.category)) {
          for (const cat of params.category) {
            command += ` --category ${cat}`;
          }
        }

        if (params.excludeCategory && Array.isArray(params.excludeCategory)) {
          for (const cat of params.excludeCategory) {
            command += ` --exclude-category ${cat}`;
          }
        }

        if (params.config) {
          command += ` --config ${params.config}`;
        }
      }

      // Add app path
      command += ` "${appPath}"`;

      const { stdout, stderr } = await execAsync(command, { maxBuffer: 10 * 1024 * 1024 });

      // Parse output
      let result = stdout;
      if (format === 'json' && !listChecks && !printConfig) {
        try {
          result = JSON.parse(stdout);
        } catch {
          // If JSON parse fails, return as raw string
          result = { raw: stdout };
        }
      }

      return {
        ok: true,
        data: {
          result,
          format,
          appPath,
          listChecks,
          printConfig,
          autoCorrect: autoCorrect
        },
        meta: {
          startedAt,
          finishedAt: new Date().toISOString(),
          stderr: stderr ? stderr.trim() : undefined
        }
      };
    } catch (error) {
      // platformos-check returns non-zero exit code when issues found or no files
      // We still want to return the output as successful (with flags for context)
      const output = error.stdout || error.stderr || '';
      const noFilesFound = output.includes('No platformos_app files found');

      // Treat as successful if it's a known linter condition (not a real error)
      if (noFilesFound || error.stdout) {
        let result = error.stdout || error.stderr;

        if (format === 'json' && result && !noFilesFound) {
          try {
            result = JSON.parse(result);
          } catch {
            result = { raw: result };
          }
        }

        return {
          ok: true,
          data: {
            result: result || 'No platformos_app files found',
            format,
            appPath,
            issues_found: !noFilesFound,
            no_files_found: noFilesFound,
            autoCorrect: autoCorrect,
            exit_code: error.code
          },
          meta: {
            startedAt,
            finishedAt: new Date().toISOString(),
            stderr: error.stderr ? error.stderr.trim() : undefined
          }
        };
      }

      // Actual error (not linter findings)
      return {
        ok: false,
        error: {
          code: 'CHECK_ERROR',
          message: error.message || String(error),
          stderr: error.stderr,
          exit_code: error.code
        }
      };
    }
  }
};

export default checkTool;

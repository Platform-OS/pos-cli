// platformos.check-run - run platformos-check Node.js linter (no Ruby required)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import normalize from 'normalize-path';

const Severity = {
  ERROR: 0,
  WARNING: 1,
  INFO: 2
};

const severityToLabel = (severity) => {
  switch (severity) {
    case Severity.ERROR: return 'error';
    case Severity.WARNING: return 'warning';
    case Severity.INFO: return 'info';
    default: return 'unknown';
  }
};

const uriToPath = (uri) => {
  try {
    return fileURLToPath(uri);
  } catch {
    return uri.replace('file://', '');
  }
};

const countBySeverity = (offenses) => {
  return offenses.reduce((counts, offense) => {
    switch (offense.severity) {
      case Severity.ERROR: counts.errors++; break;
      case Severity.WARNING: counts.warnings++; break;
      case Severity.INFO: counts.info++; break;
    }
    return counts;
  }, { errors: 0, warnings: 0, info: 0 });
};

const checkRunTool = {
  description: 'Run platformos-check Node.js linter on the app. Analyzes Liquid/JSON files for violations. No Ruby required. Returns structured JSON with offenses grouped by file.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      appPath: {
        type: 'string',
        description: 'Path to the platformOS app directory to check (default: current directory)'
      },
      autoFix: {
        type: 'boolean',
        description: 'Automatically fix offenses, then re-check and return remaining issues',
        default: false
      }
    }
  },
  handler: async (params = {}) => {
    const startedAt = new Date().toISOString();
    const appPath = params.appPath || '.';
    const autoFix = !!params.autoFix;

    // Validate path exists
    if (!fs.existsSync(appPath)) {
      return {
        ok: false,
        error: {
          code: 'PATH_NOT_FOUND',
          message: `Path does not exist: ${appPath}`
        }
      };
    }

    // Validate path is a directory
    const stats = fs.statSync(appPath);
    if (!stats.isDirectory()) {
      return {
        ok: false,
        error: {
          code: 'NOT_A_DIRECTORY',
          message: `Path is not a directory: ${appPath}`
        }
      };
    }

    // Dynamically import @platformos/platformos-check-node
    let platformosCheck;
    try {
      platformosCheck = await import('@platformos/platformos-check-node');
    } catch {
      return {
        ok: false,
        error: {
          code: 'MISSING_DEPENDENCY',
          message: 'The @platformos/platformos-check-node package is not installed. Install it with: npm install @platformos/platformos-check-node'
        }
      };
    }

    try {
      const checkPath = path.resolve(appPath);

      // Resolve .platformos-check.yml explicitly — upstream findConfigPath
      // only discovers .theme-check.yml
      const configFile = path.join(checkPath, '.platformos-check.yml');
      const configPath = fs.existsSync(configFile) ? configFile : undefined;

      // Run checks
      const result = await platformosCheck.appCheckRun(checkPath, configPath);
      let offenses = result.offenses;
      // `size`, not `length`: `App` is not an array, so `.length` was `undefined` and this
      // field reached every MCP client as `undefined` rather than a count. Pre-existing, and
      // already failing `check-run.test.js`'s "includes timing metadata" assertion.
      const filesChecked = result.app ? result.app.size : 0;

      // Auto-fix if requested.
      //
      // Gated on the offenses autofix will actually WRITE — the same predicate it filters
      // on internally — not on how many were reported. Most findings are suggest-only, so
      // `offenses.length > 0` bought a second whole-project lint that reproduced an
      // identical list (3.1 s of a 14.5 s run on a real 1509-file project with 454
      // offenses, none of them fixable) and reported `autoFixed: true` for a pass that
      // wrote nothing.
      //
      // The re-lint stays WHOLE-PROJECT rather than narrowed to the files that changed: a
      // fix to a partial's `{% doc %}` params changes that partial's contract, so it can
      // resolve a caller's offense in a file autofix never wrote. It is also what keeps
      // positions honest, since every offense after a fix in the same file shifts.
      const fixable = autoFix ? offenses.filter((o) => 'fix' in o && !!o.fix) : [];
      let autoFixed = false;
      if (fixable.length > 0) {
        await platformosCheck.autofix(result.app, offenses);
        autoFixed = true;

        // Re-run check after autofix
        const recheck = await platformosCheck.appCheckRun(checkPath, configPath);
        offenses = recheck.offenses;
      }

      // Group offenses by file
      const grouped = {};
      for (const offense of offenses) {
        const absolutePath = uriToPath(offense.uri);
        const filePath = normalize(path.relative(checkPath, absolutePath));
        if (!grouped[filePath]) {
          grouped[filePath] = [];
        }
        grouped[filePath].push(offense);
      }

      // Build per-file results
      const files = Object.entries(grouped).map(([filePath, fileOffenses]) => {
        const counts = countBySeverity(fileOffenses);
        return {
          path: filePath,
          offenses: fileOffenses.map(offense => ({
            check: offense.check,
            severity: severityToLabel(offense.severity),
            start_row: offense.start.line,
            start_column: offense.start.character,
            end_row: offense.end.line,
            end_column: offense.end.character,
            message: offense.message
          })),
          errorCount: counts.errors,
          warningCount: counts.warnings,
          infoCount: counts.info
        };
      });

      const totalCounts = countBySeverity(offenses);

      return {
        ok: true,
        data: {
          offenseCount: offenses.length,
          fileCount: Object.keys(grouped).length,
          errorCount: totalCounts.errors,
          warningCount: totalCounts.warnings,
          infoCount: totalCounts.info,
          filesChecked,
          autoFixed,
          files
        },
        meta: {
          startedAt,
          finishedAt: new Date().toISOString(),
          appPath: checkPath
        }
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'CHECK_RUN_ERROR',
          message: error.message || String(error)
        }
      };
    }
  }
};

export default checkRunTool;

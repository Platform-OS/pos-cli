// platformos.check-run - run the platformos-check linter over the app
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import normalize from 'normalize-path';
import { ToolError } from '../tool-error.js';

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

/**
 * The linter's refusal to check a directory that is not a project root — addressed to whoever
 * typed the path, not a crash. It reaches `classify` as an ordinary `Error`, which reads it as
 * `internal`, "a defect in pos-cli": an evaluation passed `appPath: "app"`, was told to report a
 * bug, and the argument was simply wrong.
 *
 * Matched on the `code` the package exports for the purpose rather than with `instanceof`: pos-cli
 * resolves `@platformos/platformos-check-node` independently, and `instanceof` against a copy that
 * does not export the class throws in place of the error being tested. Written out rather than
 * imported, because an older copy exporting no constant would leave the comparison
 * `err.code === undefined` and catch every error that carries no code at all. `check-run.test.js`
 * pins the literal against the installed package, so a rename upstream fails there instead of
 * quietly going back to blaming pos-cli.
 */
const PROJECT_ROOT_REFUSAL = 'PLATFORMOS_PROJECT_ROOT';

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
  description: 'Lint the Liquid and JSON files in the project. Local only: no instance is involved. Returns a check code per offence rather than a pass or fail verdict, and a clean run is not a promise that a deploy will succeed.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      appPath: {
        type: 'string',
        description: 'Project root to lint, not a subdirectory.',
        default: '.'
      },
      autoFix: {
        type: 'boolean',
        description: 'Fix what can be fixed, then report what is left. fixable says how much that was, in either mode.',
        default: false
      }
    }
  },
  handler: async (params = {}) => {
    const appPath = params.appPath || '.';
    const autoFix = !!params.autoFix;

    if (!fs.existsSync(appPath)) {
      throw ToolError.not_found('PATH_NOT_FOUND', `Path does not exist: ${appPath}`, { appPath });
    }

    if (!fs.statSync(appPath).isDirectory()) {
      throw ToolError.input('NOT_A_DIRECTORY', `Path is not a directory: ${appPath}`, { appPath });
    }

    let platformosCheck;
    try {
      platformosCheck = await import('@platformos/platformos-check-node');
    } catch (e) {
      // pos-cli declares this package, so a load failure means the installation is broken rather
      // than that the caller has something to install.
      throw ToolError.project('MISSING_DEPENDENCY', `The linter (@platformos/platformos-check-node) could not be loaded: ${String(e?.message || e)}`);
    }

    const checkPath = path.resolve(appPath);

    // Resolve .platformos-check.yml explicitly — upstream findConfigPath
    // only discovers .theme-check.yml
    const configFile = path.join(checkPath, '.platformos-check.yml');
    const configPath = fs.existsSync(configFile) ? configFile : undefined;

    // Run checks
    let result;
    try {
      result = await platformosCheck.appCheckRun(checkPath, configPath);
    } catch (e) {
      if (e?.code !== PROJECT_ROOT_REFUSAL) throw e;
      // The linter's own message names the path it was given and the root it found, and is written
      // for whoever typed one — so it is forwarded whole rather than replaced.
      throw ToolError.input('NOT_A_PROJECT_ROOT', e.message, { appPath });
    }
    let offenses = result.offenses;
    // `app` is an App model, whose file count is its `size` getter. It was an array of source
    // files before platformos-check-node 1.0.0, so `.length` here silently became undefined.
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
    const fixableIn = (list) => list.filter((o) => 'fix' in o && !!o.fix);
    const relativeTo = (uri) => normalize(path.relative(checkPath, uriToPath(uri)));

    // Computed whether or not fixing was asked for. It used to be gated on `autoFix`, which is
    // fine while it only decides whether to run the pass and wrong the moment it is reported: a
    // lint that was never asked to fix anything would have answered "nothing here is fixable".
    const toFix = fixableIn(offenses);
    let fixedFiles = [];
    if (autoFix && toFix.length > 0) {
      await platformosCheck.autofix(result.app, offenses);
      // The files autofix wrote: `toFix` is filtered on the same predicate it applies internally,
      // so these are its writes rather than a guess at them.
      fixedFiles = [...new Set(toFix.map(offense => relativeTo(offense.uri)))].sort();

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
      offenseCount: offenses.length,
      // Named for what it counts: as `fileCount` beside `filesChecked`, a clean run answered
      // `fileCount: 0, filesChecked: 2`, which reads as "nothing was checked".
      filesWithOffenses: Object.keys(grouped).length,
      errorCount: totalCounts.errors,
      warningCount: totalCounts.warnings,
      infoCount: totalCounts.info,
      filesChecked,
      /**
       * The three questions a caller had no way to answer. `autoFixed: false` alone could mean
       * "nothing here is auto-fixable" or "the pass did not run", and an agent had to diff its own
       * working tree to find out which — on the one tool here that writes to disk.
       *
       * `fixable` is how many of the offenses above could be written automatically: before a fix
       * pass it is the offer, after one it is what the pass could not apply. `fixedFiles` names
       * what was written, and is absent when nothing was.
       */
      autoFixed: fixedFiles.length > 0,
      fixable: fixableIn(offenses).length,
      ...(fixedFiles.length > 0 && { fixedFiles }),
      files,
      // Which directory was actually linted, resolved: it used to sit in the tool's own meta,
      // which runTool now owns, and a caller that passed a relative path still wants to know.
      appPath: checkPath
    };
  }
};

export default checkRunTool;

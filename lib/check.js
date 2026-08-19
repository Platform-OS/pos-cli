import fs from 'fs';
import path from 'path';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'url';
import logger from './logger.js';
import chalk from 'chalk';
import YAML from 'yaml';
import ora from './ora.js';
import { MISSING_PACKAGE_MESSAGE } from './check-messages.js';

// Severity levels from platformos-check-node
const Severity = {
  ERROR: 0,
  WARNING: 1,
  INFO: 2
};

const loadPlatformosCheck = async () => {
  try {
    const platformosCheck = await import('@platformos/platformos-check-node');
    return platformosCheck;
  } catch {
    await logger.Error(MISSING_PACKAGE_MESSAGE);
  }
};

const validatePath = async (checkPath) => {
  if (!fs.existsSync(checkPath)) {
    await logger.Error(`Path does not exist: ${checkPath}`);
    return;
  }

  const stats = fs.statSync(checkPath);
  if (!stats.isDirectory()) {
    await logger.Error(`Path is not a directory: ${checkPath}`);
  }
};

/**
 * Convert file:// URI to filesystem path
 */
const uriToPath = (uri) => {
  try {
    return fileURLToPath(uri);
  } catch {
    // Fallback for non-standard URIs
    return uri.replace('file://', '');
  }
};

/**
 * Get severity label
 */
const severityToLabel = (severity) => {
  switch (severity) {
    case Severity.ERROR:
      return 'error';
    case Severity.WARNING:
      return 'warning';
    case Severity.INFO:
      return 'info';
    default:
      return 'unknown';
  }
};

/**
 * Get code snippet from file (lines are 0-indexed from platformos-check)
 */
const getSnippet = (uri, startLine, endLine) => {
  try {
    const fsPath = uriToPath(uri);
    const fileContent = fs.readFileSync(fsPath, 'utf8');
    const lines = fileContent.split('\n');
    const snippetLines = lines.slice(startLine, endLine + 1);

    return snippetLines
      .map((line, index) => {
        const lineNumber = startLine + index + 1;
        const paddedLineNum = String(lineNumber).padStart(4, ' ');
        return `${paddedLineNum}  ${line}`;
      })
      .join('\n');
  } catch {
    return '';
  }
};

/**
 * Format a single offense with code snippet
 */
const formatOffense = (offense, basePath = null) => {
  let absolutePath = uriToPath(offense.uri);
  // Normalize path separators and resolve to absolute path
  absolutePath = path.normalize(absolutePath);

  let filePath = absolutePath;
  if (basePath) {
    const normalizedBase = path.normalize(path.resolve(basePath));
    filePath = path.relative(normalizedBase, absolutePath);
    // Convert backslashes to forward slashes for consistent output
    filePath = filePath.split(path.sep).join('/');
  }

  const severityLabel = severityToLabel(offense.severity);
  const location = `${filePath}:${offense.start.line + 1}:${offense.start.character}`;
  const snippet = getSnippet(offense.uri, offense.start.line, offense.end.line);

  return {
    location,
    message: offense.message,
    check: offense.check,
    severity: severityLabel,
    snippet,
    file: filePath
  };
};

/**
 * Sort offenses by severity (ERROR < WARNING < INFO)
 */
const sortBySeverity = (a, b) => a.severity - b.severity;

/**
 * Group and sort offenses by file, then by severity
 */
const groupOffensesByFile = (offenses, basePath = null) => {
  const grouped = {};

  offenses.forEach(offense => {
    let absolutePath = uriToPath(offense.uri);
    // Normalize path separators and resolve to absolute path
    absolutePath = path.normalize(absolutePath);

    let filePath = absolutePath;
    if (basePath) {
      const normalizedBase = path.normalize(path.resolve(basePath));
      filePath = path.relative(normalizedBase, absolutePath);
      // Convert backslashes to forward slashes for consistent output
      filePath = filePath.split(path.sep).join('/');
    }

    if (!grouped[filePath]) {
      grouped[filePath] = [];
    }
    grouped[filePath].push(offense);
  });

  // Sort offenses within each file by severity
  Object.keys(grouped).forEach(file => {
    grouped[file].sort(sortBySeverity);
  });

  return grouped;
};

/**
 * Count offenses by severity
 */
const countOffensesBySeverity = (offenses) => {
  return offenses.reduce((counts, offense) => {
    switch (offense.severity) {
      case Severity.ERROR:
        counts.errors++;
        break;
      case Severity.WARNING:
        counts.warnings++;
        break;
      case Severity.INFO:
        counts.info++;
        break;
    }
    return counts;
  }, { errors: 0, warnings: 0, info: 0 });
};

/**
 * Format and display offenses in text format
 */
const printTextOutput = async (
  offenses,
  silent,
  basePath = null,
  filesChecked = null,
  sourceExtensions = null,
  sourceLocations = null
) => {
  if (offenses.length === 0) {
    if (!silent) {
      // "Nothing was wrong" and "nothing was looked at" must not print the same sentence. The
      // count is stated on every clean run so a reader can always tell the difference.
      if (filesChecked === 0) {
        // States WHERE it looked, not WHY it found nothing: an empty project, unrecognised file
        // types, sources outside the walked subtrees and config exclusions all land here.
        const locations = (sourceLocations ?? []).map((location) => `${location}/`).join(', ');
        const extensions = (sourceExtensions ?? []).join(', ');
        // stdout, like the "No offenses found." line it replaces: this IS the run's result and the
        // exit code is 0, so a caller capturing stdout must see it. On stderr (logger.Warn) a CI
        // job would read an empty stdout and a zero exit, and infer a clean run — the very
        // false-clean this is here to prevent.
        await logger.Info(
          `Nothing was checked: no source files found${basePath ? ` in ${basePath}` : ''}.` +
            (locations && extensions
              ? `\nSources are ${extensions} files under ${locations} — minus anything .platformos-check.yml ignores.`
              : '')
        );
      } else if (typeof filesChecked === 'number') {
        await logger.Success(`Checked ${filesChecked} file${filesChecked === 1 ? '' : 's'}. No offenses found.`);
      } else {
        await logger.Success('No offenses found.');
      }
    }
    return;
  }

  const grouped = groupOffensesByFile(offenses, basePath);
  const fileCount = Object.keys(grouped).length;
  const counts = countOffensesBySeverity(offenses);

  // Print offenses grouped by file
  await logger.Log('');
  const sortedFiles = Object.keys(grouped).sort();
  for (const file of sortedFiles) {
    await logger.Log(chalk.bold.cyan(file));
    await logger.Log('');

    for (const offense of grouped[file]) {
      const formatted = formatOffense(offense, basePath);

      // Print severity icon and check name
      let severityIcon, checkName;
      switch (offense.severity) {
        case Severity.ERROR:
          severityIcon = chalk.red.bold('✖');
          checkName = chalk.red.bold(formatted.check);
          break;
        case Severity.WARNING:
          severityIcon = chalk.yellow.bold('⚠');
          checkName = chalk.yellow.bold(formatted.check);
          break;
        case Severity.INFO:
          severityIcon = chalk.cyan.bold('ℹ');
          checkName = chalk.cyan.bold(formatted.check);
          break;
      }

      await logger.Log(`${severityIcon}  ${checkName}`);
      await logger.Log(chalk.gray(`  ${formatted.message}`));

      // Print code snippet if available
      if (formatted.snippet) {
        await logger.Log('');
        await logger.Log(chalk.gray(formatted.snippet));
      }

      await logger.Log('');
    }
  }

  // Print summary at the end
  await logger.Log(chalk.gray('─'.repeat(60)));
  await logger.Log('');

  // Summary header
  const totalOffenses = offenses.length;
  const summaryHeader = `${totalOffenses} offense${totalOffenses === 1 ? '' : 's'} found in ${fileCount} file${fileCount === 1 ? '' : 's'}`;

  await logger.Log(chalk.bold.white(summaryHeader));
  await logger.Log('');

  // Count badges
  const badges = [];
  if (counts.errors > 0) {
    badges.push(chalk.red(`✖ ${counts.errors} error${counts.errors === 1 ? '' : 's'}`));
  }
  if (counts.warnings > 0) {
    badges.push(chalk.yellow(`⚠ ${counts.warnings} warning${counts.warnings === 1 ? '' : 's'}`));
  }
  if (counts.info > 0) {
    badges.push(chalk.cyan(`ℹ ${counts.info} info`));
  }

  await logger.Log('  ' + badges.join('  '));
  await logger.Log('');
};

/**
 * Format offenses as JSON
 */
const printJsonOutput = async (offenses, basePath = null, filesChecked = null) => {
  const grouped = groupOffensesByFile(offenses, basePath);

  const result = Object.entries(grouped).map(([filePath, fileOffenses]) => {
    const counts = countOffensesBySeverity(fileOffenses);

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

  const totalCounts = countOffensesBySeverity(offenses);

  const output = {
    offenseCount: offenses.length,
    // Files that HAVE an offense — not how many were examined; see filesChecked.
    fileCount: Object.keys(grouped).length,
    filesChecked,
    errorCount: totalCounts.errors,
    warningCount: totalCounts.warnings,
    infoCount: totalCounts.info,
    files: result
  };

  await logger.Log(JSON.stringify(output, null, 2));
};

/**
 * Add '#' character at the start of each line in a string
 */
const commentString = (input) => {
  return input
    .split('\n')
    .map(line => `# ${line}`)
    .join('\n');
};

/**
 * Initialize .platformos-check.yml configuration file
 */
const initConfig = async (rootPath) => {
  const configFileName = '.platformos-check.yml';
  const configFilePath = path.join(rootPath, configFileName);

  // Check if config file already exists
  if (fs.existsSync(configFilePath)) {
    await logger.Info(`${configFileName} already exists at ${rootPath}`);
    return;
  }

  const platformosCheck = await loadPlatformosCheck();

  try {
    // Load default configuration
    const { settings } = await platformosCheck.loadConfig(undefined, rootPath);

    // Create the initial config that extends recommended settings
    const initConfig = {
      extends: 'platformos-check:recommended',
      ignore: ['node_modules/**']
    };

    const initConfigYml = YAML.stringify(initConfig);

    // Comment out all settings for user reference
    const settingsYml = commentString(YAML.stringify(settings));

    // Combine: base config + commented settings
    const finalConfig = `${initConfigYml}\n# Below are all available settings with their default values:\n${settingsYml}`;

    // Write config file
    fs.writeFileSync(configFilePath, finalConfig, 'utf8');

    await logger.Success(`Created ${configFileName} at ${rootPath}`);
  } catch (error) {
    await logger.Error(`Error creating config file: ${error.message}`);
  }
};

/**
 * Marks an error the user is meant to read as-is (an unknown check name, a missing
 * package) rather than a crash to be reported with a stack trace.
 */
class UserFacingError extends Error {}

/**
 * Runs the linter on a worker thread and resolves with its plain offenses.
 * See lib/check-worker.js for why the check is off the main thread.
 */
const runInWorker = ({ checkPath, autoFix, checks, onProgress }) =>
  new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./check-worker.js', import.meta.url), {
      workerData: { path: checkPath, autoFix, checks }
    });

    worker.on('message', (message) => {
      if (message.type === 'progress') onProgress(message.message);
      else if (message.type === 'result')
        resolve({
          offenses: message.offenses,
          filesChecked: message.filesChecked,
          sourceExtensions: message.sourceExtensions,
          sourceLocations: message.sourceLocations
        });
      else if (message.type === 'userError') reject(new UserFacingError(message.message));
    });
    worker.on('error', reject);
    // A worker that dies without posting anything (an OOM, say) would otherwise leave
    // this promise pending forever. Settled promises ignore a later rejection, so this
    // is a no-op on the normal path.
    worker.on('exit', (code) => reject(new Error(`Check worker stopped with exit code ${code}`)));
  });

const run = async (opts) => {
  const { path: checkPath, autoFix, checks, format, silent } = opts;

  await validatePath(checkPath);

  let offenses;
  let filesChecked;
  let sourceExtensions;
  let sourceLocations;
  let spinner;

  // Only show spinner for text output (not JSON)
  if (format !== 'json' && !silent) {
    spinner = ora({ text: 'Loading files...', stream: process.stdout });
    spinner.start();
  }

  try {
    ({ offenses, filesChecked, sourceExtensions, sourceLocations } = await runInWorker({
      checkPath,
      autoFix,
      checks,
      onProgress: (message) => {
        if (spinner) spinner.text = message;
      }
    }));

    if (spinner) {
      spinner.stop();
    }
  } catch (error) {
    if (error instanceof UserFacingError) {
      if (spinner) spinner.stop();
      await logger.Error(error.message);
      return;
    }

    if (spinner) {
      spinner.fail('Check failed');
    }
    await logger.Error(`Error running platformos-check: ${error.message}\n${error.stack}`);
    return;
  }

  if (format === 'json') {
    await printJsonOutput(offenses, checkPath, filesChecked);
  } else {
    await printTextOutput(offenses, silent, checkPath, filesChecked, sourceExtensions, sourceLocations);
  }

  if (offenses.length > 0) {
    process.exitCode = 1;
  }
};

export { run, initConfig };

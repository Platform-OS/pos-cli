import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';
import chalk from 'chalk';
import YAML from 'yaml';
import ora from 'ora';

// Severity levels from platformos-check-node
const Severity = {
  ERROR: 0,
  WARNING: 1,
  INFO: 2
};

const checkThemeCheck = async () => {
  try {
    const themeCheck = await import('@platformos/platformos-check-node');
    return themeCheck;
  } catch {
    await logger.Error(
      'The @platformos/platformos-check-node package is not installed.\n' +
      'Install it with: npm install @platformos/platformos-check-node'
    );
  }
};

const validatePath = async (checkPath) => {
  if (!fs.existsSync(checkPath)) {
    await logger.Error(`Path does not exist: ${checkPath}`);
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
const printTextOutput = async (offenses, silent, basePath = null) => {
  if (offenses.length === 0) {
    if (!silent) {
      await logger.Success('No offenses found.');
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
const printJsonOutput = async (offenses, basePath = null) => {
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
    fileCount: Object.keys(grouped).length,
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

  const themeCheck = await checkThemeCheck();

  try {
    // Load default configuration
    const { settings } = await themeCheck.loadConfig(undefined, rootPath);

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

const run = async (opts) => {
  const { path: checkPath, autoFix, format, silent } = opts;

  await validatePath(checkPath);

  const themeCheck = await checkThemeCheck();

  let offenses = [];
  let spinner;
  let theme;

  // Only show spinner for text output (not JSON)
  if (format !== 'json' && !silent) {
    spinner = ora({ text: 'Loading files...', stream: process.stdout });
    spinner.start();
  }

  try {
    // Run checks with progress callback
    let fileCount = 0;
    const result = await themeCheck.themeCheckRun(checkPath, undefined, (message) => {
      if (spinner && message) {
        spinner.text = message;
      }
    });

    offenses = result.offenses;
    theme = result.theme;
    fileCount = theme.length;

    // Update spinner with completion info if it's still running
    if (spinner && spinner.isSpinning) {
      spinner.text = `Checked ${fileCount} file${fileCount === 1 ? '' : 's'}`;
    }

    if (autoFix && offenses.length > 0) {
      if (spinner) {
        spinner.text = `Applying automatic fixes to ${offenses.length} offense${offenses.length === 1 ? '' : 's'}...`;
      }
      await themeCheck.autofix(theme, offenses);

      // Re-run check after autofix to get updated offenses
      if (spinner) {
        spinner.text = 'Re-checking after fixes...';
      }
      const recheck = await themeCheck.themeCheckRun(checkPath);
      offenses = recheck.offenses;
    }

    if (spinner) {
      spinner.stop();
    }
  } catch (error) {
    if (spinner) {
      spinner.fail('Check failed');
    }
    await logger.Error(`Error running platformos-check: ${error.message}`);
  }

  if (format === 'json') {
    await printJsonOutput(offenses, checkPath);
  } else {
    await printTextOutput(offenses, silent, checkPath);
  }

  if (offenses.length > 0) {
    process.exit(1);
  }
};

export { run, initConfig };

import 'dotenv/config';
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cliPath = path.join(process.cwd(), 'bin', 'pos-cli.js');

const execCommand = (cmd, opts = {}) => {
  return new Promise((resolve) => {
    const child = exec(cmd, { ...opts, stdio: ['pipe', 'pipe', 'pipe'] }, (err, stdout, stderr) => {
      let code = err ? err.code : 0;
      return resolve({ stdout, stderr, code });
    });

    if (opts.timeout) {
      setTimeout(() => {
        child.kill();
        resolve({ stdout: '', stderr: 'Test timed out', code: null });
      }, opts.timeout);
    }
  });
};

const run = (args, opts = {}) => {
  // Convert relative generator paths to absolute paths
  const absoluteArgs = args.replace(/(test\/fixtures\/yeoman\/modules\/core\/generators\/\w+)/g, (match) => {
    return path.resolve(__dirname, '..', match);
  });
  return execCommand(`${cliPath} generate run ${absoluteArgs}`, {
    ...opts,
    cwd: opts.cwd || process.cwd()
  });
};

const setupTestProject = async () => {
  const testDir = path.join(__dirname, 'fixtures', 'temp-generator-test');
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch (e) {
    // Ignore if directory doesn't exist
  }
  await fs.mkdir(testDir, { recursive: true });
  await fs.mkdir(path.join(testDir, 'app'), { recursive: true });
  return testDir;
};

const cleanupTestProject = async (testDir) => {
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch (e) {
    // Ignore if cleanup fails
  }
};

const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch (e) {
    return false;
  }
};

const readFile = async (filePath) => {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (e) {
    return null;
  }
};

describe('pos-cli generate command', () => {
  describe('crud generator', () => {
    let testDir;

    beforeEach(async () => {
      testDir = await setupTestProject();
    });

    afterEach(async () => {
      if (testDir) {
        await cleanupTestProject(testDir);
      }
    });

    test('requires modelName argument', async () => {
      const { stderr, code } = await run(
        'test/fixtures/yeoman/modules/core/generators/crud',
        { cwd: testDir, timeout: 5000 }
      );

      // Yeoman shows error but exits with code 0
      expect(stderr).toMatch(/Did not provide required argument|error|Error/i);
    });

    test('generates CRUD files for model with attributes', async () => {
      const { stdout, stderr, code } = await run(
        'test/fixtures/yeoman/modules/core/generators/crud product name:string price:integer description:text active:boolean',
        { cwd: testDir, timeout: 10000 }
      );

      expect(code).toBe(0);
      expect(stdout).toContain('CRUD generated');
      expect(stderr).not.toContain('Error');

      // Verify schema file
      const schemaPath = path.join(testDir, 'app', 'schema', 'product.yml');
      const schemaExists = await fileExists(schemaPath);
      expect(schemaExists).toBe(true);

      const schemaContent = await readFile(schemaPath);
      expect(schemaContent).toContain('name');
      expect(schemaContent).toContain('properties');

      // Verify GraphQL files
      const graphqlDir = path.join(testDir, 'app', 'graphql', 'products');
      const createGraphQL = path.join(graphqlDir, 'create.graphql');
      const updateGraphQL = path.join(graphqlDir, 'update.graphql');
      const deleteGraphQL = path.join(graphqlDir, 'delete.graphql');
      const searchGraphQL = path.join(graphqlDir, 'search.graphql');

      expect(await fileExists(createGraphQL)).toBe(true);
      expect(await fileExists(updateGraphQL)).toBe(true);
      expect(await fileExists(deleteGraphQL)).toBe(true);
      expect(await fileExists(searchGraphQL)).toBe(true);

      // Verify command files
      const commandsDir = path.join(testDir, 'app', 'lib', 'commands', 'products');
      const createCommand = path.join(commandsDir, 'create.liquid');
      const updateCommand = path.join(commandsDir, 'update.liquid');
      const deleteCommand = path.join(commandsDir, 'delete.liquid');

      expect(await fileExists(createCommand)).toBe(true);
      expect(await fileExists(updateCommand)).toBe(true);
      expect(await fileExists(deleteCommand)).toBe(true);

      // Verify query files
      const queriesDir = path.join(testDir, 'app', 'lib', 'queries', 'products');
      const searchQuery = path.join(queriesDir, 'search.liquid');
      const findQuery = path.join(queriesDir, 'find.liquid');

      expect(await fileExists(searchQuery)).toBe(true);
      expect(await fileExists(findQuery)).toBe(true);

      // Verify translations
      const translationsPath = path.join(testDir, 'app', 'translations', 'en', 'products.yml');
      expect(await fileExists(translationsPath)).toBe(true);
    });

    test('generates view files when --includeViews option is used', async () => {
      const { stdout, code } = await run(
        'test/fixtures/yeoman/modules/core/generators/crud article title:text --includeViews',
        { cwd: testDir, timeout: 10000 }
      );

      expect(code).toBe(0);
      expect(stdout).toContain('CRUD generated');

      // Verify pages
      const pagesDir = path.join(testDir, 'app', 'views', 'pages', 'articles');
      const indexPage = path.join(pagesDir, 'index.liquid');
      const showPage = path.join(pagesDir, 'show.liquid');
      const newPage = path.join(pagesDir, 'new.liquid');
      const editPage = path.join(pagesDir, 'edit.liquid');

      expect(await fileExists(indexPage)).toBe(true);
      expect(await fileExists(showPage)).toBe(true);
      expect(await fileExists(newPage)).toBe(true);
      expect(await fileExists(editPage)).toBe(true);

      // Verify partials
      const partialsDir = path.join(testDir, 'app', 'views', 'partials', 'theme', 'simple', 'articles');
      const indexPartial = path.join(partialsDir, 'index.liquid');
      const showPartial = path.join(partialsDir, 'show.liquid');
      const newPartial = path.join(partialsDir, 'new.liquid');
      const editPartial = path.join(partialsDir, 'edit.liquid');
      const emptyStatePartial = path.join(partialsDir, 'empty_state.liquid');
      const formPartial = path.join(partialsDir, 'form.liquid');

      expect(await fileExists(indexPartial)).toBe(true);
      expect(await fileExists(showPartial)).toBe(true);
      expect(await fileExists(newPartial)).toBe(true);
      expect(await fileExists(editPartial)).toBe(true);
      expect(await fileExists(emptyStatePartial)).toBe(true);
      expect(await fileExists(formPartial)).toBe(true);

      // Verify field_error partial
      const fieldErrorPath = path.join(testDir, 'app', 'views', 'partials', 'theme', 'simple', 'field_error.liquid');
      expect(await fileExists(fieldErrorPath)).toBe(true);
    });

    test('does not generate view files without --includeViews option', async () => {
      const { code } = await run(
        'test/fixtures/yeoman/modules/core/generators/crud book title:string',
        { cwd: testDir, timeout: 10000 }
      );

      expect(code).toBe(0);

      // Verify pages directory doesn't exist
      const pagesDir = path.join(testDir, 'app', 'views', 'pages', 'books');
      const pagesDirExists = await fileExists(pagesDir);
      expect(pagesDirExists).toBe(false);
    });

    test('pluralizes model name correctly', async () => {
      const { code } = await run(
        'test/fixtures/yeoman/modules/core/generators/crud person name:string',
        { cwd: testDir, timeout: 10000 }
      );

      expect(code).toBe(0);

      // Verify pluralized directory names
      const graphqlDir = path.join(testDir, 'app', 'graphql', 'people');
      const commandsDir = path.join(testDir, 'app', 'lib', 'commands', 'people');
      const queriesDir = path.join(testDir, 'app', 'lib', 'queries', 'people');

      expect(await fileExists(graphqlDir)).toBe(true);
      expect(await fileExists(commandsDir)).toBe(true);
      expect(await fileExists(queriesDir)).toBe(true);
    });

    test('generates files with correct content using template variables', async () => {
      const { code } = await run(
        'test/fixtures/yeoman/modules/core/generators/crud user name:string email:string age:integer',
        { cwd: testDir, timeout: 10000 }
      );

      expect(code).toBe(0);

      const createGraphQLPath = path.join(testDir, 'app', 'graphql', 'users', 'create.graphql');
      const createGraphQLContent = await readFile(createGraphQLPath);

      expect(createGraphQLContent).toContain('name');
      expect(createGraphQLContent).toContain('email');
      expect(createGraphQLContent).toContain('age');
      expect(createGraphQLContent).toContain('String');
      expect(createGraphQLContent).toContain('Int');
    });

    test('handles model with multiple word names', async () => {
      const { code } = await run(
        'test/fixtures/yeoman/modules/core/generators/crud blog_post title:string content:text',
        { cwd: testDir, timeout: 10000 }
      );

      expect(code).toBe(0);

      const schemaPath = path.join(testDir, 'app', 'schema', 'blog_post.yml');
      expect(await fileExists(schemaPath)).toBe(true);
    });

    test('supports array type attributes', async () => {
      const { code } = await run(
        'test/fixtures/yeoman/modules/core/generators/crud tag name:string categories:array',
        { cwd: testDir, timeout: 10000 }
      );

      expect(code).toBe(0);

      const createGraphQLPath = path.join(testDir, 'app', 'graphql', 'tags', 'create.graphql');
      const createGraphQLContent = await readFile(createGraphQLPath);

      expect(createGraphQLContent).toContain('[String]');
    });

    test('supports float and date types', async () => {
      const { code } = await run(
        'test/fixtures/yeoman/modules/core/generators/crud product price:float published_at:date',
        { cwd: testDir, timeout: 10000 }
      );

      expect(code).toBe(0);

      const createGraphQLPath = path.join(testDir, 'app', 'graphql', 'products', 'create.graphql');
      const createGraphQLContent = await readFile(createGraphQLPath);

      expect(createGraphQLContent).toContain('Float');
      expect(createGraphQLContent).toContain('String');
    });

    test('generates config.yml file', async () => {
      const { code } = await run(
        'test/fixtures/yeoman/modules/core/generators/crud custom_model name:string',
        { cwd: testDir, timeout: 10000 }
      );

      expect(code).toBe(0);

      const configPath = path.join(testDir, 'app', 'config.yml');
      const configExists = await fileExists(configPath);
      expect(configExists).toBe(true);
    });
  });

  describe('command generator', () => {
    let testDir;

    beforeEach(async () => {
      testDir = await setupTestProject();
    });

    afterEach(async () => {
      if (testDir) {
        await cleanupTestProject(testDir);
      }
    });

    test('requires commandName argument', async () => {
      const { stderr, code } = await run(
        'test/fixtures/yeoman/modules/core/generators/command',
        { cwd: testDir, timeout: 5000 }
      );

      // Yeoman shows error but exits with code 0
      expect(stderr).toMatch(/Did not provide required argument|error|Error/i);
    });

    test('generates command files with model/action format', async () => {
      const { stdout, stderr, code } = await run(
        'test/fixtures/yeoman/modules/core/generators/command users/create',
        { cwd: testDir, timeout: 10000 }
      );

      expect(code).toBe(0);
      expect(stdout).toContain('Command generated');
      expect(stderr).not.toContain('Error');

      // Verify command file
      const commandPath = path.join(testDir, 'app', 'lib', 'commands', 'users', 'create.liquid');
      const commandExists = await fileExists(commandPath);
      expect(commandExists).toBe(true);

      const commandContent = await readFile(commandPath);
      expect(commandContent).toContain('commands/users/create');

      // Verify GraphQL file
      const graphqlPath = path.join(testDir, 'app', 'graphql', 'users', 'create.graphql');
      const graphqlExists = await fileExists(graphqlPath);
      expect(graphqlExists).toBe(true);
    });

    test('generates command directory with build and check phases', async () => {
      const { code } = await run(
        'test/fixtures/yeoman/modules/core/generators/command products/update',
        { cwd: testDir, timeout: 10000 }
      );

      expect(code).toBe(0);

      const commandDir = path.join(testDir, 'app', 'lib', 'commands', 'products', 'update');
      const buildPhase = path.join(commandDir, 'build.liquid');
      const checkPhase = path.join(commandDir, 'check.liquid');

      expect(await fileExists(buildPhase)).toBe(true);
      expect(await fileExists(checkPhase)).toBe(true);
    });

    test('parses modelName and actionName from command path', async () => {
      const { code } = await run(
        'test/fixtures/yeoman/modules/core/generators/command orders/process_payment',
        { cwd: testDir, timeout: 10000 }
      );

      expect(code).toBe(0);

      const commandPath = path.join(testDir, 'app', 'lib', 'commands', 'orders', 'process_payment.liquid');
      const commandContent = await readFile(commandPath);

      // Verify template substitution
      expect(commandContent).toContain('orders/process_payment');
    });

    test('handles simple command name without model', async () => {
      const { code } = await run(
        'test/fixtures/yeoman/modules/core/generators/command simple_task',
        { cwd: testDir, timeout: 10000 }
      );

      expect(code).toBe(0);

      // Verify files are created
      const commandPath = path.join(testDir, 'app', 'lib', 'commands', 'simple_task.liquid');
      const commandDir = path.join(testDir, 'app', 'lib', 'commands', 'simple_task');

      expect(await fileExists(commandPath)).toBe(true);
      expect(await fileExists(commandDir)).toBe(true);
    });

    test('generates GraphQL mutation file', async () => {
      const { code } = await run(
        'test/fixtures/yeoman/modules/core/generators/command notifications/send',
        { cwd: testDir, timeout: 10000 }
      );

      expect(code).toBe(0);

      const graphqlPath = path.join(testDir, 'app', 'graphql', 'notifications', 'send.graphql');
      const graphqlExists = await fileExists(graphqlPath);
      expect(graphqlExists).toBe(true);

      const graphqlContent = await readFile(graphqlPath);
      expect(graphqlContent).toBeTruthy();
    });

    test('handles multiple directory levels', async () => {
      const { code } = await run(
        'test/fixtures/yeoman/modules/core/generators/command admin/users/create',
        { cwd: testDir, timeout: 10000 }
      );

      expect(code).toBe(0);

      const commandPath = path.join(testDir, 'app', 'lib', 'commands', 'admin', 'users', 'create.liquid');
      const graphqlPath = path.join(testDir, 'app', 'graphql', 'admin', 'users', 'create.graphql');

      expect(await fileExists(commandPath)).toBe(true);
      expect(await fileExists(graphqlPath)).toBe(true);
    });

    test('substitutes actionName template variable correctly', async () => {
      const { code } = await run(
        'test/fixtures/yeoman/modules/core/generators/command comments/delete',
        { cwd: testDir, timeout: 10000 }
      );

      expect(code).toBe(0);

      const commandContent = await readFile(
        path.join(testDir, 'app', 'lib', 'commands', 'comments', 'delete.liquid')
      );
      expect(commandContent).toContain('delete');
    });

    test('substitutes modelName template variable correctly', async () => {
      const { code } = await run(
        'test/fixtures/yeoman/modules/core/generators/command sessions/destroy',
        { cwd: testDir, timeout: 10000 }
      );

      expect(code).toBe(0);

      const commandContent = await readFile(
        path.join(testDir, 'app', 'lib', 'commands', 'sessions', 'destroy.liquid')
      );
      expect(commandContent).toContain('sessions');
    });

    test('generates build phase with correct structure', async () => {
      const { code } = await run(
        'test/fixtures/yeoman/modules/core/generators/command reports/generate',
        { cwd: testDir, timeout: 10000 }
      );

      expect(code).toBe(0);

      // The build.liquid is a static template without template variables
      const buildPhase = path.join(
        testDir,
        'app',
        'lib',
        'commands',
        'reports',
        'generate',
        'build.liquid'
      );
      const buildContent = await readFile(buildPhase);

      // Build phase should contain the expected Liquid code structure
      expect(buildContent).toContain('assign data');
      expect(buildContent).toContain('return data');
    });

    test('generates check phase with correct structure', async () => {
      const { code } = await run(
        'test/fixtures/yeoman/modules/core/generators/command documents/approve',
        { cwd: testDir, timeout: 10000 }
      );

      expect(code).toBe(0);

      const checkPhase = path.join(
        testDir,
        'app',
        'lib',
        'commands',
        'documents',
        'approve',
        'check.liquid'
      );
      const checkContent = await readFile(checkPhase);

      expect(checkContent).toBeTruthy();
    });
  });

  describe('generator help', () => {
    let testDir;

    beforeEach(async () => {
      testDir = await setupTestProject();
    });

    afterEach(async () => {
      if (testDir) {
        await cleanupTestProject(testDir);
      }
    });

    test('shows help for crud generator', async () => {
      const { stdout, code } = await run(
        'test/fixtures/yeoman/modules/core/generators/crud --generator-help',
        { cwd: testDir, timeout: 5000 }
      );

      expect(code).toBe(0);
      expect(stdout).toContain('Generator');
      expect(stdout).toContain('Usage');
      expect(stdout).toContain('Arguments');
      expect(stdout).toContain('modelName');
    });

    test('shows help for command generator', async () => {
      const { stdout, code } = await run(
        'test/fixtures/yeoman/modules/core/generators/command --generator-help',
        { cwd: testDir, timeout: 5000 }
      );

      expect(code).toBe(0);
      expect(stdout).toContain('Generator');
      expect(stdout).toContain('Usage');
      expect(stdout).toContain('Arguments');
      expect(stdout).toContain('commandName');
    });
  });
});

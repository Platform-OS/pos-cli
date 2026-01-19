import 'dotenv/config';
import { describe, test, expect, vi, beforeAll } from 'vitest';
import exec from '#test/utils/exec';
import cliPath from '#test/utils/cliPath';
import unzip from 'unzipper';
import fs from 'fs';
import path from 'path';
import { requireRealCredentials } from '#test/utils/credentials';
import shell from 'shelljs';

vi.setConfig({ testTimeout: 40000 });

const cwd = name => path.join(process.cwd(), 'test', 'fixtures', 'deploy', name);

const cleanupTmp = () => {
  const tmpDir = path.join(process.cwd(), 'test', 'fixtures', 'deploy', 'correct', 'tmp');
  if (fs.existsSync(tmpDir)) {
    shell.rm('-rf', tmpDir);
  }
};

beforeAll(() => {
  cleanupTmp();
});

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const run = (fixtureName, options) => exec(`${cliPath} deploy ${options || ''}`, { cwd: cwd(fixtureName), env: process.env });

const extract = async (inputPath, outputPath) => {
  return unzip.Open.file(inputPath).then(d => d.extract({ path: outputPath, concurrency: 5 }));
};


describe('Happy path', () => {
  test('App directory + modules', async () => {
    requireRealCredentials();
    await sleep(3000); // it's needed to run tests in parallel mode


    const { stdout } = await run('correct');

    expect(stdout).toMatch(process.env.MPKIT_URL);
    expect(stdout).toMatch('Deploy succeeded');

    const deployDir = cwd('correct');
    await extract(`${deployDir}/tmp/release.zip`, `${deployDir}/tmp/release`);
    const nestedPartial = fs.readFileSync(
      `${deployDir}/tmp/release/modules/testModule/public/views/partials/dir/subdir/foo.liquid`,
      'utf8'
    );
    expect(nestedPartial).toMatch('dir/subdir/foo');
  });

  test('Legacy directory', async () => {
    const { stdout } = await run('correct_mpbuilder');
    expect(stdout).toMatch(process.env.MPKIT_URL);
    expect(stdout).toMatch('Deploy succeeded');
  });

  test('correct with direct upload', async () => {
    requireRealCredentials();
    const { stdout, stderr } = await run('correct', '-d');

    expect(stdout).toMatch(process.env.MPKIT_URL);
    expect(stderr).toMatch('There are no assets to deploy, skipping.');
    expect(stdout).toMatch('Deploy succeeded');

    const deployDir = cwd('correct');
    await extract(`${deployDir}/tmp/release.zip`, `${deployDir}/tmp/release`);
    const nestedPartial = fs.readFileSync(
      `${deployDir}/tmp/release/modules/testModule/public/views/partials/dir/subdir/foo.liquid`,
      'utf8'
    );
    expect(nestedPartial).toMatch('dir/subdir/foo');
  });

  test('correct with assets with direct upload', async () => {
    requireRealCredentials();
    const { stdout } = await run('correct_with_assets', '-d');

    expect(stdout).toMatch(process.env.MPKIT_URL);
    expect(stdout).toMatch('Deploy succeeded');

    const deployDir = cwd('correct_with_assets');
    await extract(`${deployDir}/tmp/release.zip`, `${deployDir}/tmp/release`);
    const nestedPartial = fs.readFileSync(
      `${deployDir}/tmp/release/modules/testModule/public/views/partials/dir/subdir/foo.liquid`,
      'utf8'
    );
    expect(nestedPartial).toMatch('dir/subdir/foo');

    await extract(`${deployDir}/tmp/assets.zip`, `${deployDir}/tmp/release_assets`);
    expect(fs.existsSync(`${deployDir}/tmp/release_assets/foo.js`)).toBeTruthy();
    expect(fs.existsSync(`${deployDir}/tmp/release_assets/modules/testModule/bar.js`)).toBeTruthy();
  });

  test('only assets with old upload', async () => {
    requireRealCredentials();
    const { stdout, stderr } = await run('correct_only_assets', '-o');
    expect(stderr).not.toMatch('There are no files in release file, skipping.');
    expect(stdout).toMatch(process.env.MPKIT_URL);
    expect(stdout).toMatch('Deploy succeeded');
  });

  test('only assets', async () => {
    requireRealCredentials();
    const { stdout, stderr } = await run('correct_only_assets');
    expect(stderr).toMatch('There are no files in release file, skipping.');
    expect(stdout).toMatch(process.env.MPKIT_URL);
    expect(stdout).toMatch('Deploy succeeded');
  });
});

describe('Server errors', () => {
  test('Nothing to deploy', async () => {
    const { stderr } = await run('empty');
    expect(stderr).toMatch('Could not find any directory to deploy. Looked for app, marketplace_builder and modules');
  });

  test('Error in view', async () => {
    const { stderr } = await run('incorrect_view');
    expect(stderr).toMatch('views/pages/hello.liquid');
    expect(stderr).toMatch('contains invalid YAML');
    expect(stderr).toMatch("could not find expected ':' at line 3");
  });

  test('Error in form', async () => {
    const { stderr } = await run('incorrect_form');
    expect(stderr).toMatch(
      'Unknown properties in `form_configurations/hello.liquid`: hello. Available properties are: api_call_notifications, async_callback_actions, authorization_policies, body, callback_actions, default_payload, email_notifications, fields, flash_alert, flash_notice, live_reindex, metadata, name, redirect_to, request_allowed, resource, resource_owner, response_headers, return_to, sms_notifications, spam_protection.'
    );
  });

  test('Error in model', async () => {
    const { stderr } = await run('incorrect_model');
    expect(stderr).toMatch(
      'Validation failed: Attribute type `foo` is not allowed. Valid attribute types: string, integer, float, decimal, datetime, time, date, binary, boolean, array, address, file, photo, text, geojson, upload'
    );
  });

  test('Network error and pos-cli exits with 1', async () => {
    const originalUrl = process.env.MPKIT_URL;
    const originalToken = process.env.MPKIT_TOKEN;
    const originalEmail = process.env.MPKIT_EMAIL;

    try {
      process.env.MPKIT_URL = 'https://incorrecturl123xyz.com';
      process.env.MPKIT_TOKEN = 'test-token';
      process.env.MPKIT_EMAIL = 'test@example.com';

      const { stderr, code } = await run('correct');

      expect(code).toEqual(1);
      expect(stderr).toMatch(
        'Deploy failed. RequestError: fetch failed'
      );
    } finally {
      process.env.MPKIT_URL = originalUrl;
      process.env.MPKIT_TOKEN = originalToken;
      process.env.MPKIT_EMAIL = originalEmail;
    }
  });
});

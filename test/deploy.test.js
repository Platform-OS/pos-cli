/* global jest */

const exec = require('./utils/exec');
const cliPath = require('./utils/cliPath');
const unzip = require('unzipper');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const cwd = name => path.join(process.cwd(), 'test', 'fixtures', 'deploy', name);

const run = (fixtureName, options) => exec(`${cliPath} deploy ${options || ''}`, { cwd: cwd(fixtureName), env: process.env });

const extract = async (inputPath, outputPath) => {
  return unzip.Open.file(inputPath).then(d => d.extract({ path: outputPath, concurrency: 5 }));
};

jest.setTimeout(40000); // default jasmine timeout is 5 seconds - we need more.

describe('Happy path', () => {
  test('App directory + modules', async () => {
    const { stderr, stdout } = await run('correct');

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
    const { stdout, stderr } = await run('correct_with_assets', '-d');

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
    const { stdout, stderr } = await run('correct_only_assets', '-o');
    expect(stderr).not.toMatch('There are no files in release file, skipping.');
    expect(stdout).toMatch(process.env.MPKIT_URL);
    expect(stdout).toMatch('Deploy succeeded');
  });

  test('only assets', async () => {
    const { stdout, stderr } = await run('correct_only_assets');
    expect(stderr).toMatch('There are no files in release file, skipping.');
    expect(stdout).toMatch('Deploy succeeded');
  });
});

describe('Server errors', () => {
  test('Nothing to deploy', async () => {
    const { stderr, stdout } = await run('empty');
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
    process.env.MPKIT_URL = 'https://incorrecturl123xyz.com'

    const { stderr, stdout, code } = await run('correct');

    expect(code).toEqual(1);
    expect(stderr).toMatch(
      'Deploy failed. RequestError: Error: getaddrinfo ENOTFOUND incorrecturl123xyz.com'
    );
  });
});

/* global jest */

const exec = require('./utils/exec');
const cliPath = require('./utils/cliPath');

require('dotenv').config();

const cwd = name => `${process.cwd()}/test/fixtures/deploy/${name}`;

const run = fixtureName => exec(`${cliPath} deploy`, { cwd: cwd(fixtureName), env: process.env });

jest.setTimeout(20000); // default jasmine timeout is 5 seconds - we need more.

describe('Happy path', () => {
  test('App directory + modules', async () => {
    const { stdout } = await run('correct');

    expect(stdout).toMatch(process.env.MPKIT_URL);
    expect(stdout).toMatch('Deploy succeeded after');
  });

  test('Legacy directory', async () => {
    const { stdout } = await run('correct_mpbuilder');
    expect(stdout).toMatch(process.env.MPKIT_URL);
    expect(stdout).toMatch('Deploy succeeded after');
  });

});

describe('Server errors', () => {
  test('Nothing to deploy', async () => {
    try {
      await run('empty');
    } catch(e) {
      expect(`${e}`).toMatch('Could not find any directory to deploy. Looked for app, marketplace_builder and modules');
      expect(`${e}`).toMatch('Deploy failed. Archive failed to create.');
    }
  });

  test('Error in view', async () => {
    try {
      await run('incorrect_view');
    } catch(e) {
      expect(`${e}`).toMatch('views/pages/hello.liquid');
      expect(`${e}`).toMatch('contains invalid YAML');
      expect(`${e}`).toMatch("could not find expected ':' at line 3");
      expect(`${e}`).toMatch('Deploy failed. Server did not accept release file.');
    }
  });

  test('Error in form', async () => {
    try {
      await run('incorrect_form');
    } catch(e) {
      // expect(`${e}`).toMatch('views/pages/hello.liquid'); // TODO: Missing file_path
      expect(`${e}`).toMatch('Unknown properties: hello. Available properties are: api_call_notifications, async_callback_actions, authorization_policies, base_form, body, callback_actions, configuration, default_payload, email_notifications, fields, flash_alert, flash_notice, live_reindex, metadata, name, physical_file_path, redirect_to, resource, resource_owner, return_to, sms_notifications, spam_protection.');
      expect(`${e}`).toMatch('Deploy failed. Server did not accept release file.');
    }
  });

  test('Error in model', async () => {
    try {
      await run('incorrect_model');
    } catch(e) {
      // expect(`${e}`).toMatch('views/pages/hello.liquid'); // TODO: Missing file_path
      expect(`${e}`).toMatch('Validation failed: Attribute type not allowed, valid types: string, integer, float, decimal, datetime, time, date, binary, boolean, array, address, file, photo, text, geojson');
      expect(`${e}`).toMatch('Deploy failed. Server did not accept release file.');
    }
  });
});

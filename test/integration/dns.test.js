/**
 * Integration tests for `pos-cli dns` — gated on real portal credentials.
 *
 * Required env vars (skipped otherwise):
 *   POS_DNS_TEST_SOURCE_PORTAL_URL, POS_DNS_TEST_SOURCE_TOKEN, POS_DNS_TEST_SOURCE_UUID
 * Optional (enables the compare round-trip against a second portal/instance):
 *   POS_DNS_TEST_TARGET_PORTAL_URL, POS_DNS_TEST_TARGET_TOKEN, POS_DNS_TEST_TARGET_UUID
 *
 * Read-only against the portals: exports + offline dry-run import + offline compare.
 * The live-write migrate path is exercised manually (see backlog task-1.9).
 */
import { describe, test, expect, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import exec from '#test/utils/exec';
import cliPath from '#test/utils/cliPath';

vi.setConfig({ testTimeout: 120000 });

const SOURCE = {
  portalUrl: process.env.POS_DNS_TEST_SOURCE_PORTAL_URL,
  token: process.env.POS_DNS_TEST_SOURCE_TOKEN,
  uuid: process.env.POS_DNS_TEST_SOURCE_UUID
};
const TARGET = {
  portalUrl: process.env.POS_DNS_TEST_TARGET_PORTAL_URL,
  token: process.env.POS_DNS_TEST_TARGET_TOKEN,
  uuid: process.env.POS_DNS_TEST_TARGET_UUID
};

const hasSource = SOURCE.portalUrl && SOURCE.token && SOURCE.uuid;
const hasTarget = TARGET.portalUrl && TARGET.token && TARGET.uuid;

describe.skipIf(!hasSource)('pos-cli dns (integration)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-cli-dns-'));
  const exportFile = path.join(tmpDir, 'export.json');

  test('export produces a valid envelope from the live portal', async () => {
    const { code } = await exec(
      `${cliPath} dns export --portal-url ${SOURCE.portalUrl} --token ${SOURCE.token} --instance-uuid ${SOURCE.uuid} -o ${exportFile}`
    );
    expect(code).toEqual(0);

    const envelope = JSON.parse(fs.readFileSync(exportFile, 'utf8'));
    expect(envelope.schema).toEqual('pos-cli/dns-export/v1');
    expect(envelope.instance.uuid).toEqual(SOURCE.uuid);
    expect(Array.isArray(envelope.domains)).toBe(true);
    expect(envelope.domains.every(domain => domain?.details?.state === undefined)).toBe(true);
  });

  test('offline dry-run import renders a plan without touching any portal', async () => {
    const { stdout, code } = await exec(
      `${cliPath} dns import --file ${exportFile} --instance-uuid fake-target-uuid --dry-run`
    );
    expect(code).toEqual(0);
    expect(stdout).toMatch(/domain\(s\) to apply|skipped/);
  });

  test('offline self-compare is clean', async () => {
    const { stdout, code } = await exec(
      `${cliPath} dns compare --source-file ${exportFile} --target-file ${exportFile}`
    );
    expect(code).toEqual(0);
    expect(stdout).toMatch(/Critical: 0/);
  });

  test.skipIf(!hasTarget)('cross-portal compare runs against both live portals', async () => {
    const { stdout } = await exec(
      `${cliPath} dns compare ` +
      `--source-portal-url ${SOURCE.portalUrl} --source-token ${SOURCE.token} --source-instance-uuid ${SOURCE.uuid} ` +
      `--target-portal-url ${TARGET.portalUrl} --target-token ${TARGET.token} --target-instance-uuid ${TARGET.uuid} ` +
      '--ignore-status'
    );
    expect(stdout).toMatch(/OK: \d+ {2}Advisory: \d+ {2}Critical: \d+/);
  });
});

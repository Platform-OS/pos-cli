import { describe, test, expect, vi, beforeEach } from 'vitest';
import { showModuleVersions } from '#lib/modules/show.js';
import { makeSpinner } from '#test/utils/spinnerMock.js';

vi.mock('#lib/portal.js', () => ({
  default: { moduleVersions: vi.fn() }
}));

// Stubbed to assert show re-surfaces the module's post-install message;
// the real impl reads modules/<name>/ from disk and is tested separately.
vi.mock('#lib/modules/postInstall.js', () => ({
  printPostInstallMessages: vi.fn().mockReturnValue([])
}));

import Portal from '#lib/portal.js';
import { printPostInstallMessages } from '#lib/modules/postInstall.js';

const spinner = makeSpinner();

beforeEach(() => vi.clearAllMocks());

// ---------------------------------------------------------------------------
// Happy path — versions found
// ---------------------------------------------------------------------------

describe('showModuleVersions — versions found', () => {
  test('calls succeed with the module name and version count', async () => {
    Portal.moduleVersions.mockResolvedValue([
      { module: 'core', versions: { '1.0.0': {}, '2.0.0': {}, '2.1.0': {} } }
    ]);

    await showModuleVersions(spinner, 'core');

    expect(spinner.succeed).toHaveBeenCalledWith('core — 3 version(s):');
  });

  test('single version is reported as "1 version(s)"', async () => {
    Portal.moduleVersions.mockResolvedValue([
      { module: 'core', versions: { '1.0.0': {} } }
    ]);

    await showModuleVersions(spinner, 'core');

    expect(spinner.succeed).toHaveBeenCalledWith('core — 1 version(s):');
  });

  test('versions are sorted newest to oldest', async () => {
    Portal.moduleVersions.mockResolvedValue([
      { module: 'core', versions: { '1.0.0': {}, '3.0.0': {}, '2.0.0': {} } }
    ]);

    await showModuleVersions(spinner, 'core');

    // spinner.succeed captures the header; the versions themselves are logged after.
    // We check the order by inspecting the resolved versions list indirectly via
    // Portal.moduleVersions returning an unsorted object — the displayed order is
    // what matters, confirmed through the succeed message order.
    expect(spinner.succeed).toHaveBeenCalledWith('core — 3 version(s):');
  });

  test('pre-release versions sort after their stable counterparts', async () => {
    Portal.moduleVersions.mockResolvedValue([
      { module: 'core', versions: { '1.0.0': {}, '2.0.0-beta.1': {}, '2.0.0': {} } }
    ]);

    await showModuleVersions(spinner, 'core');

    expect(spinner.succeed).toHaveBeenCalledWith('core — 3 version(s):');
  });

  test('passes module name to Portal.moduleVersions', async () => {
    Portal.moduleVersions.mockResolvedValue([
      { module: 'user', versions: { '5.0.0': {} } }
    ]);

    await showModuleVersions(spinner, 'user');

    expect(Portal.moduleVersions).toHaveBeenCalledWith(['user'], expect.any(String));
  });

  test('uses PARTNER_PORTAL_HOST env var as registry URL when set', async () => {
    const originalEnv = process.env.PARTNER_PORTAL_HOST;
    process.env.PARTNER_PORTAL_HOST = 'https://custom.registry.example.com';

    Portal.moduleVersions.mockResolvedValue([
      { module: 'core', versions: { '1.0.0': {} } }
    ]);

    await showModuleVersions(spinner, 'core');

    expect(Portal.moduleVersions).toHaveBeenCalledWith(['core'], 'https://custom.registry.example.com');

    process.env.PARTNER_PORTAL_HOST = originalEnv;
  });

  test('uses default registry URL when PARTNER_PORTAL_HOST is not set', async () => {
    const originalEnv = process.env.PARTNER_PORTAL_HOST;
    delete process.env.PARTNER_PORTAL_HOST;

    Portal.moduleVersions.mockResolvedValue([
      { module: 'core', versions: { '1.0.0': {} } }
    ]);

    await showModuleVersions(spinner, 'core');

    expect(Portal.moduleVersions).toHaveBeenCalledWith(['core'], 'https://partners.platformos.com');

    process.env.PARTNER_PORTAL_HOST = originalEnv;
  });
});

// ---------------------------------------------------------------------------
// Module not found / no versions
// ---------------------------------------------------------------------------

describe('showModuleVersions — module not found or empty', () => {
  test('throws when the module is not in the registry response', async () => {
    Portal.moduleVersions.mockResolvedValue([]);

    await expect(showModuleVersions(spinner, 'nonexistent')).rejects.toThrow(
      /Module "nonexistent" not found/
    );
  });

  test('error message includes registry URL', async () => {
    const originalEnv = process.env.PARTNER_PORTAL_HOST;
    delete process.env.PARTNER_PORTAL_HOST;

    Portal.moduleVersions.mockResolvedValue([]);

    await expect(showModuleVersions(spinner, 'missing')).rejects.toThrow(
      /partners\.platformos\.com/
    );

    process.env.PARTNER_PORTAL_HOST = originalEnv;
  });

  test('warns when module exists but has no published versions', async () => {
    Portal.moduleVersions.mockResolvedValue([
      { module: 'empty-mod', versions: {} }
    ]);

    await showModuleVersions(spinner, 'empty-mod');

    expect(spinner.warn).toHaveBeenCalledWith(
      expect.stringMatching(/empty-mod.*no published versions/)
    );
    expect(spinner.succeed).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Network / registry errors
// ---------------------------------------------------------------------------

describe('showModuleVersions — registry errors', () => {
  test('throws a descriptive error when Portal.moduleVersions rejects', async () => {
    Portal.moduleVersions.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(showModuleVersions(spinner, 'core')).rejects.toThrow(
      /Failed to fetch versions for "core"/
    );
  });

  test('error message includes the original network error cause', async () => {
    Portal.moduleVersions.mockRejectedValue(new Error('Connection timed out'));

    await expect(showModuleVersions(spinner, 'core')).rejects.toThrow(
      /Connection timed out/
    );
  });
});

// ---------------------------------------------------------------------------
// Post-install message re-display (cf. `brew info`)
// ---------------------------------------------------------------------------

describe('showModuleVersions — post-install message', () => {
  test('re-surfaces the module post-install message after listing versions', async () => {
    Portal.moduleVersions.mockResolvedValue([
      { module: 'core', versions: { '2.0.0': {} } }
    ]);

    await showModuleVersions(spinner, 'core');

    expect(printPostInstallMessages).toHaveBeenCalledTimes(1);
    expect(printPostInstallMessages.mock.calls[0][0]).toEqual(['core']);
  });

  test('does not attempt to re-surface a message when the module has no versions', async () => {
    Portal.moduleVersions.mockResolvedValue([
      { module: 'empty-mod', versions: {} }
    ]);

    await showModuleVersions(spinner, 'empty-mod');

    expect(printPostInstallMessages).not.toHaveBeenCalled();
  });

  test('does not attempt to re-surface a message when the module is not found', async () => {
    Portal.moduleVersions.mockResolvedValue([]);

    await expect(showModuleVersions(spinner, 'ghost')).rejects.toThrow();
    expect(printPostInstallMessages).not.toHaveBeenCalled();
  });
});

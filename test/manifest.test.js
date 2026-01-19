import { manifestGenerateForAssets } from '../lib/assets/manifest';

const oldCwd = process.cwd();
beforeEach(() => {
  process.chdir(`${oldCwd}/test/fixtures/deploy/correct_with_assets`);
});
afterEach(() => {
  process.chdir(oldCwd);
});

test('manifest for files on linux', () => {
  const assets = [
    'app/assets/foo.js',
    'modules/testModule/public/assets/bar.js'
  ];

  const manifestFile = manifestGenerateForAssets(assets);
  Object.entries(manifestFile).forEach(([_key, value]) => delete value['updated_at']);
  expect(manifestFile).toEqual({
    'app/assets/foo.js': {
      'file_size': 20,
      'physical_file_path': 'app/assets/foo.js'
    },
    'modules/testModule/bar.js': {
      'file_size': 20,
      'physical_file_path': 'modules/testModule/public/assets/bar.js'
    }
  });
});

test('manifest for files on windows', () => {
  const assets = [
    'app\\assets\\foo.js',
    'modules\\testModule\\public\\assets\\bar.js'
  ];

  const manifestFile = manifestGenerateForAssets(assets);
  Object.entries(manifestFile).forEach(([_key, value]) => delete value['updated_at']);
  expect(manifestFile).toEqual({
    'app/assets/foo.js': {
      'file_size': 20,
      'physical_file_path': 'app/assets/foo.js'
    },
    'modules/testModule/bar.js': {
      'file_size': 20,
      'physical_file_path': 'modules/testModule/public/assets/bar.js'
    }
  });
});

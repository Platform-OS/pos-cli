import { manifestGenerateForAssets } from '#lib/assets/manifest';

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
  Object.entries(manifestFile).forEach(([_key, value]) => {
    delete value['updated_at'];
    delete value['file_size'];  // File size varies by line endings (CRLF vs LF)
  });
  // Manifest keys have app/assets/ and public/assets/ stripped
  // physical_file_path has only the app directory prefix stripped
  expect(manifestFile).toEqual({
    'foo.js': {
      'physical_file_path': 'assets/foo.js'
    },
    'modules/testModule/bar.js': {
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
  Object.entries(manifestFile).forEach(([_key, value]) => {
    delete value['updated_at'];
    delete value['file_size'];  // File size varies by line endings (CRLF vs LF)
  });
  // Windows paths are normalized to forward slashes
  // Manifest keys have app/assets/ and public/assets/ stripped
  expect(manifestFile).toEqual({
    'foo.js': {
      'physical_file_path': 'assets/foo.js'
    },
    'modules/testModule/bar.js': {
      'physical_file_path': 'modules/testModule/public/assets/bar.js'
    }
  });
});

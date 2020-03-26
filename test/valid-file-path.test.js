const validFilePath = require('../lib/utils/valid-file-path');

describe('Linux - Correct', () => {
  const correct = [
    'a/my_images/IMG--__23~123.min.jpeg',
    'modules/admin/foo_bar/test--__23~123.html.liquid',
    'modules/admin cms/foo bar/test (Screenshot).liquid',
    'a/foo/test+99.zip'
  ];

  correct.forEach(p => {
    test(p, () => {
      expect(validFilePath(p)).toBe(true);
    });
  });
});

describe('Linux - Incorrect', () => {
  const incorrect = [
    "a/foo/test'.zip",
    'a/foo/test".zip',
    'a/foo/test*.zip',
    'a/foo/test#.zip',
    'a/foo/test@.zip',
    'a/foo/test<.zip',
    'a/foo/test|.zip',
    'a/foo/test?.zip'
  ];

  incorrect.forEach(p => {
    test(p, () => {
      expect(validFilePath(p)).toBe(false);
    });
  });
});

describe('Windows - Correct', () => {
  const correct = [
    'a\\my_images\\IMG--__23~123.min.jpeg',
    'modules\\admin\\foo_bar\\test--__23~123.html.liquid',
    'modules\\admin cms\\foo bar\\test (Screenshot).liquid',
    'a\\foo\\test+99.zip'
  ];
  correct.forEach(p => {
    test(p, () => {
      expect(validFilePath(p)).toBe(true);
    });
  });
});

describe('Windows - Incorrect', () => {
  const incorrect = [
    "a\\foo\\test'.zip",
    'a\\foo\\test".zip',
    'a\\foo\\test*.zip',
    'a\\foo\\test#.zip',
    'a\\foo\\test@.zip',
    'a\\foo\\test<.zip',
    'a\\foo\\test|.zip',
    'a\\foo\\test?.zip'
  ];

  incorrect.forEach(p => {
    test(p, () => {
      expect(validFilePath(p)).toBe(false);
    });
  });
});
const validCharacters = new RegExp([
  '[^',
  '\\w',
  '\\s',
  '\\-',
  '_',
  '~',
  '@',
  '%',
  '\\+',
  '\\.',
  '\\/',
  '\\\\',
  '\\(',
  '\\)',
  "'",
  '&',
  ']'
].join(''));

const isValidFilePath = str => !validCharacters.test(str);

export default isValidFilePath;

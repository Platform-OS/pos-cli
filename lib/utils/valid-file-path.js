const validCharacters = new RegExp([
  '[^',   // Not the following characters:
  '\\w',  // - Word characters
  '\\s',  // - Whitespace
  '\\-',  // - Dash
  '_',
  '~',
  '\+',   // - Plus
  '\\.',  // - Dot
  '\\/',  // - Forward slash
  '\\\\', // - Backward slash
  ']'
].join(''));

module.exports = function (p) {
  return !validCharacters.test(p);
};

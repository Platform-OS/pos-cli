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
  '\\(',  // - Open parenthesis
  '\\)',  // - Close parenthesis
  ']'
].join(''));

module.exports = str => !validCharacters.test(str);

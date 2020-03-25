const validCharacters = /[^\w\s\-_~\.\/\\]/;

module.exports = function(p) {
  return !validCharacters.test(p);
};

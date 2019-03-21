const fs = require('fs'),
  logger = require('./logger'),
  mustache = require('mustache');

const tags = ['<%=', '=%>'];


/**
 * This function will replace tags with values from template data.
 * Example: if tags are <%= and =%> and we have code like this:
 *
 * ---
 * slug: <%= page_url =%>
 * ---
 *
 * This function will replace `page_url` with value from templateData
 * hash or it will **not** raise an error if the value is missing.
 * @param {string} path - path to the file which will be processed.
 **/
const fillInTemplateValues = (path, templateData) => {
  const fileBody = fs.readFileSync(path, 'utf8');
  try {
    return mustache.render(fileBody, templateData, {}, tags);
  } catch (err) {
    logger.Debug(err);
    return '';
  }
};

module.exports = {
  fillInTemplateValues: fillInTemplateValues
};

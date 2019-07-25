const fs = require('fs'),
  path = require('path');

const mustache = require('mustache');

const logger = require('./logger');

const tags = ['<%=', '=%>'];
const allowedTemplateExtentions = ['.css', '.js', '.liquid', '.yml', '.xml', '.json', '.svg', '.graphql', '.html'];

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
const fillInTemplateValues = (filePath, templateData) => {
  if (fs.existsSync(filePath) && qualifedForTemplateProcessing(filePath) && hasTemplateValues(templateData)) {
    const fileBody = fs.readFileSync(filePath, 'utf8');
    try {
      return mustache.render(fileBody, templateData, {}, tags);
    } catch (e) {
      logger.Debug(e.message);
      return fileBody;
    }
  } else {
    return fs.createReadStream(filePath);
  }
};

const qualifedForTemplateProcessing = filePath => {
  return allowedTemplateExtentions.includes(path.extname(filePath));
};

const hasTemplateValues = templateData => {
  try {
    return Object.keys(templateData).length !== 0;
  } catch (e) {
    logger.Debug(e.message);
    return false;
  }
};

module.exports = {
  fillInTemplateValues: fillInTemplateValues
};

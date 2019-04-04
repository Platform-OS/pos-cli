const fs = require('fs'),
  logger = require('./logger'),
  path = require('path'),
  mustache = require('mustache');

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
  const fileBody = fs.readFileSync(filePath, 'utf8');
  if (qualifedForTemplateProcessing(filePath)) {
    logger.Debug('Processing module file as a template');
    try {
      return mustache.render(fileBody, templateData, {}, tags);
    } catch (err) {
      logger.Debug(err);
      return '';
    }
  } else {
    logger.Debug('Skipping template processing, reading raw file body');
    return fs.createReadStream(filePath);
  }
};

const qualifedForTemplateProcessing = (filePath) => {
  return allowedTemplateExtentions.includes(path.extname(filePath));
};

module.exports = {
  fillInTemplateValues: fillInTemplateValues
};

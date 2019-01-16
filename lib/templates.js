const fs = require('fs'),
  logger = require('./logger'),
  settings = require('./settings'),
  mustache = require('mustache');

process.env.TEMPLATE_VALUES_FILE_PATH = 'template-values.json';

const tags = ['<%=', '=%>'];

const templateData = () => {
  return settings.loadSettingsFile(process.env.TEMPLATE_VALUES_FILE_PATH);
};

/**
 * This function will replace tags with values from template data.
 * Example: if tags are <%= and =%> and we have code like this:
 *
 * ---
 * slug: <%= page_url %>
 * ---
 *
 * This function will replace `page_url` with value from templateData
 * hash or it will **not** raise an error if the value is missing.
 * @param {string} path - path to the file which will be processed.
 **/
const fillInTemplateValues = path => {
  const fileBody = fs.readFileSync(path, 'utf8');
  try {
    return mustache.render(fileBody, templateData(), {}, tags);
  } catch (err) {
    logger.Debug(err);
    return '';
  }
};

module.exports = {
  fillInTemplateValues: fillInTemplateValues,
  templateData: templateData
};

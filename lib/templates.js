import fs from 'fs';
import path from 'path';

import mustache from 'mustache';

import logger from './logger.js';

const tags = ['<%=', '=%>'];
const allowedTemplateExtentions = ['.css', '.js', '.liquid', '.yml', '.xml', '.json', '.svg', '.graphql', '.html'];

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

export { fillInTemplateValues };

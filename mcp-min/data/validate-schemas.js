// Schema loading utility for platformOS data validation
// Loads schema files from app/schema/ or app/model_schemas/

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fs = require('fs');
const path = require('path');

/**
 * Simple YAML parser for platformOS schema format
 * Handles the specific structure: name, properties array with name/type/options
 * Does not depend on js-yaml
 */
function parseSchemaYaml(content) {
  const lines = content.split('\n');
  const schema = { name: '', properties: [] };

  let currentProperty = null;
  let inProperties = false;
  let inOptions = false;
  let inVersions = false;
  let propertyIndent = 0;
  let optionsIndent = 0;
  let versionsIndent = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Calculate indentation
    const indent = line.length - line.trimStart().length;

    // Parse name field at root level
    if (trimmed.startsWith('name:') && indent === 0) {
      schema.name = trimmed.slice(5).trim();
      continue;
    }

    // Detect properties array start
    if (trimmed === 'properties:' && indent === 0) {
      inProperties = true;
      inOptions = false;
      inVersions = false;
      continue;
    }

    // Parse version items first (must check before property items to avoid confusion)
    // Version items are deeper inside options
    if (inVersions && trimmed.startsWith('- name:') && indent > versionsIndent) {
      const versionName = trimmed.slice(7).trim();
      currentProperty.options.versions.push({ name: versionName });
      continue;
    }

    // Parse property list items (starts with "- name:")
    // Only match at the property level, not deeper inside versions
    if (inProperties && trimmed.startsWith('- name:') && (!inVersions || indent <= versionsIndent)) {
      // Save previous property if exists
      if (currentProperty) {
        schema.properties.push(currentProperty);
      }
      currentProperty = {
        name: trimmed.slice(7).trim(),
        type: 'string' // default
      };
      propertyIndent = indent;
      inOptions = false;
      inVersions = false;
      continue;
    }

    // Parse property type (at property indent level + 2 or more)
    if (currentProperty && !inVersions && trimmed.startsWith('type:') && indent > propertyIndent) {
      currentProperty.type = trimmed.slice(5).trim();
      continue;
    }

    // Detect options section
    if (currentProperty && trimmed === 'options:' && indent > propertyIndent) {
      currentProperty.options = {};
      inOptions = true;
      optionsIndent = indent;
      inVersions = false;
      continue;
    }

    // Detect versions array in options
    if (inOptions && trimmed === 'versions:' && indent > optionsIndent) {
      currentProperty.options.versions = [];
      inVersions = true;
      versionsIndent = indent;
      continue;
    }

    // Check if we've left versions section (indent went back)
    if (inVersions && indent <= versionsIndent && !trimmed.startsWith('- ')) {
      inVersions = false;
    }

    // Check if we've left options section
    if (inOptions && indent <= optionsIndent && trimmed !== 'versions:') {
      // If this is a new property definition, let the next iteration handle it
      if (trimmed.startsWith('- name:')) {
        inOptions = false;
        inVersions = false;
        // Re-process this line
        i--;
        continue;
      }
    }

    // Parse content_length option (simple key: value in options)
    if (inOptions && !inVersions && trimmed.includes(':') && indent > optionsIndent) {
      const colonIdx = trimmed.indexOf(':');
      const key = trimmed.slice(0, colonIdx).trim();
      const value = trimmed.slice(colonIdx + 1).trim();
      if (key && value) {
        currentProperty.options[key] = isNaN(value) ? value : Number(value);
      }
    }
  }

  // Don't forget the last property
  if (currentProperty) {
    schema.properties.push(currentProperty);
  }

  return schema;
}

/**
 * Load a single schema by table name
 * @param {string} tableName - The schema/table name (without .yml extension)
 * @param {string} appPath - Path to the app directory (default: '.')
 * @returns {Object|null} Schema object or null if not found
 */
export function loadSchema(tableName, appPath = '.') {
  const searchPaths = [
    path.join(appPath, 'app', 'schema', `${tableName}.yml`),
    path.join(appPath, 'app', 'model_schemas', `${tableName}.yml`)
  ];

  for (const schemaPath of searchPaths) {
    if (fs.existsSync(schemaPath)) {
      try {
        const content = fs.readFileSync(schemaPath, 'utf8');
        return parseSchemaYaml(content);
      } catch (e) {
        // File exists but couldn't be parsed
        return null;
      }
    }
  }

  return null;
}

/**
 * Load all schemas from the app directory
 * @param {string} appPath - Path to the app directory (default: '.')
 * @returns {Map<string, Object>} Map of schema name to schema object
 */
export function loadAllSchemas(appPath = '.') {
  const schemas = new Map();
  const searchDirs = [
    path.join(appPath, 'app', 'schema'),
    path.join(appPath, 'app', 'model_schemas')
  ];

  for (const dir of searchDirs) {
    if (fs.existsSync(dir)) {
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (file.endsWith('.yml') || file.endsWith('.yaml')) {
            const schemaPath = path.join(dir, file);
            try {
              const content = fs.readFileSync(schemaPath, 'utf8');
              const schema = parseSchemaYaml(content);
              if (schema.name) {
                schemas.set(schema.name, schema);
              }
            } catch (e) {
              // Skip files that can't be parsed
            }
          }
        }
      } catch (e) {
        // Directory exists but couldn't be read
      }
    }
  }

  return schemas;
}

/**
 * Get version names from a schema property with upload type
 * @param {Object} property - Schema property object
 * @returns {string[]} Array of version names
 */
export function getUploadVersions(property) {
  if (property.type !== 'upload') return [];
  if (!property.options?.versions) return [];
  return property.options.versions.map(v => v.name);
}

export { parseSchemaYaml };

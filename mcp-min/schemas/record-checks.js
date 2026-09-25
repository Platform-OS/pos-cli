/**
 * The record-checking parameters `data-validate` and `data-import` share; both run the same
 * validator over the same files. Defaults are declared, never restated in a description —
 * `__tests__/tool-descriptions.test.js` forbids the second copy.
 */
const recordCheckProperties = {
  appPath: { type: 'string', description: 'Project directory holding the schema files.', default: '.' },
  strictTypes: { type: 'boolean', description: 'Fail when a value does not match its schema type.', default: true },
  strictProperties: { type: 'boolean', description: 'Fail on properties the schema does not define.', default: false }
};

export { recordCheckProperties };
export default recordCheckProperties;

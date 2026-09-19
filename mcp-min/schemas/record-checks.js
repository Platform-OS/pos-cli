/**
 * How records are checked against the project's schema files, shared by `data-validate`, which
 * only checks, and `data-import`, which checks and then imports.
 *
 * The two run the same validator (`mcp-min/data/validate.js`) over the same files, so describing
 * these three separately invites the wordings to drift apart and says the same thing twice in
 * every `tools/list`. The defaults are declared rather than described: both handlers apply these
 * exact values, and a description that restates one is a second copy that goes stale silently
 * (`__tests__/tool-descriptions.test.js` forbids it).
 */
const recordCheckProperties = {
  appPath: { type: 'string', description: 'Project directory holding the schema files.', default: '.' },
  strictTypes: { type: 'boolean', description: 'Fail when a value does not match its schema type.', default: true },
  strictProperties: { type: 'boolean', description: 'Fail on properties the schema does not define.', default: false }
};

export { recordCheckProperties };
export default recordCheckProperties;

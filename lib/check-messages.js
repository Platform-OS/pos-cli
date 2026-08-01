/**
 * Message text shared by everything that loads @platformos/platformos-check-node.
 *
 * Deliberately a leaf module with no imports: lib/check-worker.js runs on a worker
 * thread, which has its own module registry, so importing this from lib/check.js
 * instead would re-evaluate that whole graph (ora, chalk, YAML, logger) on the worker
 * for a single string — about 100ms on every `pos-cli check run`.
 */
const MISSING_PACKAGE_MESSAGE =
  'The @platformos/platformos-check-node package is not installed.\n' +
  'Install it with: npm install @platformos/platformos-check-node';

export { MISSING_PACKAGE_MESSAGE };

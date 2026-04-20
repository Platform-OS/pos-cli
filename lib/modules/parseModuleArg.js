import semver from 'semver';

/**
 * Splits "module-name@version" into [name, version].
 * Handles scoped packages (@scope/name@version) by splitting on the last '@'
 * only when it is not the leading character.
 *
 * Examples:
 *   parseModuleArg('core@2.0.0')          → ['core', '2.0.0']
 *   parseModuleArg('core')                 → ['core', undefined]
 *   parseModuleArg('@scope/name@1.0.0')   → ['@scope/name', '1.0.0']
 *   parseModuleArg('@scope/name')          → ['@scope/name', undefined]
 */
const parseModuleArg = (moduleNameWithVersion) => {
  const atIdx = moduleNameWithVersion.lastIndexOf('@');
  if (atIdx > 0) {
    const version = moduleNameWithVersion.slice(atIdx + 1);
    return [moduleNameWithVersion.slice(0, atIdx), version || undefined];
  }
  return [moduleNameWithVersion, undefined];
};

/**
 * Parses "module-name@version" and throws if the version is not a valid semver range.
 * Returns [moduleName, moduleVersion] — same shape as parseModuleArg.
 */
const parseAndValidateModuleArg = (moduleNameWithVersion) => {
  const [moduleName, moduleVersion] = parseModuleArg(moduleNameWithVersion);
  if (moduleVersion !== undefined && semver.validRange(moduleVersion) === null) {
    throw new Error(
      `Invalid version or range: "${moduleVersion}". ` +
      `Use a valid semver version (e.g. "1.2.3") or range (e.g. "^1.0.0").`
    );
  }
  return [moduleName, moduleVersion];
};

export { parseModuleArg, parseAndValidateModuleArg };

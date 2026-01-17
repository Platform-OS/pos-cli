import flatten from 'lodash.flatten';
import uniq from 'lodash.uniq';
import semver from 'semver';
import logger from '../logger.js';

const resolveBestVersion = async (dependencyList, getVersions, topLevelModulesRequirments) => {
  const dependenciesNames = uniq(dependencyList.map(dep => Object.keys(dep)[0]));
  if(dependenciesNames.length === 0) return {};
  const versions = await getVersions(dependenciesNames);

  const dependenciesVersions = dependenciesNames.map(depName => {
    const versionsAvailable = Object.keys(versions.find(m => m.module === depName)?.versions || {});
    let versionsRequested = [];
    if (topLevelModulesRequirments[depName]) {
      versionsRequested = [topLevelModulesRequirments[depName]];
    } else {
      versionsRequested = dependencyList
        .filter(dep => Object.keys(dep)[0] === depName)
        .map(dep => Object.values(dep)[0]);
    }

    const versionsMaxSatisfying = versionsRequested.map(version => semver.maxSatisfying(versionsAvailable, version));
    const depBestVersion = versionsMaxSatisfying.sort(semver.compare)[0];
    return [depName, depBestVersion];
  });

  return Object.fromEntries(dependenciesVersions);
};

const resolveDependencies = async (modules, getVersions, rootModules) => {
  if(!rootModules) rootModules = modules;
  if(Object.keys(modules).length === 0) return {}

  const deps = Object.assign({}, modules);
  const modulesNames = Object.keys(modules);
  const modulesVersions = await getVersions(modulesNames);
  logger.Debug(`modulesVersions: ${JSON.stringify(modulesVersions)}`);
  const dependenciesList = flatten(
    modulesVersions.map(module => {
      const versionName = modules[module.module];
      const version = module.versions[versionName];
      if(!version) throw new Error(`Can't find any version for module ${module.module}`);

      return Object.entries(version.dependencies).map(dependency=> {
        const [dependencyName, dependencyVersion] = dependency;
        return { [dependencyName]: dependencyVersion };
      });
    })
  );
  const dependenciesVersions = await resolveBestVersion(dependenciesList, getVersions, rootModules);
  const dependenciesDependencies = await resolveDependencies(dependenciesVersions, getVersions, rootModules);

  return {...{...deps, ...dependenciesVersions}, ...dependenciesDependencies};
}

const findModuleVersion = async (moduleName, moduleVersion, getVersions) => {
  const modules = await getVersions([moduleName]);
  logger.Debug(`find modulesVersions: ${JSON.stringify(modules)}`);
  const versions = Object.keys(modules.find(m => m.module === moduleName)?.versions || {});
  let version;
  if(moduleVersion){
    version = versions.find(v => v === moduleVersion);
  } else {
    version = versions
      .filter(version => !semver.prerelease(version))
      .sort(semver.compare).slice(-1)[0];
  }

  if(version){
    return { [moduleName]: version };
  } else {
    return null;
  }
}

export { resolveDependencies, findModuleVersion };

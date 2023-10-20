const flatten = require('lodash.flatten');
const uniq = require('lodash.uniq');
const semver = require('semver');
const logger = require('../logger');

const resolveBestVersion = async (dependencyList, getVersions) => {
  const dependenciesNames = uniq(dependencyList.map(dep => Object.keys(dep)[0]));
  if(dependenciesNames.length === 0) return {};
  const versions = await getVersions(dependenciesNames);
  const dependenciesVersions = dependenciesNames.map(depName => {
    const versionsAvailable = Object.keys(versions.find(m => m.module === depName)?.versions || {});
    const versionsRequested = dependencyList
      .filter(dep => Object.keys(dep)[0] === depName)
      .map(dep => Object.values(dep)[0]);

    const versionsMaxSatisfying = versionsRequested.map(version => semver.maxSatisfying(versionsAvailable, version));
    const depBestVersion = versionsMaxSatisfying.sort(semver.compare)[0];
    return [depName, depBestVersion];
  });
  return Object.fromEntries(dependenciesVersions);
};

const resolveDependencies = async (modules, getVersions) => {
  if(Object.keys(modules).length === 0) return {}

  const deps = Object.assign({}, modules);
  const modulesNames = Object.keys(modules);
  const modulesVersions = await getVersions(modulesNames);
  logger.Debug(`modulesVersions: ${JSON.stringify(modulesVersions)}`);
  const dependenciesList = flatten(
    modulesVersions.map(module => {
      const version = module.versions[modules[module.module]];
      if(!version) throw new Error(`Can't find any version for module ${module.module}`);

      return Object.entries(version.dependencies).map(dependency=> {
        const [dependencyName, dependencyVersion] = dependency;
        return { [dependencyName]: dependencyVersion };
      });
    })
  );
  const dependenciesVersions = await resolveBestVersion(dependenciesList, getVersions);
  const dependenciesDependencies = await resolveDependencies(dependenciesVersions, getVersions);

  return {...{...deps, ...dependenciesVersions}, ...dependenciesDependencies};
}

const findModuleVersion = async (moduleName, moduleVersion, getVersions) => {
  const modules = await getVersions([moduleName]);
  const versions = Object.keys(modules.find(m => m.module === moduleName)?.versions || {});
  let version;
  if(moduleVersion){
    version = versions.find(v => v === moduleVersion);
  } else {
    version = versions.sort(semver.compare).slice(-1)[0];
  }

  if(version){
    return { [moduleName]: version };
  } else {
    return null;
  }
}

module.exports = {
  resolveDependencies: resolveDependencies,
  findModuleVersion: findModuleVersion
};

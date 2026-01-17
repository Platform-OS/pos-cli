const dependencies = require('../../../lib/modules/dependencies');
const isEqual = require('lodash.isequal');

test('resolveDependencies ok', async () => {
  const core = {"module":"core","versions":{"1.0.0":{"dependencies":{}}, "1.5.0":{"dependencies":{}}, "1.6.0":{"dependencies":{}}, "1.8.0":{"dependencies":{}}}};
  const modulesVersions = async (modulesNames) => {
    if(isEqual(modulesNames, ['payments_stripe', 'tests', 'a'])) {
      return [
        {"module":"payments_stripe","versions":{"1.0.6":{"dependencies":{"payments":"^1.0.0", "core":"^1.0.0"}}}},
        {"module":"tests","versions":{"1.0.7":{"dependencies":{"core":"^1.5.0"}}}},
        {"module":"a","versions":{"1.0.0":{"dependencies":{"b":"1.0.0"}}}}
      ];
    } else if(isEqual(modulesNames, ['payments', 'core', 'b'])){
      return [
        {"module":"payments","versions":{"1.0.0":{"dependencies":{"core":"1.6.0"}}}},
        {"module":"b","versions":{"1.0.0":{"dependencies":{"c":"1.0.0"}}}}
      ].concat(core);
    } else if(isEqual(modulesNames, ['core', 'c'])){
      return [
        {"module":"c","versions":{"1.0.0":{"dependencies":{}}}}
      ].concat(core);
    }
    throw new Error(`Unexpected modulesNames: ${JSON.stringify(modulesNames)}`);
  };
  const rootModules = {
    "payments_stripe": "1.0.6",
    "tests": "1.0.7",
    "a": "1.0.0"
  };

  const data = await dependencies.resolveDependencies(rootModules, modulesVersions);

  expect(data).toEqual(
    {
      "payments_stripe": "1.0.6",
      "tests": "1.0.7",
      "payments": "1.0.0",
      "core": "1.6.0",
      "a": "1.0.0",
      "b": "1.0.0",
      "c": "1.0.0",
    }
  );
});

test('resolveDependencies do not use newest available version but the one defined in root', async () => {
  const core = {"module":"core","versions":{"1.6.0":{"dependencies":{}}, "1.6.1":{"dependencies":{}}, "1.8.0":{"dependencies":{}}}};
  const tests = {"module":"tests","versions":{"1.0.7":{"dependencies":{"core":"^1.6.0"}}}}
  const modulesVersions = async (modulesNames) => {
    if(isEqual(modulesNames, ['tests', 'core'])) {
      return [tests, core];
    } else if(isEqual(modulesNames, ['tests'])) {
      return [tests];
    } else if(isEqual(modulesNames, ['core'])) {
      return [core]
    }
    throw new Error(`Unexpected modulesNames: ${JSON.stringify(modulesNames)}`);
  };
  const rootModules = {
    "tests": "1.0.7",
    "core": "1.6.1"
  };

  const data = await dependencies.resolveDependencies(rootModules, modulesVersions, rootModules);

  expect(data).toEqual(
    {
      "tests": "1.0.7",
      "core": "1.6.1"
    }
  );
});


test('find module with newest version', async () => {
  const modulesVersions = async (modulesNames) => {
    return [{"module":"core","versions":{"1.0.0":{"dependencies":{}}, "1.5.0":{"dependencies":{}}}}];
  };

  const data = await dependencies.findModuleVersion("core", null, modulesVersions);

  expect(data).toEqual({ "core": "1.5.0" });
});

test('find module with newest stable version', async () => {
  const modulesVersions = async (modulesNames) => {
    return [{"module":"core","versions":{"1.0.0":{"dependencies":{}}, "1.5.0":{"dependencies":{}}, "1.5.1-beta.1":{"dependencies":{}}}}];
  };

  const data = await dependencies.findModuleVersion("core", null, modulesVersions);

  expect(data).toEqual({ "core": "1.5.0" });
});

test('find module with requested version', async () => {
  const modulesVersions = async (modulesNames) => [{"module":"core","versions":{"1.0.0":{"dependencies":{}}, "1.5.0":{"dependencies":{}}}}];

  const data = await dependencies.findModuleVersion("core", "1.0.0", modulesVersions);

  expect(data).toEqual({ "core": "1.0.0" });
});

test('find module with requested version even if it is beta', async () => {
  const modulesVersions = async (modulesNames) => [{"module":"core","versions":{"1.0.0-beta.1":{"dependencies":{}}, "1.5.0":{"dependencies":{}}}}];

  const data = await dependencies.findModuleVersion("core", "1.0.0-beta.1", modulesVersions);

  expect(data).toEqual({ "core": "1.0.0-beta.1" });
});

test('can not find module with requested version', async () => {
  const modulesVersions = async (modulesNames) => [{"module":"core","versions":{"1.0.0":{"dependencies":{}}, "1.5.0":{"dependencies":{}}}}];

  const data = await dependencies.findModuleVersion("core", "1.0.1", modulesVersions);

  expect(data).toEqual(null);
});


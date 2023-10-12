const dependencies = require('../../../lib/modules/dependencies');
const isEqual = require('lodash.isequal');

test('returns empty hash if there is a problem loading configuration file', () => {
  const core = {"module":"core","versions":{"1.0.0":{"dependencies":{}}, "1.5.0":{"dependencies":{}}, "1.6.0":{"dependencies":{}}, "1.8.0":{"dependencies":{}}}};
  const modulesVersions = (modulesNames) => {
    // console.log('hit');
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
    console.log('dont know', modulesNames);
  };
  const rootModules = {
    "payments_stripe": "1.0.6",
    "tests": "1.0.7",
    "a": "1.0.0"
  };

  const data = dependencies.resolveDependencies(rootModules, modulesVersions);

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


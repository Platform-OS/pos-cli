// Builds a module fixture object in the shape returned by Portal.moduleVersions.
//   mod('core', { '1.0.0': {}, '2.0.0': { dep: '^1.0.0' } })
const mod = (name, versions) => ({
  module: name,
  versions: Object.fromEntries(
    Object.entries(versions).map(([v, deps = {}]) => [v, { dependencies: deps }])
  )
});

// Returns a getVersions mock that resolves names against the provided module fixtures.
// Names absent from the list return no entry (simulates "not in registry").
const makeRegistry = (...modules) => {
  const map = Object.fromEntries(modules.map(m => [m.module, m]));
  return async (names) => names.map(n => map[n]).filter(Boolean);
};

export { mod, makeRegistry };

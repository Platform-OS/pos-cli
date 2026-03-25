const formatModulesDiff = (previousModules, newModules) => {
  const allNames = new Set([...Object.keys(previousModules), ...Object.keys(newModules)]);
  const lines = [];

  for (const name of [...allNames].sort()) {
    const prev = previousModules[name];
    const next = newModules[name];

    if (!prev)           lines.push(`  + ${name}@${next}`);
    else if (!next)      lines.push(`  - ${name}@${prev}`);
    else if (prev !== next) lines.push(`  ~ ${name}: ${prev} → ${next}`);
  }

  return lines;
};

export { formatModulesDiff };

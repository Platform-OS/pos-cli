/**
 * The generator a call names, shared by `generators-help`, which reads one, and `generators-run`,
 * which runs it.
 *
 * Both take the same value — a path as `generators-list` prints it — so it is one object rather
 * than the same sentence typed twice, the way `authProperties` is.
 */
const generatorPathProperty = {
  type: 'string',
  description: 'Path from generators-list, like modules/core/generators/page.'
};

export { generatorPathProperty };
export default generatorPathProperty;

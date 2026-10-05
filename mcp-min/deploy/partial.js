/**
 * `partial` for `deploy-start` and `deploy-dry-run`, defined once: a preview whose default differs
 * from the deploy's would report deletions that the deploy it describes would never make.
 *
 * `true`, where `pos-cli deploy` defaults to the deleting mode. The two surfaces differ on purpose:
 * a person running the CLI has the project in front of them and a shell to put things back with,
 * and an agent reached through these tools has neither. Measured 2026-10-01 in an agent evaluation
 * — told to keep what was live, an agent deployed by omission and destroyed two pages it had never
 * discovered, with the description warning of exactly that.
 *
 * Deleting is still one argument away. What changed is which of the two you get by not deciding.
 */
export const partialProperty = (description) => ({ type: 'boolean', description, default: true });

/** Only an explicit `false` is the deleting mode: omission must never be. */
export const partialOf = (params) => params?.partial !== false;

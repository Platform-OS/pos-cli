#!/usr/bin/env node
'use strict';
/**
 * Diagnostics from the platformOS language server are pull-only: the server analyses a file when
 * something makes an LSP request against it, and publishes the findings asynchronously. Reading or
 * editing a file triggers nothing, so an agent can write a broken partial call and never hear about
 * it. This prints one line after a Liquid or GraphQL edit saying how to ask.
 *
 * It deliberately runs nothing. Linting the file here costs 57 s on a real project
 * (`pos-cli check run` is whole-project only), and spawning a throwaway language server costs about
 * 4 s per edit — both paid on every write. Asking the server that is already running costs nothing,
 * so this only says so.
 */
// Case-insensitive, because Claude Code lowercases extensions when it builds its own
// extension-to-language map: a .LIQUID file is handled by the language server, so staying
// silent about one would disagree with it. The leading character stops a dotfile named
// exactly `.liquid` from matching.
const EXTENSIONS = /[^/\\]\.(liquid|graphql)$/i;

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
  let hook;
  // A hook must never fail the tool call that triggered it: no input, or input in a shape this
  // version does not know, simply means there is nothing to say.
  try {
    hook = JSON.parse(raw);
  } catch {
    return;
  }

  const filePath = hook?.tool_input?.file_path ?? hook?.tool_input?.path ?? hook?.tool_input?.filePath;
  if (typeof filePath !== 'string' || !EXTENSIONS.test(filePath)) return;

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext:
        `platformOS: ${filePath} edited. No tool reports its diagnostics — one LSP call ` +
        '(hover or goToDefinition, the only ones this server answers) makes the server analyse ' +
        'it, and the findings arrive on their own with a later tool result. Fix errors first.'
    }
  }));
});

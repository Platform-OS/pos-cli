<!-- ================================================================== -->
<!--
  Single renderer for a log-table row. Shows a type label, the message, and (when
  the entry carries a structured diagnostic / log payload) the source span, the
  include/render stack (innermost-first, collapsed by default) and request context.

  - type:     the error class (data.type) for errors, else the log's own type
              (error_type), else 'Log'.
  - message:  the bare message (data.message) for errors, else the row's message
              (the {% log %} value); JSON values render as a tree.
  - errors get the danger accent; logs are neutral.
-->
<script>

import { isStructuredDiagnostic, displayType, frameLabel } from '$lib/diagnostics.js';
import { tryParseJSON } from '$lib/tryParseJSON.js';
import JSONTree from '$lib/ui/JSONTree.svelte';

// the full log-table row ({ error_type, message, data, ... })
export let log;

const maxMessageLength = 262144;
let showFull = false;

$: data = log.data || {};
$: structured = isStructuredDiagnostic(data);
$: isError = !!data.type;
$: type = displayType(log);
// errors carry the bare message in data.message; logs use the row's message.
$: messageText = data.message != null ? String(data.message) : (log.message == null ? '' : String(log.message));
$: parsedMessage = messageText.length < maxMessageLength && tryParseJSON(messageText);
$: stack = structured && Array.isArray(data.stack) ? data.stack : [];
$: location = frameLabel(stack[0]);
$: context = (structured && data.context) || {};

</script>


<!-- ================================================================== -->
<style>

.diagnostic {
  /* neutral by default ({% log %}); errors get the danger accent */
  border-inline-start: 3px solid var(--color-frame);
  padding: .25rem 0 .25rem 1rem;

  display: flex;
  flex-direction: column;
  gap: .6rem;
}

.diagnostic.isError {
  border-inline-start-color: var(--color-danger);
}

.header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: .5rem 1rem;
}

.type {
  font-family: monospace;
  font-weight: 600;
}

.isError .type {
  color: var(--color-danger);
}

.location {
  font-family: monospace;
  font-size: .9em;
  color: var(--color-text-secondary);
  word-break: break-all;
}

.message {
  word-break: break-word;
}

.message.pre {
  white-space: pre-wrap;
}

.longStringInfo button {
  cursor: pointer;
  font-size: .9em;
  color: var(--color-text-secondary);
}

.source {
  margin: 0;
  padding: .5rem .75rem;

  background-color: rgba(var(--color-rgb-background), .5);
  border: 1px solid var(--color-frame);
  border-radius: 4px;

  font-family: monospace;
  font-size: .9em;
  white-space: pre-wrap;
  word-break: break-all;
}

.meta {
  font-size: .9em;
  color: var(--color-text-secondary);
}

.stack summary {
  cursor: pointer;
  width: fit-content;
  list-style: none;
}

.stack summary::-webkit-details-marker {
  display: none;
}

.stack summary:hover {
  color: var(--color-interaction-hover);
}

.stack ol {
  margin: .35rem 0 0;
  padding-inline-start: .75rem;
  list-style: none;
}

.stack li {
  list-style: none;
  font-family: monospace;
  word-break: break-all;
}

.context {
  display: flex;
  flex-direction: column;
  gap: .15rem;
}

.context a:hover {
  color: var(--color-interaction-hover);
}

</style>


<!-- ================================================================== -->
<div class="diagnostic" class:isError>

  <div class="header">
    <span class="type">{type}</span>
    {#if location}<span class="location">{location}</span>{/if}
  </div>

  {#if parsedMessage}
    <JSONTree value={parsedMessage} showFullLines={true} />
  {:else if messageText}
    <div class="message pre">
      {#if showFull || messageText.length <= maxMessageLength}
        {messageText}
      {:else}
        {messageText.substr(0, maxMessageLength)}
        <span class="longStringInfo">
          <button type="button" on:click={() => showFull = true}>
            {messageText.length - maxMessageLength} more characters
          </button>
        </span>
      {/if}
    </div>
  {/if}

  {#if data.source_span}
    <pre class="source">{data.source_span}</pre>
  {/if}

  {#if stack.length > 1}
    <details class="meta stack">
      <summary>Show full stack ({stack.length} frames)</summary>
      <ol>
        {#each stack as frame}
          <li>{frameLabel(frame)}</li>
        {/each}
      </ol>
    </details>
  {/if}

  {#if context.url || context.user}
    <div class="meta context">
      {#if context.url}<span>url: {context.url}</span>{/if}
      {#if context.user}<span>user: <a href="/users/{context.user.id}">{context.user.email || context.user.id}</a></span>{/if}
    </div>
  {/if}

</div>

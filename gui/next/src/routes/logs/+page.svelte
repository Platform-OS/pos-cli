<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { tick, afterUpdate, onMount, beforeUpdate } from 'svelte';
import { fade } from 'svelte/transition';
import { quintOut } from 'svelte/easing';
import { browser } from '$app/environment';
import { state } from '$lib/state.js';

import { tryParseJSON } from '$lib/tryParseJSON.js';
import JSONTree from '$lib/ui/JSONTree.svelte';

import Icon from '$lib/ui/Icon.svelte';


// properties
// ------------------------------------------------------------------------
// main content container (dom node)
let container;
// string used for filtering (string)
let filter = '';
// pinned logs (array of objects)
let pinned = [];
// if the pinned pannel should be visible (bool)
let pinnedPanel;
// max number of characters to show and parse in a message (int)
let maxMessageLength = 262144;


// purpose:		adds a .hidden property to each log item if not matching the string
// attributes:	string you want to filter the logs with (string)
// ------------------------------------------------------------------------
const isFiltered = (log) => {
  if(log.hidden === true){
    return true;
  }

  if(log.error_type.toLowerCase().indexOf(filter) === -1 && log.message.toLowerCase().indexOf(filter) === -1){
    return true;
  } else {
    return false;
  }
};


// purpose:		scroll to bottom on load and when new logs appear and the scrollbar position is on bottom
// ------------------------------------------------------------------------
let scrolled = false;

beforeUpdate(() => {
  if(browser){
    const container = document.querySelector('.logs');

    if(container && Math.abs(container.scrollHeight - container.scrollTop - container.clientHeight) < 10){
      scrolled = false;
    }
  }
});

afterUpdate(async () => {
  if(!scrolled){
    await tick();
    document.querySelector('footer').scrollIntoView();
    if($state.logs.logs?.length){
      scrolled = true;
    }
  }
});


// purpose:		saves the log in localStorage for future use
// attributes:	log data you want to save (object)
// ------------------------------------------------------------------------
onMount(() => {
  pinnedPanel = localStorage.pinnedPanel === 'true' ? true : false;
  pinned = localStorage.pinnedLogs ? JSON.parse(localStorage.pinnedLogs) : [];
});

const pin = (log) => {
  if(pinned.find(pin => pin.id === log.id)){
    pinned = pinned.filter(pin => pin.id !== log.id);
  } else {
    pinned = [...pinned, log];
  }
  localStorage.pinnedLogs = JSON.stringify(pinned);
};

const togglePinnedPanel = () => {
  if(pinnedPanel){
    pinnedPanel = false;
    localStorage.pinnedPanel = false;
  } else {
    pinnedPanel = true;
    localStorage.pinnedPanel = true;
  }
};


// transition: 	slides from right
// options: 	delay (int), duration (int)
// ------------------------------------------------------------------------
const appear = function(node, {
  delay = 0,
  duration = 150
}){
  return {
    delay,
    duration,
    css: (t) => {
      const eased = quintOut(t);

      return `width: ${500 * eased}px;` }
  }
};

</script>


<!-- ================================================================== -->
<style>

/* shared */
.container {
  width: 100%;
  display: flex;
}

nav {
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;

  border-bottom: 1px solid var(--color-frame);
  background-color: rgba(var(--color-rgb-background), .8);
  backdrop-filter: blur(17px);
  -webkit-backdrop-filter: blur(17px);
}

nav > div {
  display: flex;
  align-items: center;
  gap: .5rem;
}


/* logs navigation */
.logs nav {
  position: sticky;
  top: 0;
  left: 0;
  z-index: 10;
}

.logs nav input {
  padding-inline-end: 2rem;
}

.clearFilter {
  padding: .5rem;
  position: relative;
  left: -2.3rem;

  cursor: pointer;
}

.clearFilter .label {
  position: absolute;
  left: -100vw;
}

.clearFilter:hover {
  color: var(--color-interaction);
}


/* logs */
.logs {
  height: calc(100vh - 82px);
  overflow: auto;
  position: sticky;

  flex-grow: 1;
}

table {
  width: 100%;
}

  .fresh td {
    background-color: var(--color-highlight);
  }

  .hidden {
    display: none;
  }

  td {
    padding: 1rem;

    border-block-end: 1px solid var(--color-frame);
  }

    td:not(:first-child):not(:last-child) {
      padding-inline-start: 2rem;
      padding-inline-end: 2rem;
    }

  .date {
    width: 1px;
    white-space: nowrap;
  }

  .logType {
    min-width: 20ch;
    max-width: 40ch;
    word-break: break-all;
  }

    .date,
    .logType {
      font-family: monospace;
      font-size: 1rem;
    }

    .error time,
    .error .logType {
      color: var(--color-danger);
    }

  .logs .message {
    word-break: break-all;
  }

    .longStringInfo button {
      cursor: pointer;

      font-size: .9em;
      color: var(--color-text-secondary);
    }

  .pre {
    white-space: pre-wrap;
  }

  .logs .info {
    margin-block-start: 1rem;

    font-size: .9em;
    color: var(--color-text-secondary);
  }

    .logs .info a:hover {
      color: var(--color-interaction-hover);
    }

  .actions {
    width: 1px;
    vertical-align: top;
  }

  .actions div {
    display: flex;
    gap: .5em;
  }

  .actions .active.button {
    opacity: 1;

    color: var(--color-interaction);
  }

  .actions .button {
    opacity: 0;

    transition: all .1s linear;
  }

  tr:hover .actions button {
    opacity: 1;
  }


/* footer */
footer {
  margin-block: 4rem;

  text-align: center;
  line-height: 1.5em;
  color: var(--color-text-secondary);
}


/* pinned logs panel */
.pins {
  width: 500px;
  flex-shrink: 0;
  overflow: hidden;
  position: sticky;
  top: 82px;
}

.pins > div {
  width: 500px;
  height: calc(100vh - 82px);
  overflow: auto;
  overflow-x: hidden;

  border-inline-start: 1px solid var(--color-frame);
}


/* pinned logs panel */
.pins nav {
  justify-content: flex-end;
}

.pins li {
  padding: 1rem;
}

.pins li + li {
  border-block-start: 1px solid var(--color-frame);
}

.pins .date {
  margin-block-end: .6em;
  display: block;
}

.pins .info {
  display: flex;
  justify-content: space-between;
  gap: 1rem;

  color: var(--color-text-secondary);
}

  .pins .info button {
    transition: color .1s linear;
  }

  .pins .info button:hover {
    color: var(--color-danger);
  }

.pins .url {
  margin-block-start: -.5em;
  margin-block-end: .6rem;

  word-wrap: break-word;
  font-size: .9em;
  color: var(--color-text-secondary);
}

.pins .message {
  word-wrap: break-word;
}

</style>



<!-- ================================================================== -->
<svelte:head>
  <title>Logs | platformOS</title>
</svelte:head>


<div class="container" bind:this={container}>

  <section class="logs">

    <nav>
      <form>
        <label for="filter">Filter:</label>
        <input type="text" id="filter" bind:value={filter}>
        {#if filter}
          <button class="clearFilter" on:click={() => filter = ''}>
            <span class="label">Clear filter</span>
            <Icon icon="x" size=12 />
          </button>
        {/if}
      </form>
      <div>
        <button type="button" class="button" on:click={() => $state.logs.logs.forEach((log, index) => $state.logs.logs[index].hidden = true) }>Clear screen</button>
        <button type="button" title="Toggle pinned logs panel" class="button" on:click={togglePinnedPanel}>
          <span class="label">Toggle pinned logs panel</span>
          <Icon icon="pin" />
        </button>
      </div>
    </nav>

    {#if $state.logs.logs}
      <table>
        {#each $state.logs.logs as log}
          {@const message = log.message.length < 262144 && tryParseJSON(log.message)}
          <tr
            class:hidden={filter && isFiltered(log) || log.hidden}
            class:error={log.error_type.match(/error/i)}
            class:fresh={log.downloaded_at > $state.logs.downloaded_at[0]}
            in:fade|local={{ duration: 200 }}
          >
            <td class="date">
              <time datetime={log.created_at}>
                {(new Date(log.created_at)).toLocaleDateString(undefined, {})}
                {(new Date(log.created_at)).toLocaleTimeString(undefined, {})}
              </time>
            </td>
            <td class="logType">
              {log.error_type}
            </td>
            <td class="message">
              {#if message}
                <JSONTree value={message} showFullLines={true} />
              {:else}
                <div class="pre">
                  {#if log.showFull}
                    {log.message}
                  {:else}
                    {log.message.substr(0, maxMessageLength)}

                    {#if log.message.length > maxMessageLength}
                      <div class="longStringInfo">
                        <button type="button" on:click={() => log.showFull = true}>
                          {log.message.length - maxMessageLength} more characters
                        </button>
                      </div>
                    {/if}
                  {/if}
                </div>
              {/if}

              {#if log.data?.url}
                <ul class="info">
                  <li>Page: {log.data.url}</li>
                  {#if log.data.user}
                    <li>User ID: <a href="/users/{log.data.user.id}">{log.data.user.id}</a></li>
                  {/if}
                </ul>
              {/if}
            </td>
            <td class="actions">
              <div>
                <button type="button" class="button" title="Copy message" on:click={(event) => navigator.clipboard.writeText(log.message).then(() => { event.target.classList.add('confirmation'); setTimeout(() => event.target.classList.remove('confirmation'), 1000); }) }>
                  <span class="label">Copy message</span>
                  <Icon icon="copy" />
                </button>
                <button type="button" class="button" title="Pin this log" class:active={pinned.find(pin => pin.id === log.id)} on:click|preventDefault={() => pin(log)}>
                  <span class="label">Pin this log</span>
                  <Icon icon="pin" />
                </button>
              </div>
            </td>
          </tr>
        {/each}
      </table>
    {/if}

    {#if !filter}
      <footer>
        No newer logs to show<br>Checking every 7 seconds
      </footer>
    {/if}

  </section>


  {#if pinnedPanel}
    <section class="pins" transition:appear>
      <div>

        <nav>
          <button type="button" class="button" on:click={() => { localStorage.pinnedLogs = []; pinned = []; }}>
            Clear pinned logs
          </button>
        </nav>

        {#if pinned}
          <ul>
            {#each pinned as log}
              {@const message = log.message.length < 262144 && tryParseJSON(log.message)}
              <li>
                <div class="info">
                  <time class="date" datetime={log.created_at}>
                    {(new Date(log.created_at)).toLocaleDateString(undefined, {})}
                    {(new Date(log.created_at)).toLocaleTimeString(undefined, {})}
                  </time>
                  <button type="button" title="Remove log from pinned panel" on:click={() => pin(log)}>
                    <span class="label">Remove log from pinned panel</span>
                    <Icon icon="trash" size="18" />
                  </button>
                </div>
                {#if log.data?.url}
                  <div class="url">
                    {log.data.url}
                  </div>
                {/if}
                <div class="message">
                  {#if message}
                    <JSONTree value={message} showFullLines={true} />
                  {:else}
                    <div class="pre">
                      {#if log.showFull}
                        {log.message}
                      {:else}
                        {log.message.substr(0, maxMessageLength)}

                        {#if log.message.length > maxMessageLength}
                          <button type="button" on:click={() => log.showFull = true}>
                            {log.message.length - maxMessageLength} more characters
                          </button>
                        {/if}
                      {/if}
                    </div>
                  {/if}
                </div>
              </li>
            {/each}
          </ul>
        {/if}

      </div>
    </section>
  {/if}

</div>

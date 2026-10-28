<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { onMount } from 'svelte';
import { fade } from 'svelte/transition';
import { browser } from '$app/environment';
import { connectionState } from '#lib/state/connection.svelte.js';
import { logsState } from '#lib/state/logs.svelte.js';
import { logs } from '#lib/api/logs';

import Icon from '#lib/ui/Icon.svelte';
import Aside from '#lib/ui/Aside.svelte';
import Diagnostic from '#lib/ui/Diagnostic.svelte';


// properties
// ------------------------------------------------------------------------
// the scrolling list of logs (dom node)
let list;
// the end of the list, scrolled to as new logs arrive (dom node), absent while filtering
let footer = $state();
// string used for filtering (string)
let filter = $state('');
// pinned logs (array of objects)
let pinned = $state([]);
// if the pinned pannel should be visible (bool)
let pinnedPanel = $state(false);
// interval for checking for new logs (interval)
let newLogsInterval;


onMount(() => {
  load();
  updatePinnedState();

  newLogsInterval = setInterval(() => { if(browser && document.visibilityState !== 'hidden'){ load(); } }, 3000);
  return () => clearInterval(newLogsInterval);
});


const load = async () => {
  const last = logsState.logs.logs?.at(-1)?.id ?? null;
  const newLogs = await logs.get({ last: last });

  // if already showing logs, just append the new ones
  if(last){
    if(newLogs.logs?.length){
      logsState.logs.logs = [...logsState.logs.logs, ...newLogs.logs];

      // store the times when logs were downloaded to mark new ones
      logsState.logs.downloaded_at.push(Date.now());
      if(logsState.logs.downloaded_at.length > 2){
        logsState.logs.downloaded_at.splice(0, 1);
      }
    }
  }
  // if fresh start, create the logs object
  else {
    if(!logsState.logs.logs){
      logsState.logs = newLogs;

      if(!logsState.logs.downloaded_at){
        logsState.logs.downloaded_at = [Date.now()];
      }
    }
  }
}

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
// whether the list was scrolled to the bottom since the logs last changed (bool)
let scrolled = false;

// before the list changes: if it is at the bottom now, keep it there afterwards
$effect.pre(() => {
  logsState.logs.logs?.length;
  filter;

  if(list && Math.abs(list.scrollHeight - list.scrollTop - list.clientHeight) < 10){
    scrolled = false;
  }
});

// after the list changes
$effect(() => {
  const length = logsState.logs.logs?.length;
  filter;

  if(!scrolled && footer){
    footer.scrollIntoView();
    if(length){
      scrolled = true;
    }
  }
});


// purpose:		  saves the log in localStorage for future use
// attributes:	log data you want to save (object)
// ------------------------------------------------------------------------
const updatePinnedState = () => {
  pinnedPanel = localStorage.pinnedPanel === 'true' ? true : false;
  pinned = localStorage.pinnedLogs ? JSON.parse(localStorage.pinnedLogs) : [];
};

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

</script>


<!-- ================================================================== -->
<style>

/* shared */
.container {
  height: 100%;
  overflow: hidden;
  display: grid;
  grid-template-columns: 1fr min-content;
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
  height: calc(100vh - 83px);
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

    .date {
      font-family: monospace;
      font-size: 1rem;
    }

    .error time {
      color: var(--color-danger);
    }

  .logs .message {
    word-break: break-all;
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
.pins nav {
  justify-content: flex-end;
}

.pins li + li {
  margin-block-start: 2rem;
  padding-block-start: 2rem;

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
    background-color: transparent;
    color: var(--color-danger);
  }

</style>



<!-- ================================================================== -->
<svelte:head>
  <title>Logs{connectionState.online?.MPKIT_URL ? ': ' + connectionState.online.MPKIT_URL.replace('https://', '') : ''}</title>
</svelte:head>


<div class="container">

  <section class="logs" bind:this={list}>

    <nav>
      <form>
        <label for="filter">Filter:</label>
        <input type="text" id="filter" bind:value={filter}>
        {#if filter}
          <button class="clearFilter" onclick={() => filter = ''}>
            <span class="label">Clear filter</span>
            <Icon icon="x" size=12 />
          </button>
        {/if}
      </form>
      <div>
        <button type="button" class="button" onclick={() => logsState.logs.logs.forEach((log, index) => logsState.logs.logs[index].hidden = true) }>Clear screen</button>
        <button type="button" title="Toggle pinned logs panel" class="button" onclick={togglePinnedPanel}>
          <span class="label">Toggle pinned logs panel</span>
          <Icon icon="pin" />
        </button>
      </div>
    </nav>

    {#if logsState.logs.logs}
      <table>
        {#each logsState.logs.logs as log}
          <tr
            class:hidden={filter && isFiltered(log) || log.hidden}
            class:error={log.error_type.match(/error/i)}
            class:fresh={log.downloaded_at > logsState.logs.downloaded_at[0]}
            in:fade={{ duration: 200 }}
          >
            <td class="date">
              <time datetime={log.created_at}>
                {(new Date(log.created_at)).toLocaleDateString(undefined, {})}
                {(new Date(log.created_at)).toLocaleTimeString(undefined, {})}
              </time>
            </td>
            <td class="message">
              <Diagnostic {log} />
            </td>
            <td class="actions">
              <div>
                <button type="button" class="button" title="Copy message" onclick={(event) => navigator.clipboard.writeText(log.message).then(() => { event.target.classList.add('confirmation'); setTimeout(() => event.target.classList.remove('confirmation'), 1000); }) }>
                  <span class="label">Copy message</span>
                  <Icon icon="copy" />
                </button>
                <button type="button" class="button" title="Pin this log" class:active={pinned.find(pin => pin.id === log.id)} onclick={(event) => { event.preventDefault(); pin(log); }}>
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
      <footer bind:this={footer}>
        No newer logs to show<br>Checking every 3 seconds
      </footer>
    {/if}

  </section>


  {#if pinnedPanel}
    <Aside>

      <div class="pins">

        <nav class="asideNav">
          <button type="button" class="button" onclick={() => { localStorage.pinnedLogs = []; pinned = []; }}>
            Clear pinned logs
          </button>
        </nav>

        {#if pinned}
          <ul>
            {#each pinned as log}
              <li>
                <div class="info">
                  <time class="date" datetime={log.created_at}>
                    {(new Date(log.created_at)).toLocaleDateString(undefined, {})}
                    {(new Date(log.created_at)).toLocaleTimeString(undefined, {})}
                  </time>
                  <button type="button" title="Remove log from pinned panel" onclick={() => pin(log)}>
                    <span class="label">Remove log from pinned panel</span>
                    <Icon icon="trash" size="18" />
                  </button>
                </div>
                <Diagnostic {log} />
              </li>
            {/each}
          </ul>
        {/if}

      </div>

    </Aside>
  {/if}

</div>

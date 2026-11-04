<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { fade } from 'svelte/transition';
import { connectionState } from '#lib/state/connection.svelte.js';
import { databaseState } from '#lib/state/database.svelte.js';
import { notificationsState } from '#lib/state/notifications.svelte.js';
import { preferencesState } from '#lib/state/preferences.svelte.js';
import { table } from '#lib/api/table';
import { serverUrl } from '#lib/api/address.js';

import Icon from '#lib/ui/Icon.svelte';



// properties
// ------------------------------------------------------------------------
// which applications to show the description for (array or strings)
let showDescriptionFor = $state([]);
// if the tables are already being loaded (bool)
let tablesPreloading = false;


// purpose:		preload tables data into the state store for faster navigation
// returns:		loads the tables into the databaseState.tables (array)
// ------------------------------------------------------------------------
const preloadTables = async () => {
  if(!tablesPreloading && !databaseState.tables.length){
    tablesPreloading = true;
    // only a head start: the Database page loads the tables itself and says when it cannot
    databaseState.tables = await table.get().catch(() => {
      tablesPreloading = false;
      return databaseState.tables;
    });
  }
};


// purpose:   toggles pinned items in the header
// arguments: name of the navigation item to pin (string)
// ------------------------------------------------------------------------
const pin = what => {
  if(preferencesState.header.indexOf(what) > -1){
    preferencesState.header = preferencesState.header.filter(item => item !== what);
  } else {
    preferencesState.header = [...preferencesState.header, what];
  }

  localStorage.header = JSON.stringify(preferencesState.header);
};


// purpose:   toggles description for given application
// arguments: name of the application to toggle description for
// ------------------------------------------------------------------------
const toggleDescription = what => {
  if(showDescriptionFor.indexOf(what) > -1){
    showDescriptionFor = showDescriptionFor.filter(item => item !== what);
  } else {
    showDescriptionFor = [...showDescriptionFor, what];
  }
};


// purpose:   checks what is the latest pos-cli version in npm registry
// ------------------------------------------------------------------------
const getLatestPosCliVersion = async () => {
  const response = await fetch('https://registry.npmjs.org/@platformos/pos-cli/latest');
  const data = await response.json();
  return data;
};


// purpose:   handles the action after clicking the 'update available' button
// effect:    copies update command to clipboard and shows a notification
// ------------------------------------------------------------------------
const handleUpdate = () => {
  navigator.clipboard.writeText(`npm i -g @platformos/pos-cli@latest`)
    .then(() => {
      notificationsState.create('info', updateCopiedMessage);
    })
    .catch(e => {
      notificationsState.create('error', 'Could not copy the update command, run npm i -g @platformos/pos-cli@latest in the terminal');
      console.error(e);
    });
};

</script>


<!-- ================================================================== -->
<style>

nav {
  width: 100%;
  margin-inline: auto;
  margin-block-start: 2rem;
  padding-inline: 2rem;
}


.applications {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
  justify-content: center;
}

  .applications + .applications {
    margin-top: 4rem;
  }


.application {
  width: 200px;
  position: relative;
  display: flex;
  overflow: hidden;

  border-radius: 1rem;
  background-color: var(--color-background);

  transition: width .2s ease-in-out;
}

  .application > a {
    width: 200px;
    padding: 2.75rem 1rem 2rem;
    display: flex;
    flex-shrink: 0;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .application.showDescription {
    width: 500px;
  }

.icon {
  width: 100px;
  height: 100px;
  padding: .5rem;
  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: .5rem;
  background-color: var(--color-middleground);

  color: var(--color-interaction);

  transition: all .2s ease-in-out;
}

  .application > a:hover .icon {
    border-radius: 1rem;

    scale: 1.1;
  }

h2 {
  text-align: center;
  font-size: 1.1rem;
  font-weight: 500;
}

.description {
  width: 284px;
  padding: 2.75rem 1rem 2rem 0;
  flex-shrink: 0;
}

  .description li {
    margin-inline-start: 1ch;
    padding-inline-start: .4em;

    list-style-type: '–';
  }

  .description li + li {
    margin-block-start: .2em;
  }

.actions {
  display: flex;
  align-items: center;
  position: absolute;
  inset-inline-end: 0rem;
  inset-block-start: 0rem;
  overflow: hidden;

  opacity: 0;

  border: 1px solid var(--color-page);
  border-width: 0 0 1px 1px;
  border-radius: 0 1rem 0 1rem;

  transition: opacity .2s linear;
  transition-delay: 0s;
}

  .application:hover .actions {
    opacity: 1;
    transition-delay: .5s;
  }

  .actions li + li {
    border-inline-start: 1px solid var(--color-page);
  }

  .actions button {
    padding: .25em .5em;

    color: var(--color-text-secondary);

    transition: color .1s linear;
  }

  .actions button:hover,
  .actions button:focus-visible {
    color: var(--color-interaction-hover);
  }

.early {
  min-width: 200px;
  padding: 2.75rem 0 2rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;

  border: 2px dashed var(--color-frame);
  border-radius: 1rem;
}

  .early h2 {
    font-weight: normal;
    color: var(--color-text-secondary);
  }

  .early h2 small {
    display: block;

    font-size: .7em;
  }

  .early ul {
    min-height: calc(100px + .5rem);
    display: flex;
    flex-direction: column;
    gap: .5em;
  }

  .early li {
    position: relative;
    display: flex;
    align-items: center;
  }

  .early li button {
    width: 16px;
    height: 16px;
    position: absolute;
    inset-inline-start: -1.35rem;
    display: flex;
    align-items: center;
    justify-content: center;

    opacity: 0;
    background-color: var(--color-middleground);
    border-radius: 4px;

    transition: opacity .2s linear;
    transition-delay: 0s;
  }

  .early li:hover button {
    opacity: 1;

    transition-delay: .8s;
  }

  .early li button:hover {
    background-color: rgba(var(--color-rgb-interaction-hover), .2);
    color: var(--color-interaction-hover);
  }

  .early li a {
    display: flex;
    align-items: center;
    gap: .5em;
  }

  .early a:hover {
    color: var(--color-interaction-hover);
  }

  .early i {
    width: calc(24px + .3em * 2);
    height: calc(24px + .3em * 2);
    display: flex;
    align-items: center;
    justify-content: center;

    border-radius: .6rem;
    background-color: var(--color-middleground);

    color: var(--color-interaction);

    transition: all .1s ease-in-out;
  }

    .early a:hover i {
      border-radius: .7rem;

      scale: 1.07;
    }


footer {
  margin-block-start: 4rem;
  padding: 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;

  border-block-start: 1px solid var(--color-frame);
}

footer ul {
  display: flex;
  gap: 2rem;
}

.update {
  max-width: 100px;
  display: flex;
  align-items: center;
  gap: .5em;

  font-size: .85rem;
}

.update :global(svg) {
  flex-shrink: 0;
}

</style>



<!-- ================================================================== -->
<svelte:head>
  <title>platformOS{connectionState.online?.MPKIT_URL ? ': ' + connectionState.online.MPKIT_URL.replace('https://', '') : ''}</title>
</svelte:head>

{#snippet updateCopiedMessage()}
  <div>Update command copied to clipboard <small>Run <code>npm i -g @platformos/pos-cli@latest</code> in the terminal</small></div>
{/snippet}

<nav>

  <ul class="applications">


    <li class="application" class:showDescription={showDescriptionFor.includes('database')}>
      <a href="/database" onfocus={preloadTables} onmouseover={preloadTables}>
        <div class="icon">
          <Icon icon="database" size="48" />
        </div>
        <h2>
          Database
        </h2>
      </a>
      <ul class="description">
        <li>Inspect tables and records</li>
        <li>Create, edit or delete records</li>
        <li>Filter and find any record</li>
      </ul>
      <ul class="actions">
        <li>
          <button title="More information" onclick={() => toggleDescription('database')}>
            <Icon icon="info" size="14" />
            <span class="label">Show more information about Database tool</span>
          </button>
        </li>
        <li>
          <button title="{preferencesState.header.includes('database') ? 'Unpin Database from' : 'Pin Database to'} header menu" onclick={() => pin('database')}>
            <Icon icon={preferencesState.header.includes('database') ? 'pinFilled' : 'pin'} size="14" />
            <span class="label">{preferencesState.header.includes('database') ? 'Unpin Database from' : 'Pin Database to'} header menu</span>
          </button>
        </li>
      </ul>
    </li>

    <li class="application" class:showDescription={showDescriptionFor.includes('users')}>
      <a href="/users">
        <div class="icon">
          <Icon icon="users" size="48" />
        </div>
        <h2>
          Users
        </h2>
      </a>
      <ul class="description">
        <li>Inspect registered users and their personal data</li>
      </ul>
      <ul class="actions">
        <li>
          <button title="More information" onclick={() => toggleDescription('users')}>
            <Icon icon="info" size="14" />
            <span class="label">Show more information about Users tool</span>
          </button>
        </li>
        <li>
          <button title="{preferencesState.header.includes('users') ? 'Unpin Users from' : 'Pin Users to'} header menu" onclick={() => pin('users')}>
            <Icon icon={preferencesState.header.includes('users') ? 'pinFilled' : 'pin'} size="14" />
            <span class="label">{preferencesState.header.includes('users') ? 'Unpin Users from' : 'Pin Users to'} header menu</span>
          </button>
        </li>
      </ul>
    </li>

    <li class="application" class:showDescription={showDescriptionFor.includes('logs')}>
      <a href="/logs">
        <div class="icon">
          <Icon icon="log" size="48" />
        </div>
        <h2>
          Logs
        </h2>
      </a>
      <ul class="description">
        <li>View system logs</li>
        <li>Inspect logs you've outputted yourself</li>
        <li>Debug Liquid or GraphQL errors</li>
      </ul>
      <ul class="actions">
        <li>
          <button title="More information" onclick={() => toggleDescription('logs')}>
            <Icon icon="info" size="14" />
            <span class="label">Show more information about Logs tool</span>
          </button>
        </li>
        <li>
          <button title="{preferencesState.header.includes('logs') ? 'Unpin Logs from' : 'Pin Logs to'} header menu" onclick={() => pin('logs')}>
            <Icon icon={preferencesState.header.includes('logs') ? 'pinFilled' : 'pin'} size="14" />
            <span class="label">{preferencesState.header.includes('logs') ? 'Unpin Logs from' : 'Pin Logs to'} header menu</span>
          </button>
        </li>
      </ul>
    </li>

    <li class="application" class:showDescription={showDescriptionFor.includes('backgroundJobs')}>
      <a href="/backgroundJobs">
        <div class="icon">
          <Icon icon="backgroundJob" size="48" />
        </div>
        <h2>
          Background Jobs
        </h2>
      </a>
      <ul class="description">
        <li>List scheduled background jobs</li>
        <li>Debug background jobs that failed to run</li>
      </ul>
      <ul class="actions">
        <li>
          <button title="More information" onclick={() => toggleDescription('backgroundJobs')}>
            <Icon icon="info" size="14" />
            <span class="label">Show more information about Background Jobs tool</span>
          </button>
        </li>
        <li>
          <button title="{preferencesState.header.includes('backgroundJobs') ? 'Unpin Background Jobs from' : 'Pin Background Jobs to'} header menu" onclick={() => pin('backgroundJobs')}>
            <Icon icon={preferencesState.header.includes('backgroundJobs') ? 'pinFilled' : 'pin'} size="14" />
            <span class="label">{preferencesState.header.includes('backgroundJobs') ? 'Unpin Background Jobs from' : 'Pin Background Jobs to'} header menu</span>
          </button>
        </li>
      </ul>
    </li>

    <li class="application" class:showDescription={showDescriptionFor.includes('constants')}>
      <a href="/constants">
        <div class="icon">
          <Icon icon="constant" size="48" />
        </div>
        <h2>
          Constants
        </h2>
      </a>
      <ul class="description">
        <li>Check all constants in one place</li>
        <li>Create new constants</li>
        <li>Edit or delete existing ones</li>
      </ul>
      <ul class="actions">
        <li>
          <button title="More information" onclick={() => toggleDescription('constants')}>
            <Icon icon="info" size="14" />
            <span class="label">Show more information about Constants tool</span>
          </button>
        </li>
        <li>
          <button title="{preferencesState.header.includes('constants') ? 'Unpin Constants from' : 'Pin Constants to'} header menu" onclick={() => pin('constants')}>
            <Icon icon={preferencesState.header.includes('constants') ? 'pinFilled' : 'pin'} size="14" />
            <span class="label">{preferencesState.header.includes('constants') ? 'Unpin Constants from' : 'Pin Constants to'} header menu</span>
          </button>
        </li>
      </ul>
    </li>

  </ul>

  <ul class="applications">

    <li class="application" class:showDescription={showDescriptionFor.includes('liquid')}>
      <a href={serverUrl('/gui/liquid')}>
        <div class="icon" style="color: #aeb0b3;">
          <Icon icon="liquid" size="48" />
        </div>
        <h2>
          Liquid Evaluator
        </h2>
      </a>
      <ul class="description">
        <li>Run Liquid code against your instance</li>
        <li>Test Liquid logic</li>
        <li>Quickly prototype your ideas</li>
      </ul>
      <ul class="actions">
        <li>
          <button title="More information" onclick={() => toggleDescription('liquid')}>
            <Icon icon="info" size="14" />
            <span class="label">Show more information about Liquid Evaluator</span>
          </button>
        </li>
        <li>
          <button title="{preferencesState.header.includes('liquid') ? 'Unpin Liquid Evaluator from' : 'Pin Liquid Evaluator to'} header menu" onclick={() => pin('liquid')}>
            <Icon icon={preferencesState.header.includes('liquid') ? 'pinFilled' : 'pin'} size="14" />
            <span class="label">{preferencesState.header.includes('liquid') ? 'Unpin Liquid Evaluator from' : 'Pin Liquid Evaluator to'} header menu</span>
          </button>
        </li>
      </ul>
    </li>

    <li class="application" class:showDescription={showDescriptionFor.includes('graphiql')}>
      <a href={serverUrl('/gui/graphql')}>
        <div class="icon" style="color: #f30e9c;">
          <Icon icon="graphql" size="48" />
        </div>
        <h2>
          GraphiQL
        </h2>
      </a>
      <ul class="description">
        <li>Run GraphQL against your instance</li>
        <li>Explore documentation</li>
        <li>Quickly prototype your queries and mutations</li>
      </ul>
      <ul class="actions">
        <li>
          <button title="More information" onclick={() => toggleDescription('graphiql')}>
            <Icon icon="info" size="14" />
            <span class="label">Show more information about GraphiQL</span>
          </button>
        </li>
        <li>
          <button title="{preferencesState.header.includes('graphiql') ? 'Unpin GraphiQL from' : 'Pin GraphiQL to'} header menu" onclick={() => pin('graphiql')}>
            <Icon icon={preferencesState.header.includes('graphiql') ? 'pinFilled' : 'pin'} size="14" />
            <span class="label">{preferencesState.header.includes('graphiql') ? 'Unpin GraphiQL from' : 'Pin GraphiQL to'} header menu</span>
          </button>
        </li>
      </ul>
    </li>

    <li class="early">
      <ul>
        <li>
          <button title="{preferencesState.header.includes('logsv2') ? 'Unpin Logs v2 from' : 'Pin Logs v2 to'} header menu" onclick={() => pin('logsv2')}>
            <Icon icon={preferencesState.header.includes('logsv2') ? 'pinFilled' : 'pin'} size="12" />
            <span class="label">{preferencesState.header.includes('logsv2') ? 'Unpin Logs v2 from' : 'Pin Logs v2 to'} header menu</span>
          </button>
          <a href="/logsv2">
            <i>
              <Icon icon="logFresh" size="24" />
            </i>
            <h3>Logs v2</h3>
          </a>
        </li>
        <li>
          <button title="{preferencesState.header.includes('network') ? 'Unpin Network Logs from' : 'Pin Network Logs to'} header menu" onclick={() => pin('network')}>
            <Icon icon={preferencesState.header.includes('network') ? 'pinFilled' : 'pin'} size="12" />
            <span class="label">{preferencesState.header.includes('network') ? 'Unpin Network Logs from' : 'Pin Network Logs to'} header menu</span>
          </button>
          <a href="/network">
            <i>
              <Icon icon="globeMessage" size="24" />
            </i>
            <h3>Network Logs</h3>
          </a>
        </li>
      </ul>
      <h2>
        Early access
        <small>New tools in testable versions</small>
      </h2>
    </li>

  </ul>

</nav>

<footer>
  <div>
    {#await getLatestPosCliVersion() then latest}
      {#if connectionState.online?.version && latest.version !== connectionState.online.version}
        <button transition:fade onclick={handleUpdate} title="Update to pos-cli version {latest.version}" class="update">
          <Icon icon="arrowTripleUp" />
          <span>Update available</span>
        </button>
      {/if}
    {/await}
  </div>

  <ul>
    <li>
      <a href="https://documentation.platformos.com" class="button">
        <Icon icon="book" />
        Documentation
      </a>
    </li>
    <li>
      <a href="https://partners.platformos.com" class="button">
        <Icon icon="serverSettings" />
        Partner Portal
      </a>
    </li>
  </ul>
</footer>
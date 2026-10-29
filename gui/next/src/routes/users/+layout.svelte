<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { goto, invalidate } from '$app/navigation';
import { connectionState } from '#lib/state/connection.svelte.js';
import { notificationsState } from '#lib/state/notifications.svelte.js';
import { usersState } from '#lib/state/users.svelte.js';
import { quintOut } from 'svelte/easing';
import { page } from '$app/state';
import { user } from '#lib/api/user.js';
import ContextMenu from '#lib/users/ContextMenu.svelte';
import CreateUser from '#lib/users/Create.svelte';

import Icon from '#lib/ui/Icon.svelte';
import Number from '#lib/ui/forms/Number.svelte';


// properties
// ------------------------------------------------------------------------
let {
  // the users list and the filters it was loaded with, from +layout.js (object)
  data,
  // the user details, shown when a user is opened (snippet)
  children
} = $props();
// filters form (dom node)
let form;
// list of users (array)
let items = $derived(data.users?.results ?? []);
// list of custom user schema properties (array) or null
let userProperties = $state(null);
// the filter and page in the form, following the url until they are edited
let attribute = $derived(data.filters.attribute);
let value = $derived(data.filters.value);
let pageNumber = $derived(data.filters.page);
usersState.user = undefined;

let contextMenu = $state({
  // item id for which the context menu is opened for
  id: null
});


// purpose:   load the users again after a change made through this page
// ------------------------------------------------------------------------
const reloadUsers = () => invalidate('app:users');

// transition:    zooms from nothing to full size
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

      return `scale: ${eased};` }
  }
};

const showCreateUserPopup = function(userToEdit = null) {
  if (userProperties === null) {
    user.getCustomProperties().then(properties => {
      userProperties = properties;
      usersState.user = userToEdit;
    }).catch(() => {
      notificationsState.create('error', 'Could not load table properties. Please try again later.');
    });
  }
  else {
    usersState.user = userToEdit;
  }
}

const clearFilters = function() {
  goto(page.url.pathname, { reset: false });
}

// purpose:   shows the list for the filter and page in the form, through the url
//            (the layout's load function runs again for the new query)
// arguments: submit event (object)
// ------------------------------------------------------------------------
const submitForm = function(event) {
  event.preventDefault();
  const params = new URLSearchParams(new FormData(form));
  if (data.filters.value !== params.get('value')) {
    params.set('page', 1);
  }
  goto(page.url.pathname + '?' + params.toString(), { reset: false });
}
</script>


<!-- ================================================================== -->
<style>

  /* layout */
  .page {
    max-width: 100vw;
    height: 100%;
    overflow: hidden;
    display: grid;
    grid-template-columns: 1fr min-content;
    position: relative;
  }
  
  .container {
    min-height: 0;
    max-width: 100vw;
    overflow-y: auto;
    display: grid;
    grid-template-rows: min-content 1fr;
  }
  
  /* filters */
  .filters {
    padding: var(--space-navigation);
  
    background-color: var(--color-background);
    border-block-end: 1px solid var(--color-frame);
  }
  
    .filters .label {
      position: absolute;
      left: -100vw;
    }
  
    .filters form {
      display: flex;
      gap: var(--space-navigation);
      align-items: center;
    }
  
    .filters input:focus,
    .filters select:focus {
      position: relative;
      z-index: 1;
    }

    .filters #filters_attribute {
      margin-inline-end: 1px;

      border-start-end-radius: 0;
      border-end-end-radius: 0;
    }
  
    .filters .search {
      display: flex;
      align-items: center;
    }
  
    .filters .search input {
      padding-inline-end: 1.8rem;
      border-radius: 0;
    }

    .filters .clear {
      margin-inline-start: -.9rem;
      position: relative;
      inset-inline-start: -.4rem;
      z-index: 1;
    }
  
    .filters .search .button[type="submit"] {
      margin-inline-start: 1px;
      padding-block: .63rem;
      padding-inline: .7em .8em;
      border-start-start-radius: 0;
      border-end-start-radius: 0;
    }
  
  .pagination {
    padding: 1rem;
    display: flex;
    align-items: center;
    gap: .5em;
    position: fixed;
    bottom: 0;
    width: 100%;
    justify-content: space-between;
  
    border-block-start: 1px solid var(--color-frame);
    background-color: rgba(var(--color-rgb-background), .8);
    backdrop-filter: blur(17px);
    -webkit-backdrop-filter: blur(17px);
  }
  
  /* content table */
  table {
    min-width: 100%;
    margin-bottom: 70px;
    line-height: 1.27em;
  }
  
    thead {
      background-color: var(--color-background);
    }
  
    th,
    td {
      border-block-end: 1px solid var(--color-frame);
    }
  
    th,
    td > a, td > span {
      padding: var(--space-table) calc(var(--space-navigation) * 1.5);
    }
  
    th:first-child,
    td:first-child > a, td:first-child > span {
      padding-inline-start: var(--space-navigation);
    }
  
    th:last-child,
    td:last-child > a, td:last-child > span {
      padding-inline-end: var(--space-navigation);
    }
  
    td > a, td > span {
      display: block;
    }
  
    tr:last-child td {
      border: 0;
    }
  
    tr {
      position: relative;
    }
  
    tr:after {
      position: absolute;
      inset: calc(var(--space-table) / 3);
      z-index: -1;
  
      border-radius: calc(1rem - var(--space-table) / 1.5);
      background: transparent;
  
      content: '';
  
      transition: background-color .1s linear;
    }
  
    tr:hover:after {
      background-color: var(--color-background);
    }
  
    tr.active:after {
      background-color: var(--color-middleground);
    }
  
    /* disable this hover effect on Safari as they refuse to fix their position: relative bug for tables */
    @supports (font: -apple-system-body) and (-webkit-appearance: none) {
      tr:after {
        display: none;
      }
    }

    .table-id {
      font-variant-numeric: tabular-nums;
      width: 150px;
    }

    .menu {
      position: relative;
      width: 30px;
    }

    tr .inner-menu {
      background-color: transparent;
      opacity: 0;
      transition: opacity .1s linear;
    }

    tr:hover .inner-menu {
      opacity: .5;
    }

    .menu:hover .inner-menu, .context .menu .inner-menu {
      opacity: 1;
    }

    .menu button.active {
      border-end-start-radius: 0;
      border-end-end-radius: 0;
    }
  </style>


<!-- ================================================================== -->
<svelte:head>
  <title>Users{connectionState.online?.MPKIT_URL ? ': ' + connectionState.online.MPKIT_URL.replace('https://', '') : ''}</title>
</svelte:head>


<div class="page">

<section class="container">

  <nav class="filters">
    <form
      action=""
      bind:this={form}
      id="filters"
      onsubmit={submitForm}
    >
      <label for="filters_attribute">Filter by</label>
      <fieldset class="search">
        <select id="filters_attribute" name="attribute" bind:value={attribute} onchange={() => value = ''}>
          <option value="email">email</option>
          <option value="id">id</option>
        </select>
        <input type="text" name="value" bind:value={value}>
        {#if value}
          <button type="button" class="clear" transition:appear onclick={clearFilters}>
            <span class="label">Clear filters</span>
            <Icon icon="x" size=14 />
          </button>
        {/if}
        <button type="submit" class="button">
          <span class="label">Apply filter</span>
          <Icon icon="arrowRight" />
        </button>
      </fieldset>
    </form>
  </nav>

  <article class="contetnt">
    <table>
      <thead>
        <tr>
          <th class="menu"></th>
          <th class="table-id">ID</th>
          <th>Email</th>
        </tr>
      </thead>
      {#if items}
        <tbody>
          {#each items as user (user.id)}
            <tr
              class:active={page.params.id == user.id}
              class:context={contextMenu.id === user.id} 
            >
            <td>
              <span>
                <div class="menu">
                  <div class="inner-menu">
                    <div class="combo">
                      <button class="button compact more" class:active={contextMenu.id === user.id} onclick={() => contextMenu.id = user.id}>
                        <span class="label">More options</span>
                        <Icon icon="navigationMenuVertical" size="16" />
                      </button>
                      <button class="button compact edit" title="Edit user" onclick={() => { showCreateUserPopup(user) }}>
                        <span class="label">Edit user</span>
                        <Icon icon="pencil" size="16" />
                      </button>
                    </div>
                    {#if contextMenu.id === user.id}
                      <ContextMenu record={user} onreload={() => reloadUsers()} onclose={() => contextMenu.id = null} />
                    {/if}
                  </div>
                </div>
              </span>
            </td>
              <td class="table-id">
                <a href="/users/{user.id}?{page.url.searchParams.toString()}">
                  {user.id}
                </a>
              </td>
              <td>
                <a href="/users/{user.id}?{page.url.searchParams.toString()}">
                  {user.email}
                </a>
              </td>
            </tr>
          {/each}
        </tbody>
      {/if}
    </table>
  </article>

  <nav class="pagination">
    <div>
      <label for="page">
        Page:
      </label>
      <Number
        form="filters"
        name="page"
        bind:value={pageNumber}
        min={1}
        max={data.users?.total_pages || 1}
        step={1}
        decreaseLabel="Previous page"
        increaseLabel="Next page"
        style="navigation"
        oninput={({ submitter }) => form.requestSubmit(submitter)}
      />
      of {data.users?.total_pages || 1}
    </div>
    <button class="button" title="Create user" onclick={event => { event.preventDefault(); showCreateUserPopup(); }}>
      <Icon icon="plus" />
      <span class="label">Create a new user</span>
    </button>
  </nav>

</section>

{#if page.params.id}
  {@render children?.()}
{/if}

{#if usersState.user !== undefined}
<CreateUser userProperties={userProperties} userToEdit={usersState.user} onsuccess={() => reloadUsers()} />
{/if}


</div>

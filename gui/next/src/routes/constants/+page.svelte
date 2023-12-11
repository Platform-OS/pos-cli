<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { fade } from 'svelte/transition';
import { constant } from '$lib/api/constant.js';
import { state } from '$lib/state.js';

import Icon from '$lib/ui/Icon.svelte';


// properties
// ------------------------------------------------------------------------
// string used for filtering (string)
let filter = '';
// list of constants (array)
let items = [];


// get constants list
(async () => await constant.get())().then(response => { items = response; });


// purpose:		adds a .hidden property to each log item if not matching the string
// attributes:	string you want to filter the logs with (string)
// ------------------------------------------------------------------------
const isFiltered = (constant) => {
  if(constant.name.toLowerCase().indexOf(filter.toLowerCase()) === -1 && constant.value.toLowerCase().indexOf(filter.toLowerCase()) === -1){
    return true;
  } else {
    return false;
  }
};


// purpose:		updates the constant
// attributes:	string you want to filter the logs with (string)
//				index of the item that was changed (object)
// ------------------------------------------------------------------------
const update = async (event, itemIndex) => {
  event.preventDefault();

  const edit = await constant.edit(new FormData(event.target));

  if(!edit.errors){
    items[itemIndex].changed = false;
    state.highlight('constant', edit.constant_set.name);
    state.notification.create('success', `Constant ${edit.constant_set.name} updated`);
  } else {
    state.notification.create('error', `Failed to update ${edit.constant_set.name} constant`);
  }
};


const remove = async (event) => {
  event.preventDefault();

  if(confirm('Are you sure you want to delete this constant?')){

    const remove = await constant.delete(new FormData(event.target));

    if(!remove.errors){
      state.notification.create('success', `Constant ${remove.constant_unset.name} deleted`);
      await constant.get().then(response => { items = response; });
    } else {
      state.notification.create('success', `Failed to delete ${remove.constant_unset.name} constant`);
    }

  }
};


const create = async (event) => {
  event.preventDefault();

  const create = await constant.edit(new FormData(event.target));

  if(!create.errors){
    event.target.reset();
    state.notification.create('success', `Constant ${create.constant_set.name} created`);
    await constant.get().then(response => { items = response; state.highlight('constant', create.constant_set.name); })
  } else {
    state.notification.create('error', `Failed to create ${create.constant_set.name} constant`);
  }
}

</script>


<!-- ================================================================== -->
<style>

nav {
  width: 100%;
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: sticky;
  top: 82px;
  z-index: 10;

  border-bottom: 1px solid var(--color-frame);
  background-color: rgba(var(--color-rgb-background), .8);
  backdrop-filter: blur(17px);
  -webkit-backdrop-filter: blur(17px);
}

  nav input {
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


.create {
  max-width: 1150px;
  margin-inline: auto;
  margin-block-start: 2rem;
  padding: 1rem 3.6rem 1rem 5.2rem;

  border-radius: 1rem;
  background-color: var(--color-background);
}

.create form {
  display: grid;
  grid-template-columns: .7fr 1fr auto;
  align-items: center;
  gap: 1rem;
}

.create input[name="name"] {
  font-family: monospace;
  font-size: 1rem;
  font-weight: 600;
}

.create fieldset:last-of-type {
  margin-inline-start: .5em;
}

.create label {
  margin-block-end: .4em;
  display: block;
}

.create input {
  width: 100%;
}

.create .button {
  margin-inline-end: -1.6rem;

  align-self: end;
}


ul {
  max-width: 1100px;
  margin-inline: auto;
  margin-block-start: 2rem;
  padding-inline: 2rem;
}

li {
  margin-block-end: 1rem;

  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: .2rem;
}

  li.hidden {
    display: none;
  }


.delete {
  opacity: 0;

  transition: opacity .1s linear;
}

  li:hover .delete {
    opacity: 1;
  }

.delete button {
  padding: .7rem;

  cursor: pointer;

  color: var(--color-danger);
}

.delete .label {
  position: absolute;
  left: -100vw;
}


.edit {
  display: grid;
  grid-template-columns: .7fr 1fr auto;
  align-items: center;
  gap: 1rem;
}

.edit label {
  overflow: hidden;
  text-overflow: ellipsis;

  font-family: monospace;
  font-size: 1rem;
  font-weight: 600;
}

@font-face {
  font-family: 'password';
  font-style: normal;
  font-weight: 400;
  src: url(https://jsbin-user-assets.s3.amazonaws.com/rafaelcastrocouto/password.ttf);
  font-display: block;
}

.edit input {
  width: 100%;
  padding-inline-end: 3rem;

  font-family: 'password';
  line-height: 18px;
  letter-spacing: 1px;
  color: var(--color-text-secondary);
}

.edit input.exposed {
  font-family: var(--font-normal);
  letter-spacing: 0;
  color: var(--color-text);
}

.edit fieldset {
  position: relative;
}

.edit .toggleExposition {
  display: flex;
  align-items: center;
  position: absolute;
  right: .5em;
  top: 0;
  bottom: 0;

  cursor: pointer;

  opacity: 0;

  color: var(--color-text-secondary);

  transition: all .1s linear;
}

  .edit:hover .toggleExposition {
    opacity: 1;
  }

  .edit .toggleExposition:hover {
    color: var(--color-interaction);
  }

  .edit .toggleExposition .label {
    position: absolute;
    left: -100vw;
  }

.edit button[type="submit"] {
  opacity: 0;

  transition: opacity .1s linear;
}

  .edit button.needed {
    opacity: 1;
  }


.highlighted input {
  background-color: var(--color-highlight);
}

</style>



<!-- ================================================================== -->
<svelte:head>
  <title>Constants | platformOS</title>
</svelte:head>

<div class="container">

  <nav>
    <form>
      <label for="filter">Find:</label>
      <input type="text" id="filter" bind:value={filter} autofocus>
      {#if filter}
        <button class="clearFilter" on:click={() => filter = ''}>
          <span class="label">Clear filter</span>
          <Icon icon="x" size=12 />
        </button>
      {/if}
    </form>
  </nav>

  <section class="create">
    <form on:submit|preventDefault={create}>
      <fieldset>
        <label for="newName">Name</label>
        <input type="text" name="name" id="newName" placeholder="MY_NEW_CONSTANT">
      </fieldset>
      <fieldset>
        <label for="newValue">Value</label>
        <input type="text" name="value" id="newValue">
      </fieldset>
      <button class="button">
        Add
        <Icon icon="arrowRight" />
      </button>
    </form>
  </section>

  <ul>

    {#each items as item, index}
      <li class:hidden={filter && isFiltered(item)} class:highlighted={$state.highlighted.constant === item.name} in:fade={{ duration: 100, delay: 10 * index }}>
        <form class="delete" on:submit|preventDefault={event => remove(event)}>
          <input type="hidden" name="name" value={item.name}>
          <button type="submit" title="Delete constant">
            <span class="label">Delete constant</span>
            <Icon icon="x" size="14" />
          </button>
        </form>
        <form class="edit"on:submit|preventDefault={event => update(event, index)}>
          <label for={item.name}>{item.name}</label>
          <input type="hidden" name="name" value={item.name}>
          <fieldset>
            <input class:exposed={item.exposed} disabled={!item.exposed} name="value" value={item.value} id={item.name} on:input={() => item.changed = true}>
            <button
              type="button"
              class="toggleExposition"
              title={item.exposed ? 'Hide value' : 'Show value'}
              on:click={() => item.exposed = item.exposed ? false : true}
            >
              <span class="label">
                {item.exposed ? 'Hide value' : 'Show value'}
              </span>
              <Icon icon={item.exposed ? 'eyeStriked' : 'eye'} />
            </button>
          </fieldset>
          <button type="submit" class="button" class:needed={items[index].changed}>Save</button>
        </form>
      </li>
    {/each}

  </ul>

</div>

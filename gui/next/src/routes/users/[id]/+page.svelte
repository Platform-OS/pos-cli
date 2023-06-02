<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { quintOut } from 'svelte/easing';

import { page } from '$app/stores';
import { user } from '$lib/api/user.js';

import Icon from '$lib/ui/Icon.svelte';


// properties
// ------------------------------------------------------------------------
// currently viewed user data (object)
let item;


// purpose:		gets the user data
// attributes:	id of the user (int)
// returns:		a single user data object from the database (object)
// ------------------------------------------------------------------------
const load = async (id) => {
  if(id){
    const params = new FormData();
    params.set('attribute', 'id');
    params.set('value', id);

    await user.get(params).then(response => {
      item = response.results[0];
    });
  }
}

$: load($page.params.id);
$: console.log(item);


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

      return `width: ${400 * eased}px;` }
  }
};

</script>


<!-- ================================================================== -->
<style>

aside {
  width: 400px;
  overflow: hidden;

  border-inline-start: 1px solid var(--color-frame);
}

.container {
  width: 400px;
  height: calc(100vh - 83px);
  padding: 1rem;
  overflow: auto;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.label {
  position: absolute;
  left: -100vw;
}

h2 {
  margin-block-end: .2em;

  font-weight: 500;
  font-size: 1.2rem;
}

.info {
  display: flex;
  gap: 1.2rem;
}

a:hover {
  color: var(--color-interaction-hover);
}

time {
  color: var(--color-text-secondary);
}

.tech {
  margin-block: 2rem;
}

.tech dt {
  margin-block-start: .5em;

  font-weight: 500;
}

.tech dd {
  padding: .6em .8em .6em .8em;

  border-radius: 0 1rem 1rem;
  background-color: var(--color-background);

  word-wrap: break-word;
}

.personal {
  padding-block-start: 1.3rem;

  border-block-start: 1px solid var(--color-frame);
}

.personal div {
  margin-block-start: .5em;

  display: flex;
  gap: .5em;
}

.personal dd {
  margin-block-end: .5em;
}

.personal dd {
  font-weight: 500;
}

</style>



<!-- ================================================================== -->
<svelte:head>
  <title>{item?.email ?? 'Users'} | platformOS</title>
</svelte:head>


<aside transition:appear>
  <div class="container">
    <header>
      <div>
        <h2>{item?.email ?? item?.id ?? 'Loading…'}</h2>
        <div class="info">
          {#if item?.id}ID: {item?.id}{/if}
          <time datetime={item?.created_at}>
            {(new Date(item?.created_at)).toLocaleDateString(undefined, {})}
            {(new Date(item?.created_at)).toLocaleTimeString(undefined, {})}
          </time>
        </div>
      </div>
      <a href="/users">
        <span class="label">Close user info</span>
        <Icon icon="x" />
      </a>
    </header>

    <dl class="tech">
      {#if item?.external_id}<dt>External ID:</dt> <dd>{item?.external_id}</dd>{/if}
      {#if item?.jwt_token}<dt>JWT:</dt> <dd>{item?.jwt_token}</dd>{/if}
    </dl>

    <dl class="personal">
      {#if item?.name}<div><dt>First name:</dt> <dd>{item?.name}</dd></div>{/if}
      {#if item?.first_name}<div><dt>First name:</dt> <dd>{item?.first_name}</dd></div>{/if}
      {#if item?.middle_name}<div><dt>Middle name:</dt> <dd>{item?.middle_name}</dd></div>{/if}
      {#if item?.last_name}<div><dt>Last name:</dt> <dd>{item?.last_name}</dd></div>{/if}
      {#if item?.slug}<div><dt>Slug:</dt> <dd>{item?.slug}</dd></div>{/if}
      {#if item?.language}<div><dt>Language:</dt> <dd>{item?.language}</dd></div>{/if}
    </dl>
  </div>
</aside>

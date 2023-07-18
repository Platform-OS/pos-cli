<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { page } from '$app/stores';
import { user } from '$lib/api/user.js';

import Aside from '$lib/ui/Aside.svelte';


// properties
// ------------------------------------------------------------------------
// currently viewed user data (object)
let item;


// purpose:		gets the user data
// attributes:	id of the user (int)
// returns:		a single user data object from the database (object)
// ------------------------------------------------------------------------
const load = async () => {
  const filters = {
    attribute: 'id',
    value: $page.params.id
  };

  await user.get(filters).then(response => {
    item = response.results[0];
  });
}

$: $page.params.id && load();

</script>


<!-- ================================================================== -->
<style>

.info {
  display: flex;
  gap: 1.2rem;
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
  flex-grow: 0;
  overflow: hidden;

  word-wrap: break-all;
  text-overflow: ellipsis;
  font-weight: 500;
}

</style>



<!-- ================================================================== -->
<svelte:head>
  <title>{item?.email ?? 'Users'} | platformOS</title>
</svelte:head>

<Aside title={item?.email ?? item?.id ?? 'Loading…'} closeUrl="/users?{$page.url.searchParams.toString()}">

  <div>
    <div class="info">
      {#if item?.id}ID: {item?.id}{/if}
      <time datetime={item?.created_at}>
        {(new Date(item?.created_at)).toLocaleDateString(undefined, {})}
        {(new Date(item?.created_at)).toLocaleTimeString(undefined, {})}
      </time>
    </div>
  </div>

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

</Aside>

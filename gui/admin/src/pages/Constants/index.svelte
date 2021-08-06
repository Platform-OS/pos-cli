<script>
  import fetchConstants from "./fetchConstants";
  import Item from "./Item.svelte";
  import NewItem from "./NewItem.svelte";
  import Details from "./Details.svelte";
  import { constants } from "./store.js";

  fetchConstants();
</script>

<ul class="pb-4">
  {#each $constants as item (item.name)}
    <Item {item} />
  {/each}

  <NewItem />

  <Details />
</ul>

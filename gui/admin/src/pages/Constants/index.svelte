<script>
  import fetchConstants from "./fetchConstants";
  import Item from "./Item.svelte";
  import { constants } from "./store.js";

  fetchConstants();
</script>

<ul>
  <li class="flex">
    <span class="w-1/3 ml-2 mb-4 font-bold">NAME</span>
    <span class="w-1/3 ml-2 mb-4 font-bold">VALUE</span>
  </li>

  {#each $constants as item (item.name)}
    <Item {item} newItem={false} />
  {/each}

  <Item item={{ name: "", value: "" }} newItem={true} />

  <details class="mt-4 ">
    <summary class="text-gray-600"> Raw data </summary>
    <pre class="text-sm bg-gray-200 break-all overflow-x-auto">
      {JSON.stringify($constants, null, 4)}
    </pre>
  </details>
</ul>

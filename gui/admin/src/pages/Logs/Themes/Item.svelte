<script>
  import { get } from "svelte/store";
  import { format } from "date-fns";
  import stringify from "../stringify";

  const isJson = (msg) => {
    try {
      JSON.parse(msg);
      return true;
    } catch (e) {
      return false;
    }
  };

  export let log;
  export let cachedLastId;

  let formatted = false;
</script>

<li
  class="{log.isHighlighted ? 'text-red-800' : ''}
  text-sm mb-2
  flex flex-wrap lg:flex-nowrap items-start justify-between shadow border border-gray-200 p-2
  "
>
  <div class="flex flex-wrap items-center lg:w-32">
    <span class="mx-2">{log.error_type}</span>

    {#if isJson(log.message)}
      <label
        for="cv-{log.id}"
        class="cursor-pointer px-2 py-1 lg:ml-2 lg:mt-2 bg-gray-100"
      >
        <input
          type="checkbox"
          class="cursor-pointer w-4 h-4"
          name="cv-{log.id}"
          id="cv-{log.id}"
          bind:checked={formatted}
        />
        Prettify
      </label>
    {/if}
  </div>

  <span class="mx-2 text-xs lg:order-first"
    >{format(new Date(log.updated_at), "dd/MM hh:mm:ss")}</span
  >

  <div class="w-full break-all items-start">
    {#if isJson(log.message)}
      <p class="font-mono max-h-72 overflow-y-auto">
        {@html stringify(log.message, { formatted: formatted })}
      </p>
    {:else}
      {log.message}
    {/if}
  </div>
</li>

{#if log.id === get(cachedLastId)}
  <li class="relative my-5">
    <hr class="bg-red-700 h-1" />
    <span
      class="text-sm absolute -top-3 left-1/2 bg-white px-4 py-1"
    >
      NEW
    </span>
  </li>
{/if}

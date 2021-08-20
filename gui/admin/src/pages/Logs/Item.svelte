<script>
  import { get } from "svelte/store";
  import { format, formatRelative } from "date-fns";
  import stringify from "./stringify";
  import highlight from "./highlight";

  const isJson = (msg) => {
    try {
      JSON.parse(msg);
      return true;
    } catch (e) {
      return false;
    }
  };

  const shouldShow = ({ error_type, message }, filter) => {
    const typeLower = log.error_type.toLowerCase();
    const messageLower = log.message.toLowerCase();
    const filterL = filter.toLowerCase();

    return typeLower.indexOf(filterL) > -1 || messageLower.indexOf(filterL) > -1;
  }

  export let log;
  export let cachedLastId;
  export let filter;

  let formatted = false;
</script>

{#if shouldShow(log, filter)}

  <li
    class="{log.isHighlighted ? 'text-red-800' : ''}
    text-sm mb-2
    flex flex-wrap lg:flex-nowrap items-start justify-between shadow border border-gray-200 p-2
    "
  >
    <div class="flex flex-wrap items-center lg:w-48">
      <span class="mx-2 break-all">{log.error_type}</span>

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

    <span class="mx-2 text-xs lg:order-first lg:hidden"
      title="{format(new Date(log.updated_at), "dd/MM hh:mm:ss")}">
      {formatRelative(new Date(log.updated_at), new Date())}
    </span>

    <span class="mx-2 text-xs lg:order-first lg:inline-flex hidden"
      >{format(new Date(log.updated_at), "dd/MM hh:mm:ss")}
    </span>


    <div class="w-full break-all items-start pl-2 mt-1">
      {#if isJson(log.message)}
        <p class="font-mono overflow-x-auto { formatted ? '' : 'max-h-96' }">
          {@html stringify(log.message, { formatted: formatted })}
        </p>
      {:else}
        {@html highlight(log.message, filter)}
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
{/if}
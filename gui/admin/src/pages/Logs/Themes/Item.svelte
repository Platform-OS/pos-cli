<script>
  import { format } from "date-fns";
  import stringify from "../stringify";

  const isJson = msg => {
    try {
      JSON.parse(msg);
      return true;
    } catch (e) {
      return false;
    }
  }

  export let log;

  let formatted = false;
</script>

<li
  class="{log.isHighlighted ? 'text-red-800' : ''} text-sm mb-2
  flex flex-wrap items-center justify-between shadow border border-gray-200 py-2
  "
>

  <span class={"mx-2 text-xs"}>{log.error_type}</span>

  {#if isJson(log.message)}
    <label for="cv" class="mx-auto cursor-pointer px-2 py-1 bg-gray-200">
      <input type="checkbox" class="cursor-pointer w-4 h-4" name="cv" id="cv" bind:checked={formatted} />
      Prettify
    </label>
  {/if}


  <span class="mx-2 text-xs"
    >{format(new Date(log.updated_at), "dd/MM/yyyy HH:mm:ss")}</span
  >

  <div class="w-full p-2 break-all" title={log.message}>
    {#if isJson(log.message)}
      <p class="font-mono">
        {@html stringify(log.message, { formatted: formatted })}
      </p>
    {:else}
      {log.message}
    {/if}
  </div>
</li>

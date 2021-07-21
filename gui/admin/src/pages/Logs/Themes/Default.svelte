<script>
  import { format } from "date-fns";
  import stringify from "../stringify";
  import { logs } from "../store.js";
</script>

<ul>
  {#each $logs as { id, isHighlighted, message, error_type, updated_at } (id)}
    <li
      class="text-sm
  {isHighlighted ? 'text-red-800' : ''} text-sm mb-2
  flex flex-wrap items-center justify-between shadow border border-gray-200 py-2
  "
    >
      <span class={"mx-2 text-xs"}>{error_type}</span>

      <span class="mx-2 text-xs"
        >{format(new Date(updated_at), "dd/MM/yyyy HH:mm:ss")}</span
      >

      <div class="w-full px-2 break-all" title={stringify(message)}>
        {@html stringify(message, { pretty: true })}
      </div>
    </li>
  {/each}
</ul>

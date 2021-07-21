<script>
  import { format } from "date-fns";
  import stringify from "../stringify";
  import { logs } from "../store.js";
</script>

<ul>
  {#each $logs as { id, isHighlighted, message, error_type, updated_at } (id)}
    <li
      class="text-sm
  flex items-center justify-between shadow border border-gray-200 py-2
  "
    >
      <span class="w-64 ml-4 {isHighlighted ? 'text-red-800' : ''}"
        >[{format(new Date(updated_at), "HH:mm:ss")}] {error_type}</span
      >
      <pre
        class="ml-4 flex-1 px-2 py-3 bg-gray-200 break-all overflow-y-auto"
        title={format(
          new Date(updated_at),
          "dd/MM/yyyy HH:mm:ss"
        )}>

        {@html stringify(message, { pretty: true })}
      </pre>
    </li>{/each}
</ul>

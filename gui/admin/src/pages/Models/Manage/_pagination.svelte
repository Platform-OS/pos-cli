<script>
  import { get } from "svelte/store";
  import modelsStore from "./_models-store";
  import pageStore from "./_page-store";

  const incrementPage = () => {
    pageStore.increment();
    const ps = get(pageStore);
    modelsStore.refreshModels(ps.schemaId, ps.page);
  }

  const decrementPage = () => {
    pageStore.decrement();
    const ps = get(pageStore);
    modelsStore.refreshModels(ps.schemaId, ps.page);
  }
</script>

<ul class='flex justify-between'>
  <li>
    <button on:click="{decrementPage}" class="button secondary">Previous page</button>
  </li>
  <li>Total Pages: {$pageStore.total_pages}</li>
  <li>Current page: {$pageStore.page}</li>
  <li>
    <button on:click="{incrementPage}" class="button secondary">Next page</button>
  </li>
</ul>
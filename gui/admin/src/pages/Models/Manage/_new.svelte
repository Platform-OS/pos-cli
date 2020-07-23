<script>
  import { slide } from "svelte/transition";
  import { notifier } from "@beyonk/svelte-notifications";

  import NewModelInputField from "@/_components/NewModelInputField.svelte";
  import api from "@/lib/api";

  import modelsStore from "./_models-store";

  let showNewForm = false;

  export let schemaId;
  export let schemaName;
  export let props;

  let newProps = {};

  const handleSubmit = () => {
    api.createModel(schemaName, newProps).then(data => {
      if (data) {
        modelsStore.refreshModels(schemaId);
        data && notifier.success("Model created.");
        showNewForm = false;
      }
    });
  }
</script>

<!-- TODO: Extract toggle button to improve flexibility / styling -->
<button on:click={() => (showNewForm = !showNewForm)} class="my-4 ml-auto button">
  {#if showNewForm}-{:else}+{/if} New record
</button>

{#if showNewForm}
  <form class="flex flex-wrap p-6 mb-4 border border-blue-500 rounded"
    on:submit|preventDefault={handleSubmit} in:slide out:slide>
    {#each props as { name, attribute_type }, i}
      <div class="w-5/12 mb-2 mr-4">
        <NewModelInputField {attribute_type} {name} value="" placeholder="{attribute_type}" bind:newProps />
      </div>
    {/each}

    <br />

    <div class="flex w-full mt-4">
      <button class="button">Create</button>
      <button type="button" class="ml-4 button link" on:click={() => (showNewForm = !showNewForm)}>Cancel</button>
    </div>
  </form>
{/if}

<script>
  import { slide } from "svelte/transition";
  import { notifier } from "@beyonk/svelte-notifications";

  import filtersStore from "./_filters-store";
  import modelsStore from "./_models-store";

	import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  export let props;
  export let schemaId;

  let showFilters = false;
  let selectedOperation = '';
  let selectedProperty = '';

  const handleSubmit = (evt) => {
    const form = evt.target;
    const fd = new FormData(form);
    const filters = Object.fromEntries(fd);

    filtersStore.set(filters);
    modelsStore.refreshModels(schemaId);
    notifier.info("Refreshing models...");
  }

  const getPropType = (props, name) => {
    const prop = props.find(prop => prop.name === name);
    if (prop) {
      return prop.attribute_type;
    }
  }

  const showValueField = (op, { attribute_type: type }) => {
    if (op === "value-in" || op === "value-not-in") {
      if (type === 'array') return true;
      return false;
    }

    return true;
  }

  const getHint = op => {
    if (op === 'range') return '{ gt: "10", lt: "20" } - remember about JSON format';
    if (op === 'value_in' || op === 'not_value_in') return '[10, 20, 30] - remember about square brackets';
    if (op === 'ends_with' || op === 'not-ends-with') return '"corolla" - remember about quotes';
    if (op === 'starts_with' || op === 'not-starts-with') return '"toyota" - remember about quotes';
    if (op === 'exists' || op === 'not-starts-with') return 'true';

    return '"toyota" - remember about quotes';
  }

</script>

<button on:click={() => (showFilters = !showFilters)} class="my-4 ml-auto button">
{#if showFilters}-{:else}+{/if} Filter
</button>

{#if showFilters}
  <form class="flex flex-wrap items-center p-6 mb-4 border border-blue-500 rounded"
    on:submit|preventDefault={handleSubmit} in:slide out:slide>

    <select name="property" class="mr-4 form-select"
      bind:value="{selectedProperty}"
      on:blur="{() => selectedOperation = undefined}"
      required>

      <option value="" class="text-gray-500">Choose property</option>
      {#each props as prop, i}
        <option value="{prop.name}">{prop.name} ({prop.attribute_type})</option>
      {/each}
    </select>

    <select name="operation" class="mr-2 form-select" bind:value="{selectedOperation}" required>
      <option value="" class="text-gray-500">Choose filter type</option>

      <option value="contains">contains</option>
      <option value="exists">exists</option>
      <option value="not_contains">not contains</option>

      {#if selectedProperty.attribute_type === 'string'}
        <option value="ends_with">ends with</option>
        <option value="starts_with">starts with</option>
        <option value="not_ends_with">not ends with</option>
        <option value="not_starts_with">not starts with</option>
      {/if}

      {#if selectedProperty.attribute_type === 'integer' || selectedProperty.attribute_type === 'float'}
        <option value="range">range</option>
      {/if}

      {#if selectedProperty.attribute_type === 'array'}
        <option value="value_in">value in</option>
        <option value="not_value_in">not value in</option>
      {/if}
    </select>

    <input type="hidden" name="type" value="{getPropType(props, selectedProperty)}">

    {#if showValueField(selectedOperation, selectedProperty)}
      <input type="text" name="value" class="w-64 form-input" />
      <p class="ml-4 text-gray-600">Example: {getHint(selectedOperation)}</p>
    {/if}

    <br />

    <div class="flex w-full mt-4">
      <button class="button">Filter</button>
      <button type="button" class="ml-4 button link" on:click={() => filtersStore.reset()}>Cancel</button>
    </div>
  </form>
{/if}

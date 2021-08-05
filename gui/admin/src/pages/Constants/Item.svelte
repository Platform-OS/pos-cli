<script>
  import api from "@/lib/api";
  import fetchConstants from "./fetchConstants";

  export let item;
  export let newItem;
  let valueEl;
  let nameEl;

  const updateConstant = () => {
    const newName = newItem ? nameEl.value : item.name;

    api.setConstant(newName, valueEl.value).then(() => {
      fetchConstants();

      if (newItem) {
        valueEl.value = "";
        nameEl.value = "";
      }
    });
  };

  const deleteConstant = () => {
    api.unsetConstant(nameEl.textContent.trim()).then(() => {
      fetchConstants();
    });
  };
</script>

<li class="flex items-center mb-2 p-2 bg-gray-100">
  {#if newItem}
    <input
      class="min-w-48 p-1 bg-white text-gray-600"
      type="text"
      value=""
      required
      placeholder="Name"
      bind:this={nameEl}
    />
  {:else}
    <span class="min-w-48" bind:this={nameEl}>{item.name}</span>
  {/if}

  <input
    class="w-full mx-4 p-1 bg-white text-gray-600"
    type="text"
    value={item.value}
    required
    placeholder="Value"
    bind:this={valueEl}
  />

  <button
    on:click={updateConstant}
    class="rounded p-1 border border-gray-300 mx-4 w-36"
    >{newItem ? "Add new" : "Update"}</button
  >

  {#if !newItem}
    <button
      on:click={deleteConstant}
      class="rounded p-1 border border-gray-300 ml-auto">Delete</button
    >
  {/if}
</li>

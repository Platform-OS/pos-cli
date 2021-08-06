<script>
  import api from "@/lib/api";
  import fetchConstants from "./fetchConstants";

  export let item;
  let valueEl;
  let nameEl;

  const updateConstant = () => {
    const name = item.name;
    const value = valueEl.value;

    api.setConstant(name, value).then(fetchConstants); // sorry, no sorry :)
  };

  const deleteConstant = () => {
    const name = nameEl.textContent.trim();

    api.unsetConstant(name).then(fetchConstants); // sorry, no sorry :)
  };
</script>

<li class="rounded mb-4 px-4 py-2 bg-gray-100">
  <form
    action=""
    class="flex flex-wrap justify-between w-full"
    on:submit|preventDefault={updateConstant}
  >
    <label for="val" class="font-semibold cursor-pointer" bind:this={nameEl}>{item.name}</label>

    <button
      type="button"
      on:click={deleteConstant}
      class="rounded px-2 py-1 text-sm border border-gray-300 mb-2">Delete</button
    >

    <input
      class="rounded w-full px-2 py-1 mb-2 bg-white text-gray-600"
      type="text"
      id="val"
      value={item.value}
      required
      placeholder="Value"
      bind:this={valueEl}
    />

    <button
      class="rounded py-1 px-2 bg-green-800 text-white">Save</button
    >
  </form>
</li>

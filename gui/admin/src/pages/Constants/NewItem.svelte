<script>
  import api from "@/lib/api";
  import fetchConstants from "./fetchConstants";

  let valueEl;
  let nameEl;

  const updateConstant = () => {
    api
      .setConstant(nameEl.value, valueEl.value)
      .then(fetchConstants)
      .then(() => {
        valueEl.value = "";
        nameEl.value = "";
      });
  };
</script>

<li class="rounded mb-3 px-4 py-2 bg-gray-100">
  <h2 class="font-semibold mb-2">New item</h2>

  <form
    action=""
    class="flex flex-wrap justify-between w-full"
    on:submit|preventDefault={updateConstant}
  >
    <input
      class="w-1/2 mb-2 rounded px-2 py-1 bg-white text-gray-600"
      type="text"
      value=""
      required
      placeholder="Name"
      bind:this={nameEl}
    />

    <input
      class="rounded w-full px-2 py-1 mb-2 bg-white text-gray-600"
      type="text"
      value=""
      required
      placeholder="Value"
      bind:this={valueEl}
    />

    <button class="rounded py-1 px-2 bg-green-800 text-white">Save</button>
  </form>
</li>

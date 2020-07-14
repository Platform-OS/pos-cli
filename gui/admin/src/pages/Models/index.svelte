<script>
  import api from "@/lib/api";
  import { onMount } from "svelte";
  import { url } from "@sveltech/routify";

  const getModelSchemas = async () => await api.getModelSchemas();

  const getProps = props => {
    const list = props
      .map(prop => {
        return `<p class="flex items-center mb-2 text-gray-600">${prop.name} (${prop.attribute_type})</p>`;
      })
      .join("");

    return list;
  };
</script>

<h1 class="text-5xl">Models</h1>

<section class="overflow-hidden text-gray-700 body-font">
  <div class="container py-12">
    <div class="flex flex-wrap">

      {#await getModelSchemas()}
        <p>Loading...</p>
      {:then data}
        {#each data as { id, name, properties } (id)}
          <a
            class="w-full pr-6 xl:w-1/3 md:w-1/2"
            href={$url('../Manage/:id', { id })}>
            <div
              class="relative flex flex-col h-full p-6 overflow-hidden border-2 border-gray-300 rounded-lg hover:bg-gray-200">
              <h2 class="mb-1 text-sm font-medium tracking-widest title-font">
                schema name
              </h2>
              <h1
                class="pb-4 mb-4 text-2xl leading-none text-gray-900 border-b border-gray-400">
                {name}
              </h1>

              <h2 class="mb-4 text-sm font-medium tracking-widest title-font">
                Properties
              </h2>
              {@html getProps(properties)}
            </div>
          </a>
        {/each}
      {/await}
    </div>
  </div>
</section>

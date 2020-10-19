<script>
  import api from "@/lib/api";
  import { onMount } from "svelte";
  import { url } from "@sveltech/routify";

  const getModelSchemas = async () => await api.getModelSchemas();

  const getProps = props => {
    const items = props
      .map(prop => {
        return `<li>${prop.name} (${prop.attribute_type})</li>`;
      })
      .join("");

    const list = `
      <ul class="grid grid-cols-2 gap-2 text-sm list-disc list-inside">
        ${items}
      </ul>
    `;

    return list;
  };
</script>

<h1 class="mb-2 text-5xl">Models</h1>
<p>Choose schema that you want to see models for.</p>

<section class="overflow-hidden">
  <div class="container py-8">
    <div class="grid gap-5 lg:grid-cols-3 md:grid-cols-2">

      {#await getModelSchemas()}
        <p>Loading...</p>
      {:then data}
        {#each data as { id, name, properties } (id)}
          <a
            class=""
            href={$url('../Manage/:id', { id })}>
            <div
              class="relative flex flex-col h-full p-5 bg-gray-200 border border-gray-400 hover:bg-gray-300 hover:shadow-md">
              <h1
                class="pb-2 mb-2 text-2xl leading-relaxed">
                {name}
              </h1>

              {@html getProps(properties)}
            </div>
          </a>
        {/each}
      {/await}
    </div>
  </div>
</section>

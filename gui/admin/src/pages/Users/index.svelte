<script>
  import api from "@/lib/api";
  // import { url } from "@sveltech/routify";

  const gu = async () => await api.getUsers();
</script>

<h1 class="mb-2 text-5xl">Users</h1>
<p>Choose schema that you want to see models for.</p>

<section class="overflow-hidden">
  <div class="container py-8">
    <div class="grid gap-5 lg:grid-cols-3 md:grid-cols-2">

      {#await gu()}
        <p>Loading...</p>
      {:then data}
        {{ data }}
        <!-- {#each data as { id } (id)}
          Users: {{ id }}
        {/each} -->
      {/await}
    </div>
  </div>
</section>

<script>
  import api from "@/lib/api";
  import { url } from "@sveltech/routify";

  const users = async () => {
    const res = await api.getUsers();
    return res.users.results;
  };

</script>

<h1 class="mb-2 text-5xl">Users</h1>
<p>Choose schema that you want to see models for.</p>

<section class="overflow-hidden">
  <div class="container py-8">
    <div class="grid gap-5 lg:grid-cols-2">

      {#await users()}
        <p>Loading...</p>
      {:then data}
        {#each data as { id, email, deleted_at, created_at, first_name, last_name, external_id, jwt_token, temporary_token } (id)}
          <a
            class=""
            href={$url('../Manage/:id', { id })}>
            <div
              class="relative flex flex-col h-full p-5 bg-gray-200 border border-gray-400 hover:bg-gray-300 hover:shadow-md">
              <h1
                class="flex justify-between pb-2 mb-2 text-2xl leading-relaxed">
                 <span>{email}</span>
                 <span>ID: {id}</span>
              </h1>

              <ul class="text-sm">
                <li>First name: {first_name} </li>
                <li>Last name: {last_name} </li>
                <li class="pt-2 mt-4 text-xs border-t border-gray-400"></li>
                {#if external_id && external_id.length > 5}
                  <li class="text-xs">External ID: {external_id}</li>
                {/if}
                <li class="text-xs">JWT: {jwt_token} </li>
              </ul>
            </div>
          </a>
        {/each}
      {/await}
    </div>
  </div>
</section>

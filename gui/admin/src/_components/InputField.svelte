<script>
  import { createEventDispatcher } from "svelte";
  const dispatch = createEventDispatcher();

  export let id;
  export let attribute_type;
  export let name;
  export let value = "";

  // TODO: Rewrite to store?
  const propagateUpdate = e => {
    const data = {
      id,
      props: {
        [name]: {
          name,
          value: e.target.value,
          attribute_type,
        }
      }
    }

    dispatch("formChanged", data);
  }
</script>

<label class="block w-10/12">
  <span class="w-full">{name}</span>
  <br>
  {#if attribute_type === 'text'}
    <textarea class="w-10/12 mr-2 form-input"
      value="{JSON.stringify(value)}"
      {name}
      on:input={propagateUpdate}
      rows="3"
    />
  {:else}
    <input class="w-10/12 mr-2 form-input"
      type="text"
      value="{JSON.stringify(value)}"
      {name}
      on:input={propagateUpdate}
    />
  {/if}
</label>

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

<label class="block w-10/12" for="attr_type">
  <span class="w-full">{name}</span>
  <br>
  {#if attribute_type === 'text' || attribute_type === 'upload' || attribute_type === 'array'}
    <textarea class="w-full mr-2 form-input" rows="3"
      value="{JSON.stringify(value, null, 2)}"
      placeholder={attribute_type}
      {name}
      id="attr_type"
      on:input={propagateUpdate}
    />
  {:else}
    <input class="w-full mr-2 form-input" type="text"
      value="{value ? JSON.stringify(value) : ''}"
      placeholder={attribute_type}
      {name}
      id="attr_type"
      on:input={propagateUpdate}
    />
  {/if}
</label>

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

  const getValue = val => {
    return val ? JSON.stringify(val) : '';
  }
</script>

<label class="block w-10/12">
  <span class="w-full">{name}</span>
  <br>
  {#if attribute_type === 'text'}
    <textarea class="w-10/12 mr-2 form-input" rows="3"
      value="{getValue(value)}"
      placeholder={attribute_type}
      {name}
      on:input={propagateUpdate}
    />
  {:else}
    <input class="w-10/12 mr-2 form-input" type="text"
      value="{getValue(value)}"
      placeholder={attribute_type}
      {name}
      on:input={propagateUpdate}
    />
  {/if}
</label>

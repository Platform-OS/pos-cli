<script>
  import { createEventDispatcher } from "svelte";
  const dispatch = createEventDispatcher();

  export let id;
  export let attribute_type;
  export let name;
  export let value = "";

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
  <input
    class="w-10/12 mr-2 form-input"
    type="text"
    {value}
    {name}
    on:input={propagateUpdate}
  />
</label>

<script>
  export let newProps;

  export let attribute_type;
  export let name;
  export let value = "";

  function setProp({ name, value, attribute_type }) {
    newProps[name] = {
      name,
      value,
      attribute_type
    };
  }
</script>

<label class="block w-10/12">
  <p class="w-full mb-2">{name} <span class="text-gray-600">({attribute_type})</span></p>
  <input
    class="w-10/12 mr-2 form-input"
    type="text"
    {value}
    on:input={e => {
      setProp({ name, value: e.target.value, attribute_type });
    }} />
</label>

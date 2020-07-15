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
  const getExample = type => {
    if (type === 'string' || type === 'text') return '"my text"';
    if (type === 'integer') return '1337';
    if (type === 'float') return '13.37';
    if (type === 'array') return '["my", "array", 10]';
    if (type === 'boolean') return 'true';
    if (type === 'datetime') return '"2019-04-03T00:00:00.000Z"';
  }
</script>

<label class="block w-10/12">
  <p class="w-full mb-2">{name} <span class="text-gray-600">({attribute_type})</span></p>
  <input
    class="w-10/12 mr-2 form-input"
    type="text"
    {value}
    placeholder="{getExample(attribute_type)}"
    on:input={e => {
      setProp({ name, value: e.target.value, attribute_type });
    }} />
</label>

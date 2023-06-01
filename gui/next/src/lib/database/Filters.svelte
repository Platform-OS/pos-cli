<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { state } from '$lib/state.js';
import { record } from '$lib/api/record.js';

import Icon from '$lib/ui/Icon.svelte';


// properties
// ------------------------------------------------------------------------
// main filters form (dom node)
let form;


// lists allowed operations for given type
// ------------------------------------------------------------------------
const operations = {
	id: ['value'],
	string: ['value', 'exists', 'contains', 'ends_with', 'not_contains', 'not_ends_with', 'not_starts_with', 'not_value', 'starts_with'],
	text: ['value', 'exists', 'not_value'],
	array: ['array_contains', 'value_in', 'exists', 'array_overlaps', 'not_array_contains', 'not_array_overlaps', 'not_value_array', 'not_value_in', 'value_array'],
	boolean: ['value_boolean', 'exists', 'not_value_boolean'],
	integer: ['value_int', 'exists', 'not_value_int', 'range'],
	float: ['value_float', 'exists', 'not_value_float', 'range'],
	upload: ['value', 'exists', 'not_value'],
	datetime: ['value', 'exists', 'not_value'],
	date: ['value', 'exists', 'not_value']
};


// purpose:		parses the <form>, saves new filters to the store and triggers records reload
// ------------------------------------------------------------------------
const filter = () => {
	$state.filters = { page: 1, attributes: [ Object.fromEntries((new FormData(form)).entries()) ] };

	record.get({ table: $state.table.id, filters: $state.filters });
}

</script>


<!-- ================================================================== -->
<style>

fieldset {
	display: flex;
	gap: .2em;
	align-items: center;
}

[type="number"] {
	width: 10ch;
}

</style>



<!-- ================================================================== -->
<form bind:this={form} on:submit|preventDefault={filter}>

	{#if $state.table?.properties}

		{#each $state.filters.attributes as attribute, i}
			<fieldset>

				Filter by:

				<select name="name" bind:value={attribute.name} on:change={ () => { attribute.attribute_type = ($state.table.properties.find(property => property.name === attribute.name))?.attribute_type || 'id'; } }>
					<option value="id">id</option>
					{#each $state.table.properties as property}
						<option value={property.name}>
							{property.name}
						</option>
					{/each}
				</select>

				<input type="hidden" name="attribute_type" bind:value={attribute.attribute_type}>

				{#if operations[attribute.attribute_type]}

					<select name="operation" bind:value={attribute.operation}>
						{#each operations[attribute.attribute_type] as operation}
							<option value={operation}>{operation}</option>
						{/each}
					</select>

					{#if attribute.operation === 'exists'}
						<select name="value">
							<option value="true">true</option>
							<option value="false">false</option>
						</select>
					{:else if attribute.operation === 'range'}
						<select name="maxFilter">
							<option value="gt">&gt;</option>
							<option value="gte">≥</option>
						</select>
						<input type="number" name="maxFilterValue" value={attribute.maxFilterValue}>
						<select name="minFilter">
							<option value="lt">&lt;</option>
							<option value="lte">≤</option>
						</select>
						<input type="number" name="minFilterValue" value={attribute.minFilterValue}>
					{:else}
						<input type="text" name="value" bind:value={attribute.value}>
					{/if}

					<button type="submit" class="button">
						<span class="label">Apply filters</span>
						<Icon icon="arrowRight" />
					</button>

				{:else}

					Unknow property type: <code>{attribute.attribute_type}</code>

				{/if}

			</fieldset>
		{/each}

	{/if}

</form>

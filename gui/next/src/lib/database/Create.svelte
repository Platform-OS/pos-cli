<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { onMount } from 'svelte';
import { quintOut } from 'svelte/easing';
import { page } from '$app/stores.js';
import { state } from '$lib/state.js';
import { record } from '$lib/api/record.js';
import { parseValue } from '$lib/parseValue.js';
import { tryParseJSON } from '$lib/tryParseJSON.js';
import autosize from 'svelte-autosize';

import Icon from '$lib/ui/Icon.svelte';
import Toggle from '$lib/ui/forms/Toggle.svelte';


// properties
// ------------------------------------------------------------------------
// list of properties for given record (array)
export let properties;
// record data, if editing (object)
export let editing;
// main container for the component (dom node)
let container;
// edit form (dom node)
let form;
// list of errors for the current form (array of objects)
let errors = [];
// if we should original values instead of parsed JSON for string types (bool)
let dontParseStringedJson = false;


// transition: 	fades and resizes from 0
// options: 	delay (int), duration (int)
// ------------------------------------------------------------------------
const appear = function(node, {
	delay = 0,
	duration = 150
}){
	return {
		delay,
		duration,
		css: (t) => {
			const eased = quintOut(t);

			return `opacity: ${eased}; transform: scale(${eased});` }
	}
};


// purpose: 	use JS to open the modal on mount to get all of the <modal> benefits
// ------------------------------------------------------------------------
onMount(() => {
	setTimeout(() => {
		container.showModal();
	}, 10);
});


// purpose: 	handles keyboard shortcuts
// ------------------------------------------------------------------------
document.addEventListener('keydown', event => {
	if(event.key === 'Escape'){
		event.preventDefault();

		$state.record = null;
	}
}, { once: true });



const save = async (event) => {
	event.preventDefault();

	// create new record
	if(!$state.record.id){
		const create = await record.create({ table: $state.table.name, properties: new FormData(form) });

		if(!create.errors){
			state.clearFilters();
			record.get({ table: $page.params.id, filters: $state.filters });
			state.highlight('record', create.model_create.id);
			state.notification.create('success', `Record ${create.model_create.id} created`);
			$state.record = null;
		} else {
			errors = create.errors;
		}
	}
	// edit existing record
	else {
		const edit = await record.edit({ table: $state.table.name, id: $state.record.id, properties: new FormData(form) });

		if(!edit.errors){
			state.clearFilters();
			record.get({table: $page.params.id, filters: $state.filters });
			state.highlight('record', edit.model_update.id);
			state.notification.create('success', `Record ${edit.model_update.id} updated`);
			$state.record = null;
		} else {
			errors = edit.errors;
		}
	}
	
};

</script>


<!-- ================================================================== -->
<style>

dialog {
	height: 100vh;
	overflow: hidden;
	display: flex;
	align-items: center;
	justify-content: center;
	position: absolute;
	inset: 0;
	z-index: 100;	
}

	dialog::backdrop {
		background-color: rgba(var(--color-rgb-background), .6);
	}


.content {
	width: clamp(300px, 800px, 80vw);
	max-height: 94vh;
	overflow: auto;

	border-radius: 1rem;
}


form {
	display: flex;
	flex-direction: column;
	gap: 1rem;
	padding: 2rem;
}

fieldset {
	display: grid;
	grid-template-columns: 1fr 2fr;
	gap: 1rem;
}

fieldset + fieldset {
	margin-block-start: 2rem;
}

label {
	word-break: break-all;
}

.type {
	margin-block-start: .2rem;
	opacity: .5;

	font-size: .9em;
}

textarea {
	max-height: 40rem;
}


.footer {
	padding: 1.5rem 0;
	position: sticky;
	bottom: 0;
	gap: 1rem;

	background-color: var(--color-context);
}

.error li {
	margin-block-end: 1rem;
	padding: 1rem;

	border-radius: 1rem;
	background-color: var(--color-danger);
	
	color: var(--color-text-inverted);
}

.actions {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

</style>



<!-- ================================================================== -->
<dialog bind:this={container} transition:appear>

	<div class="content content-context">

		<form bind:this={form} on:submit|preventDefault={save}>

			<input type="hidden" name="tableName" value={$state.table.name}>
			{#if editing.id}
				<input type="hidden" name="recordId" value={editing.id}>
			{/if}

			{#each properties as property}
				{@const value = editing.properties ? parseValue(editing.properties[property.name], property.attribute_type) : {type: property.attribute_type, value: ''}}
				<fieldset>
					<dir>
						<label for="edit_{property.name}">
							{property.name}<br>
							<div class="type">
								{#if property.attribute_type === 'string'}
									<Toggle name="{property.name}[type]" options={[{ value: 'string', label: 'string' }, { value: 'json', label: 'json' }]} checked={value.type === 'json' ? 'json' : 'string'} />
								{:else}
									{property.attribute_type}
									<input type="hidden" name="{property.name}[type]" value={property.attribute_type}>
								{/if}
								{#if property.attribute_type === 'upload'}
									(non editable)
								{/if}
								<input type="hidden" name="{property.name}[parsedType]" value={value.type} />
							</div>
						</label>
					</dir>
					<textarea
						rows="1"
						name="{property.name}[value]"
						id="edit_{property.name}"
						use:autosize
						disabled={property.attribute_type === 'upload'}
					>{value.type === 'json' || value.type === 'jsonEscaped' && !dontParseStringedJson ? JSON.stringify(value.value, undefined, 2) : value.value}</textarea>
				</fieldset>
			{/each}

			<div class="footer">
				<ul class="error" aria-live="assertive">
					{#each errors as error}
						<li>
							{JSON.stringify(errors)}
						</li>
					{/each}
				</ul>
				<fieldset class="actions">
					<button type="button" class="button" on:click={() => $state.record = null}>Cancel</button>
					<button type="submit" class="button">
						{#if editing.id}
							Edit record
						{:else}
							Create record
						{/if}
						<Icon icon="arrowRight" />
					</button>
				</fieldset>
			</div>

		</form>

	</div>

</dialog>

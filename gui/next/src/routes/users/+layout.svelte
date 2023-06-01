<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { page } from '$app/stores';
import { user } from '$lib/api/user.js';

import Icon from '$lib/ui/Icon.svelte';


// properties
// ------------------------------------------------------------------------
// main form with all the filters (dom node)
let form;
// string used for filtering (string)
let filterString = null;
// list of users (array)
let items = [];
// currently viewed page (int)
let currentPage = 1;
// number of pages (int)
let maxPage = 1;


const load = async () => {
	await user.get(new FormData(form)).then(response => {
		items = response.results;
		maxPage = response.total_pages
	});
};

load();

</script>


<!-- ================================================================== -->
<style>

.container {
	width: 100%;

	display: flex;
}

nav {
	width: 100%;
	padding: 1rem;

	background-color: var(--color-background);
}

.filters form {
	display: flex;
	align-items: center;
	gap: .5em;
}

.filters input {
	padding-inline-end: 2.2rem;
}

.filters fieldset {
	position: relative;
}

.filters .clear {
	padding: .5rem;
	position: absolute;
	right: .3em;
	top: 1px;

	transition: all .1s linear;
}

	.filters .clear.disabled {
		opacity: 0;
	}

	.filters .clear:hover {
		color: var(--color-interaction-hover);
	}

section {
	flex-grow: 1;
	height: calc(100vh - 83px);
	display: flex;
	flex-direction: column;
	overflow: auto;
	position: relative;
}

table {
	min-width: 100%;
}

thead {
	position: sticky;
	top: 0;
	z-index: 50;
}

th {
	background-color: var(--color-background);

	white-space: nowrap;
	font-weight: 500;
}

td, th {
	padding: .6rem;
	vertical-align: top;

	border: 1px solid var(--color-frame);

	transition: background-color .2s linear;
}

td:first-child, th:first-child {
	width: 4rem;

	border-inline-start: 0;
	text-align: right;
}

td:last-child, th:last-child {
	border-inline-end: 0;
}


.pagination {
	margin-block-start: auto;
	display: flex;
	align-items: center;
	gap: 1rem;
	position: sticky;
	bottom: 0;
	left: 0;
	right: 0;
	z-index: 20;
}

.label {
	position: absolute;
	left: -100vw;
}

</style>


<!-- ================================================================== -->
<div class="container">

	<section>

		<nav class="filters">
			<form id="filters" bind:this={form} on:submit|preventDefault={() => { currentPage = 1; load(); }}>
				Filter by
				<select name="attribute">
					<option value="email">email</option>
					<option value="id">id</option>
				</select>
				<fieldset>
					<input type="text" name="value" bind:value={filterString}>
					<button class="clear" class:disabled={!filterString} on:click={() => { currentPage = 1; filterString = null; load(); }}>
						<span class="label">Clear filters</span>
						<Icon icon="x" size=14 />
					</button>
				</fieldset>
				<button type="submit" class="button">
					<span class="label">Apply filter</span>
					<Icon icon="arrowRight" />
				</button>
			</form>
		</nav>

		<table>
			<thead>
				<tr>
					<th>id</th>
					<th>email</th>
				</tr>
			</thead>
			{#each items as user}
				<tr>
					<td>
						{user.id}
					</td>
					<td>
						<a href="/users/{user.id}">
							{user.email}
						</a>
					</td>
				</tr>
			{/each}
		</table>

		<nav class="pagination">
			Page:
			<input
				form="filters"
				type="number"
				name="page"
				min="1"
				max={maxPage || 100}
				step="1"
				bind:value={currentPage}
				on:input={load}
			>
			of {maxPage || ''}
		</nav>

	</section>

	{#if $page.params.id}
		<slot></slot>
	{/if}

</div>

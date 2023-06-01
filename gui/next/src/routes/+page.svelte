<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import Icon from '$lib/ui/Icon.svelte';

import { state } from '$lib/state';
import { table } from '$lib/api/table';



// purpose:		preload tables data into the state store for faster navigation
// returns:		loads the tables into the $state.tables (array)
// ------------------------------------------------------------------------
const preloadTables = async () => {
	if(!$state.tables.length){
		$state.tables = await table.get();
	}
}

</script>


<!-- ================================================================== -->
<style>
	nav {
		max-width: 1400px;
		margin-inline: auto;
		margin-block-start: 2rem;
		padding-inline: 2rem;
	}

	.applications {
		display: flex;
		gap: 2rem;
		flex-wrap: wrap;
	}

	.applications + .applications {
		margin-top: 4rem;
		padding-top: 4rem;
		border-top: 1px solid var(--color-frame);
	}

	.application {
		width: calc(50% - 1rem);
		padding: 2rem;

		border-radius: 1rem;
		background-color: var(--color-background);
	}

		@media (max-width: 700px) {
			.application {
				width: 100%;
			}
		}

	.icon {
		padding: .5rem;
		display: flex;

		border-radius: .5rem;
		background-color: var(--color-middleground);

		color: var(--color-interaction);
	}

	.footer {
		margin-top: 2rem;
		margin-bottom: -1rem;
	}

	h2 {
		margin: -1rem -2rem 1rem;
		padding: 0 2rem 1rem;
		display: flex;
		align-items: center;
		gap: 1rem;

		border-bottom: 1px solid var(--color-page);

		font-size: 1.1rem;
		font-weight: 500;
	}

	ul {
		margin-block-end: 1rem;
	}

	.application li + li {
		margin-block-start: .4rem;
	}

	ul ul {
		list-style-type: '– ';
		list-style-position: inside;
	}

	.links {
		margin-block-start: 4rem;
		padding-block-start: 3.5rem;
		display: flex;
		align-items: center;
		justify-content: end;
		gap: 2rem;

		border-block-start: 1px solid var(--color-frame);
	}
</style>



<!-- ================================================================== -->
<svelte:head>
	<title>platformOS Instance Admin</title>
</svelte:head>

<nav>

	<ul class="applications">

		<li class="application">
			<h2>
				<div class="icon">
					<Icon icon="database" />
				</div>
				Manage database records in your application
			</h2>
			<ul>
				<li>Inspect tables and schemas</li>
				<li>Manage records (create, read, update, delete)</li>
			</ul>
			<div class="footer">
				<a href="/database" class="button" on:focus|once={preloadTables} on:mouseover|once={preloadTables}>
					Go to Records
					<Icon icon="arrowRight" size="13" />
				</a>
			</div>
		</li>

		<li class="application">
			<h2>
				<div class="icon">
					<Icon icon="users" />
				</div>
				Manage users
			</h2>
			<ul>
				<li>Inspect registered users</li>
				<li>Manage users (create, read, update, delete)</li>
			</ul>
			<div class="footer">
				<a href="/users" class="button">
					Go to Users
					<Icon icon="arrowRight" size="13" />
				</a>
			</div>
		</li>

		<li class="application">
			<h2>
				<div class="icon">
					<Icon icon="log" />
				</div>
				Instance Logs
			</h2>
			<ul>
				<li>View system logs about performance and others</li>
				<li>View your own logs</li>
			</ul>
			<div class="footer">
				<a href="/logs" class="button">
					Go to Logs
					<Icon icon="arrowRight" size="13" />
				</a>
			</div>
		</li>

		<li class="application">
			<h2>
				<div class="icon">
					<Icon icon="constant" />
				</div>
				Constants editor
			</h2>
			<ul>
				<li>Check all constants in one place</li>
				<li>Create, delete, update</li>
			</ul>
			<div class="footer">
				<a href="/constants" class="button">
					Go to Constants
					<Icon icon="arrowRight" size="13" />
				</a>
			</div>
		</li>

	</ul>

	<ul class="applications">

		<li class="application">
			<h2>
				<div class="icon" style="color: #aeb0b3;">
					<Icon icon="liquid" />
				</div>
				Liquid Evaluator
			</h2>
			<ul>
				<li>Run Liquid code against your instance</li>
				<li>Test Liquid logic</li>
				<li>Quickly prototype your ideas</li>
			</ul>
			<div class="footer">
				<a href="http://localhost:3333/gui/liquid" class="button">
					Go to Liquid Evaluator
					<Icon icon="arrowRight" size="13" />
				</a>
			</div>
		</li>

		<li class="application">
			<h2>
				<div class="icon" style="color: #f30e9c;">
					<Icon icon="graphql" />
				</div>
				GraphiQL
			</h2>
			<ul>
				<li>Run GraphQL against your instance</li>
				<li>Explore documentation</li>
				<li>Quickly prototype your queries and mutations</li>
			</ul>
			<div class="footer">
				<a href="http://localhost:3333/gui/graphql/" class="button">
					Go to GraphiQL
					<Icon icon="arrowRight" size="13" />
				</a>
			</div>
		</li>

	</ul>

	<ul class="links">
		
		<li>
			<a href="https://documentation.platformos.com" class="button">
				<Icon icon="book" />
				Documentation
			</a>
		</li>
		<li>
			<a href="https://partners.platformos.com" class="button">
				<Icon icon="serverSettings" />
				Partner Portal
			</a>
		</li>

	</ul>

</nav>

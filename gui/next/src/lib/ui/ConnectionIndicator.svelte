<!-- ================================================================== -->
<script>

import { onMount } from 'svelte';
import { logs } from '$lib/api/logs';
import { state } from '$lib/state';

// purpose:		check if the app is connected to the instance every 7 seconds
onMount(async () => {
	checkIfOnline();

	setInterval(checkIfOnline, 7000);
});

// purpose:		checks if the app is connected to the instance by getting some api data
// returns:		updates the $state.online store (bool) and returns a boolean response
// ------------------------------------------------------------------------
const checkIfOnline = async () => {
	if(!document.hidden){
		const last = $state.logs.logs?.at(-1).id ?? null;
		const newLogs = await logs.get({ last: last });

		// if already showing logs, just append the new ones
		if(last){
			if(newLogs.logs?.length){
				$state.logs.logs = [...$state.logs.logs, ...newLogs.logs];

				// store the times when logs were downloaded to mark new ones
				$state.logs.downloaded_at.push(Date.now());
				if($state.logs.downloaded_at.length > 2){
					$state.logs.downloaded_at.splice(0, 1);
				}
			}
		}
		// if fresh start, create the logs object
		else {
			if(!$state.logs.logs){
				$state.logs = newLogs;

				if(!$state.logs.downloaded_at){
					$state.logs.downloaded_at = [Date.now()];
				}
			}
		}

		if(newLogs.error){
			$state.online = false;
			return false;
		} else {
			$state.online = true;
			return true;
		}
	}
};

</script>



<!-- ================================================================== -->
<style>

.connectionIndicator {
	display: flex;
	align-items: center;
	gap: 1em;
}

.connectionIndicator:after {
	width: .8rem;
	height: .8rem;
	margin-inline-end: -.5em;
	display: block;
	position: relative;
	top: 1px;

	border-radius: 100%;
	background-color: var(--color-text-inverted);

	animation: blink .7s ease-in-out;
	animation-iteration-count: infinite;

	content: '';
}

@keyframes blink {
	0% {
		opacity: .2;
	}

	70% {
		opacity: 1;
	}
}

</style>



<!-- ================================================================== -->
{#if $state.online === false}
	<div class="connectionIndicator" class:offline={$state.online === false}>
		Disconnected from the instance
	</div>
{/if}

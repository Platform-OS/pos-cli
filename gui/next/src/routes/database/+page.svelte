<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { connectionState } from '#lib/state/connection.svelte.js';

</script>



<!-- ================================================================== -->
<svelte:head>
  <title>Database{connectionState.online?.MPKIT_URL ? ': ' + connectionState.online.MPKIT_URL.replace('https://', '') : ''}</title>
</svelte:head>

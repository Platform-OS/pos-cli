<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { connectionState } from '#lib/state/connection.svelte.js';

</script>



<!-- ================================================================== -->
<svelte:head>
  <title>Users{connectionState.online?.MPKIT_URL ? ': ' + connectionState.online.MPKIT_URL.replace('https://', '') : ''}</title>
</svelte:head>

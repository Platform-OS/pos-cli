<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { onMount } from 'svelte';

import Tables from '$lib/database/Tables.svelte';


// properties
// ------------------------------------------------------------------------
let tablesHidden = false;



onMount(() => {

  // global hotkeys
  // ------------------------------------------------------------------------
  document.addEventListener('keydown', (event) => {
    // hide the sidebar on pressing 'b' when no input is active
    if(!event.target.matches('input, textarea') && event.key === 'b'){
      tablesHidden = !tablesHidden;
      localStorage.tablesHidden = tablesHidden;
    }
  });

});


</script>


<!-- ================================================================== -->
<style>

.container {
  display: grid;
  grid-template-columns: clamp(100px, 21.87rem, 40%) auto;

  transition: grid-template-columns .2s ease-in-out;
}

  .container.tablesHidden {
    grid-template-columns: 0 auto;
  }


.tables-container {
  overflow: hidden;
}

</style>



<!-- ================================================================== -->
<div class="container" class:tablesHidden={tablesHidden}>

  <div class="tables-container">
    <Tables on:sidebarNeeded={() => tablesHidden = false} />
  </div>

  <slot></slot>

</div>

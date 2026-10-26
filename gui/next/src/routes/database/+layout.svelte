<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import Tables from '#lib/database/Tables.svelte';


// properties
// ------------------------------------------------------------------------
let tablesHidden = false;


// purpose:   global hotkeys
//            (on <svelte:document>, so the listener goes away with the layout instead of
//            piling up one more on every visit)
// arguments: keyboard event (object)
// ------------------------------------------------------------------------
const keyboardShortcuts = (event) => {
  // hide the sidebar on pressing 'b' when no input is active
  if(!event.target.matches('input, textarea') && event.key === 'b'){
    tablesHidden = !tablesHidden;
    localStorage.tablesHidden = tablesHidden;
  }
};


</script>


<!-- ================================================================== -->
<style>

.container {
  display: grid;
  grid-template-columns: 350px auto;

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
<svelte:document on:keydown={keyboardShortcuts} />

<div class="container" class:tablesHidden={tablesHidden}>

  <div class="tables-container">
    <Tables onSidebarNeeded={() => tablesHidden = false} />
  </div>

  <slot></slot>

</div>

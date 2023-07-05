<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { quintOut } from 'svelte/easing';

import Icon from '$lib/ui/Icon.svelte';

// properties
// ------------------------------------------------------------------------
// close button url (string)
export let closeUrl = '/';
// the panel title (string)
export let title = '';


// transition: 	slides from right
// options: 	delay (int), duration (int)
// ------------------------------------------------------------------------
const appear = function(node, {
  delay = 0,
  duration = 250
}){
  return {
    delay,
    duration,
    css: (t) => {
      const eased = quintOut(t);

      return `width: ${50 * eased}%;` }
  }
};

</script>


<!-- ================================================================== -->
<style>

aside {
  width: 50%;
  min-width: 200px;
  overflow: hidden;

  border-inline-start: 1px solid var(--color-frame);
}

.container {
  width: 100%;
  height: calc(100vh - 83px);
  padding: 1rem;
  overflow: auto;
}


header {
  display: flex;
  justify-content: space-between;
  gap: 2rem;
}

h2 {
  margin-block-end: .2em;

  font-weight: 500;
  font-size: 1.2rem;
}


.label {
  position: absolute;
  left: -100vw;
}

</style>


<!-- ================================================================== -->
<aside transition:appear>
  <div class="container">

    <header>
      {#if title}
        <h2>{title}</h2>
      {/if}

      {#if closeUrl}
        <a href="{closeUrl}">
          <span class="label">Close details</span>
          <Icon icon="x" />
        </a>
      {/if}
    </header>

    <slot></slot>

  </div>
</aside>

<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { quintOut } from 'svelte/easing';
import { state } from '$lib/state.js';

import Icon from '$lib/ui/Icon.svelte';

// properties
// ------------------------------------------------------------------------
// close button url (string)
export let closeUrl;
// the panel title (string)
export let title = '';
// width of the whole document in pixels (int)
let windowWidth;
// if the user is currently resizing the panel (bool)
let resizing = false;


// transition: 	slides from right
// options: 	delay (int), duration (int)
// ------------------------------------------------------------------------
const appear = function(node, {
  delay = 0,
  duration = 300
}){
  return {
    delay,
    duration,
    css: (t) => {
      const eased = quintOut(t);

      return `min-width: 0; width: calc(${$state.asideWidth || '30vw'} * ${eased});` }
  }
};


// purpose:   add the event for mouse move when resizer is activated
// returns:   toggles the 'resizing' prop to true
// ------------------------------------------------------------------------
const resizingStart = () => {
  window.addEventListener('mousemove', resize, false);
  window.addEventListener('mouseup', resizingEnd, false);
  resizing = true;
};

// purpose:   removes events for mouse move when resizer is deactivated
// returns:   toggles the 'resizing' prop to false
// ------------------------------------------------------------------------
const resizingEnd = () => {
  window.removeEventListener('mousemove', resize, false);
  window.removeEventListener('mouseup', resizingEnd, false);
  resizing = false;
  localStorage.asideWidth = $state.asideWidth;
};

// purpose:   updates the width of the panel to match the mouse position
// returns:   changes the $state.asideWidth
// ------------------------------------------------------------------------
const resize = event => {
  $state.asideWidth = windowWidth - event.clientX - 6 + 'px';
};

// purpose:   resets the size to default when double clicked
// effect:    clears localStorage and $state.asideWidth
// ------------------------------------------------------------------------
const resizingReset = event => {
  if(event.detail === 2){
    $state.asideWidth = false;
    localStorage.removeItem('asideWidth');
  }
}

</script>


<!-- ================================================================== -->
<style>

/* layout */
aside {
  width: var(--width, 30vw);
  min-width: 300px;
  max-width: 90vw;
  position: relative;
  overflow: hidden;
  display: flex;

  border-inline-start: 1px solid var(--color-frame);
}

  @media (max-width: 750px){
    aside {
      width: 90vw;
      min-width: 0;
      max-width: 90vw;
      position: absolute;
      inset-inline-end: 0;
      inset-block: 0;

      background-color: var(--color-page);
    }
  }

.container {
  width: var(--width, 30vw);
  min-width: 300px;
  max-width: 90vw;
  padding: 1rem;
  flex-shrink: 0;
  overflow: auto;
}

  @media (max-width: 750px){
    .container {
      width: 90vw;
      min-width: 0;
      max-width: 90vw;
    }
  }


/* navigation */
aside :global(nav:first-child) {
  margin-block-start: -1rem;
  margin-block-end: 2rem;
  margin-inline: -1rem;
}


/* content */
header {
  display: flex;
  justify-content: space-between;
  gap: 2rem;
}

h2 {
  margin-block-end: .2em;
  overflow: hidden;

  text-overflow: ellipsis;
  font-weight: 500;
  font-size: 1.2rem;
}

.close:hover {
  color: var(--color-interaction-hover);
}

  .label {
    position: absolute;
    left: -100vw;
  }

/* resize dragger */
.resizer {
  width: 8px;
  position: absolute;
  inset: 0 auto 0 0;

  cursor: ew-resize;
  opacity: 0;
  background-color: var(--color-frame);

  transition: opacity .2s linear;
}

.resizer:hover,
.resizer.active {
  background-color: var(--color-frame);

  opacity: 1;
}

  @media (max-width: 750px){
    .resizer {
      display: none;
    }
  }

</style>


<!-- ================================================================== -->
<svelte:window bind:outerWidth={windowWidth} />

<aside transition:appear style={$state.asideWidth ? `--width: ${$state.asideWidth}` : ''}>

  <button class="resizer" class:active={resizing} on:mousedown={resizingStart} on:click={resizingReset}>
    <span class="label">Drag to resize panel</span>
    <Icon icon="resizeHorizontal" size="7" />
  </button>

  <div class="container">

    {#if title || closeUrl}
      <header>
        {#if title}
          <h2>{title}</h2>
        {/if}

        {#if closeUrl}
          <a href="{closeUrl}" class="close">
            <span class="label">Close details</span>
            <Icon icon="x" />
          </a>
        {/if}
      </header>
    {/if}

    <slot></slot>

  </div>

</aside>

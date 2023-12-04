<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { page } from '$app/stores';
import { goto } from '$app/navigation';
import { browser } from '$app/environment';
import { quartInOut } from 'svelte/easing';

import Icon from '$lib/ui/Icon.svelte';
import Number from '$lib/ui/forms/Number.svelte';


let fontSize = browser ? parseInt(getComputedStyle(document.body).getPropertyValue('font-size')) : 16;


// purpose:   handles closing the popup with esc key
// ------------------------------------------------------------------------
function handleKeyboardShortcuts(event){
  if(event.key === 'Escape'){
    let params = new URLSearchParams($page.url.searchParams.toString());
    params.set('settings', false);

    goto(`?${params.toString()}`);
  }
}


// purpose:   custom transition when the popup appears
// ------------------------------------------------------------------------
function appear(node, { duration }) {
  return {
    duration: duration || 200,
    css: (t) => {
      const eased = quartInOut(t);

      return `
        opacity: ${eased};
        scale: ${eased};
        translate: calc(${1 - eased} * 2.5rem) calc(${1 - eased} * 1rem);
        transform-origin: bottom left;
      `;
    }
  };
};


// purpose:   set the base font size in local storage
// ------------------------------------------------------------------------
function changeFontSize(event){
  localStorage.fontSize = event.target.value;
  document.documentElement.style.cssText = `--font-base-size: ${event.target.value}px`;
}

</script>


<!-- ================================================================== -->
<style>

.container {
  min-width: 18.75rem;
  max-width: 50%;
  padding: var(--space-page);
  position: absolute;
  inset-inline-start: calc(var(--space-page) / -2);
  inset-block-end: calc(100% + 1rem);

  border-radius: 1rem;
  background-color: var(--color-background);
}

  .container:after {
    width: 1rem;
    height: .7rem;
    position: absolute;
    inset-block-start: 100%;
    inset-inline-start: calc(var(--space-page) + 1px);

    background-color: var(--color-background);
    clip-path: polygon(50% 100%, 0 0, 100% 0);

    content: '';
  }

ul {
  display: flex;
  flex-direction: column;
  gap: 1em;
}

li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

</style>



<!-- ================================================================== -->
<svelte:document on:keydown={handleKeyboardShortcuts} />

<dialog class="container" transition:appear open autofocus>
  <ul>

    <li>
      Layout density:
      <div class="combo">
        <button class="button active combo">
          <Icon icon="layoutHeadline" />
          <span class="label">Relaxed</span>
        </button>
        <button class="button combo">
          <Icon icon="navigationMenu" />
          <span class="label">Condensed</span>
        </button>
      </div>
    </li>

    <li>
      Base font size:
      <Number
        name="fontSize"
        bind:value={fontSize}
        on:input={changeFontSize}
        min={10}
        max={36}
        step={1}
        decreaseLabel="Smaller font"
        increaseLabel="Larger font"
      />
    </li>
  </ul>
</dialog>

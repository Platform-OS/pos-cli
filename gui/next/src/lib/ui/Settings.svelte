<!-- ================================================================== -->
<script>

import Icon from '$lib/ui/Icon.svelte';
import Number from '$lib/ui/forms/Number.svelte';

import { quartInOut } from 'svelte/easing';


function appear(node, { duration }) {
  return {
    duration: 300,
    css: (t) => {
      const eased = quartInOut(t);

      return `
        opacity: ${eased};
        scale: ${eased};
        translate: calc(${1 - eased} * -7rem) calc(${1 - eased} * 7rem);
      `;
    }
  };
}

</script>


<!-- ================================================================== -->
<style>

.container {
  min-width: 300px;
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
<section class="container" transition:appear>
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
        value={16}
        min={1}
        max={40}
        step={1}
        decreaseLabel="Smaller font"
        increaseLabel="Larger font"
      />
    </li>
  </ul>
</section>

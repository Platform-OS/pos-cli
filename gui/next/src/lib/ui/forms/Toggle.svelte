<!-- ================================================================== -->
<script>

import { fade } from 'svelte/transition';

import Icon from '$lib/ui/Icon.svelte';

export let name;
export let options = [];
export let checked = options.length > 1 ? options[0].value : '';

let choosen = (' ' + checked).slice(1);

</script>



<!-- ================================================================== -->
<style>

.toggle {
  display: flex;
  align-items: center;
  gap: .5em;
}

.toggle label {
  cursor: pointer;

  transition: opacity .1s linear;
}

/* two choices version */
.toggle input[type="radio"],
.toggle input[type="checkbox"] {
  position: absolute;
  left: -100vw;
}

.toggle .switcher {
  width: 2rem;
  height: .8rem;
  display: inline-block;
  position: relative;
  top: 2px;

  border: 1px solid var(--color-frame);
  border-radius: 1rem;
}

.toggle .switcher:before {
  width: 1rem;
  position: absolute;
  left: 1px;
  top: 1px;
  bottom: 1px;

  border-radius: 1rem;
  background-color: var(--color-frame);

  content: '';

  transition: translate .2s cubic-bezier(0.075, 0.82, 0.165, 1);
}

  .toggle input[type="radio"]:checked .switcher:before {
    left: 1px;
  }

  .toggle input[type="radio"]:not(:checked) + label {
    opacity: .5;
  }

  .toggle:has(.switcher + input[type="radio"]:checked) .switcher:before {
    translate: .85em 0;
  }

  /* focus state */
  .toggle:has(input[type="radio"]:focus-visible) .switcher {
    border-color: var(--color-interaction-hover);
  }

  .toggle:has(input[type="radio"]:focus-visible) .switcher:before {
    background-color: var(--color-interaction-hover);
  }

/* checkbox version */
.toggle.single label {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
}

.toggle.single label:before {
  width: 2rem;
  height: 1.2rem;
  order: 2;
  flex-shrink: 0;
  position: relative;
  inset-block-start: 1px;

  border: 1px solid var(--color-frame);
  border-radius: 1rem;

  content: '';
}

.toggle.single label:after {
  width: 1rem;
  height: calc(1.2rem - 4px);
  margin-block-start: 2px;
  position: absolute;
  inset-inline-end: calc(1rem - 2px);
  flex-shrink: 0;

  border-radius: 1rem;
  background-color: var(--color-frame);

  content: '';

  transition: translate .2s cubic-bezier(0.075, 0.82, 0.165, 1);
}

.toggle.single:has(input:checked) label:after {
  translate: .75rem 0;
}

.toggle.single i {
  width: 7px;
  height: 7px;
  margin-block-start: 2px;
  position: absolute;
  inset-inline-end: 6px;
  z-index: 1;

  color: var(--color-text);
}

.toggle.single :global(svg) {
  width: 100%;
  height: auto;
  display: block;
}

</style>



<!-- ================================================================== -->
<div class="toggle" class:single={options.length === 1}>

  {#if options.length === 2}

    <input
      type="radio"
      name={name}
      value={options[0].value}
      bind:group={choosen}
      id="toggle-{name}-{options[0].value}"
      on:keydown={event => { if(event.code === 'Space'){ event.preventDefault(); choosen = choosen === options[0].value ? options[1].value : options[0].value } } }
    >
    <label for="toggle-{name}-{options[0].value}">{options[0].label}</label>

    <label for="toggle-{name}-{choosen === options[0].value ? options[1].value : options[0].value}" class="switcher"></label>

    <input
      type="radio"
      name={name}
      value={options[1].value}
      bind:group={choosen}
      id="toggle-{name}-{options[1].value}"
      on:keydown={event => { if(event.code === 'Space'){ event.preventDefault(); choosen = choosen === options[0].value ? options[1].value : options[0].value } } }
    >
    <label for="toggle-{name}-{options[1].value}">{options[1].label}</label>

  {:else if options.length === 1}

    <label for="toggle-{name}-{options[0].value}">
      {options[0].label}
      {#if choosen === true}
        <i in:fade={{delay: 100, duration: 50}}>
          <Icon icon="check" />
        </i>
      {/if}
    </label>

    <input
      type="checkbox"
      name={name}
      value={options[0].value}
      bind:checked={choosen}
      id="toggle-{name}-{options[0].value}"
      on:keydown={event => { if(event.code === 'Space'){ event.preventDefault(); choosen = choosen === options[0].value ? '' : options[0].value } } }
      on:change
    >

  {/if}

</div>

<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { createEventDispatcher, tick } from 'svelte';

import Icon from '$lib/ui/Icon.svelte';


// properties
// ------------------------------------------------------------------------
// form name that the input belongs to (string)
export let form = false;
// main number input (dom node)
let input;
// name of the input (string)
export let name;
// minimal value (int)
export let min = 1;
// maximal value (int)
export let max;
// step amount (int)
export let step = 1;
// current input value (int)
export let value = '';
// if you want an alternative looks (undefined or 'navigation')
export let style = undefined;
// label for the decreasing button (string)
export let decreaseLabel = `Decrease ${name} value`;
// label for the increase button (string)
export let increaseLabel = `Increase ${name} value`;


// forward a change event when pressing the buttons
const dispatch = createEventDispatcher();

</script>



<!-- ================================================================== -->
<style>

  .number {
    display: inline-flex;
    align-items: center;
  }

  input {
    width: calc(var(--max) + 1em);
    padding-inline: .5em;
    padding-block: .45rem .55rem;

    appearance: none;
    -moz-appearance: textfield;

    border-radius: 0;

    text-align: center;
  }

    input::-webkit-outer-spin-button,
    input::-webkit-inner-spin-button {
      -webkit-appearance: none;
    }

    input:focus-visible {
      position: relative;
      z-index: 1;
    }

  button {
    padding-block: .8rem;
  }

    button:first-child {
      padding-inline: .7rem .5rem;

      border-start-end-radius: 0;
      border-end-end-radius: 0;
    }

    button:last-child {
      padding-inline: .5rem .7rem;

      border-start-start-radius: 0;
      border-end-start-radius: 0;
    }

    button:focus-visible {
      position: relative;
      z-index: 1;
    }

    button :global(svg) {
      width: .8rem;
      height: .8rem;
    }

</style>



<!-- ================================================================== -->
<div class="number">

  <button
    class="button"
    on:click|preventDefault={async () => { value = value-1; await tick(); input.dispatchEvent(new Event('input')); }}
    disabled={value <= min}
    aria-hidden={value <= min}
  >
    <span class="label">{decreaseLabel}</span>
    <Icon icon={style === 'navigation' ? 'arrowLeft' : 'minus' } />
  </button>

  <input
    bind:this={input}
    form={form}
    type="number"
    name={name}
    id={name}
    min={min}
    max={max}
    step={step}
    bind:value={value}
    on:input
    style="--max: {max?.toString().length || 1}ch"
  >

  <button
    class="button"
    on:click|preventDefault={async () => { value = value+1; await tick(); input.dispatchEvent(new Event('input')); }}
    disabled={value >= max}
    aria-hidden={value >= max}
  >
    <span class="label">{increaseLabel}</span>
    <Icon icon={style === 'navigation' ? 'arrowRight' : 'plus' } />
  </button>

</div>

<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { tick, createEventDispatcher } from 'svelte';

import Icon from '$lib/ui/Icon.svelte';


// properties
// ------------------------------------------------------------------------
// form name that the input belongs to (string)
export let form;
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
export let style;
// label for the decreasing button (string)
export let decreaseLabel = `Decrease ${name} value`;
// label for the increase button (string)
export let increaseLabel = `Increase ${name} value`;
// if the field is currently focused (boold)
let focused = false;
// main submit button for the number component (will be passed as 'submitter' to form)
let submit;


// forward a change event when pressing the buttons
const dispatch = createEventDispatcher();


// purpose:		slows down triggering an input event to wait for the user to finish setting the number
// effect:    triggers 'input' event on the component
// ------------------------------------------------------------------------
let inputTimeout;
function debouncedInput(event) {
  clearTimeout(inputTimeout);

  inputTimeout = setTimeout(() => {
    event.submitter = submit;

    dispatch('input', event);
  }, 150);
}

</script>



<!-- ================================================================== -->
<style>

  .number {
    display: inline-flex;
    align-items: center;
  }

  input[type="number"] {
    width: calc(var(--max));
    padding-inline: .5em;
    padding-block: .45rem .55rem;
    box-sizing: content-box;

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
    min-height: 2.313rem;
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
    form={form}
    class="button"
    on:click|preventDefault={async event => { value = parseInt(value)-1; await tick(); debouncedInput(event); }}
    disabled={value <= min}
    aria-hidden={value <= min}
    data-action="numberDecrease"
  >
    <span class="label">{decreaseLabel}</span>
    <Icon icon={style === 'navigation' ? 'arrowLeft' : 'minus' } />
  </button>

  <input
    form={form}
    type="number"
    name={name}
    id={name}
    min={min}
    max={max}
    step={step}
    bind:value={value}
    on:input|preventDefault={event => debouncedInput(event)}
    on:focusin={() => focused = true}
    on:focusout={() => focused = false}
    autofocus={focused}
    style="--max: {max?.toString().length || 1}ch"
  >

  <button
    form={form}
    bind:this={submit}
    class="button"
    on:click|preventDefault={async event => { value = parseInt(value)+1; await tick(); debouncedInput(event); }}
    disabled={value >= max}
    aria-hidden={value >= max}
    data-action="numberIncrease"
  >
    <span class="label">{increaseLabel}</span>
    <Icon icon={style === 'navigation' ? 'arrowRight' : 'minus' } />
  </button>

</div>

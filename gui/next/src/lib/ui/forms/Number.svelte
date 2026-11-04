<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { tick } from 'svelte';

import Icon from '#lib/ui/Icon.svelte';


// properties
// ------------------------------------------------------------------------
let {
  // form name that the input belongs to (string)
  form,
  // name of the input (string)
  name,
  // minimal value (int)
  min = 1,
  // maximal value (int)
  max,
  // step amount (int)
  step = 1,
  // current input value (int)
  value = $bindable(''),
  // if you want an alternative looks (undefined or 'navigation')
  style,
  // label for the decreasing button (string)
  decreaseLabel = `Decrease ${name} value`,
  // label for the increase button (string)
  increaseLabel = `Increase ${name} value`,
  // called once the user stops changing the number, with the button to submit the form with (function)
  oninput
} = $props();
// if the field is currently focused (boold)
let focused = $state(false);
// main submit button for the number component (will be passed as 'submitter' to form)
let submit = $state();


// purpose:		slows down calling oninput to wait for the user to finish setting the number
// effect:    calls oninput with { submitter }
// ------------------------------------------------------------------------
let inputTimeout;
function debouncedInput() {
  clearTimeout(inputTimeout);

  inputTimeout = setTimeout(() => {
    oninput?.({ submitter: submit });
  }, 150);
}

// do not submit a form that is no longer on the page
$effect(() => () => clearTimeout(inputTimeout));


// purpose:		changes the value by one step in either direction
// arguments: the click event (object), direction: 1 or -1 (int)
// effect:    updates the value and calls oninput, debounced
// ------------------------------------------------------------------------
const change = async (event, direction) => {
  event.preventDefault();
  value = parseInt(value) + direction;
  await tick();
  debouncedInput();
};

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
    onclick={event => change(event, -1)}
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
    oninput={event => { event.preventDefault(); debouncedInput(); }}
    onfocusin={() => focused = true}
    onfocusout={() => focused = false}
    autofocus={focused}
    style="--max: {max?.toString().length || 1}ch"
  >

  <button
    form={form}
    bind:this={submit}
    class="button"
    onclick={event => change(event, 1)}
    disabled={value >= max}
    aria-hidden={value >= max}
    data-action="numberIncrease"
  >
    <span class="label">{increaseLabel}</span>
    <Icon icon={style === 'navigation' ? 'arrowRight' : 'plus' } />
  </button>

</div>

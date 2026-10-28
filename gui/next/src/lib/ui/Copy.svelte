<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import Icon from '#lib/ui/Icon.svelte';


// properties
// ------------------------------------------------------------------------
let {
  // what will be copied to clipboard (any type, converted to string)
  text
} = $props();
// if the text was already copied a second ago (bool)
let copied = $state(false);
// if the copying is in progess, used for animation (bool)
let copying = $state(false);
// if an error occured when trying to copy (bool)
let error = $state(false);


// purpose:   waits before the next step of the animation
// arguments: miliseconds to wait (int)
// returns:   promise resolved after that time
// ------------------------------------------------------------------------
const wait = (time) => new Promise(resolve => setTimeout(resolve, time));


// purpose:   copy text to clipboard
// returns:   sets the state in variables
// ------------------------------------------------------------------------
const copy = async () => {
  copying = true;

  try {
    await navigator.clipboard.writeText(String(text));
  } catch(e) {
    copying = false;
    error = true;
    console.error(e);
    return;
  }

  // success animation
  await wait(150);
  copied = true;
  await wait(150);
  copying = false;

  // get back to default
  await wait(2000);
  copying = true;
  await wait(150);
  copied = false;
  await wait(150);
  copying = false;
};

</script>


<!-- ================================================================== -->
<style>

button[aria-disabled="true"] {
  pointer-events: none;
}

button :global(svg) {
  width: 14px;
  height: 14px;
}

  button.progressing :global(svg) {
    animation-name: copied;
    animation-duration: .3s;
    animation-timing-function: ease-in-out;
    animation-iteration-count: 1;
  }

@keyframes copied {
  0% {
    scale: 1;
  }

  50% {
    scale: 0;
  }

  100% {
    scale: 1;
  }
}

</style>



<!-- ================================================================== -->
<button
  title="Copy message to clipboard"
  class="button compact"
  class:progressing={copying}
  aria-disabled={copying || copied || error}
  onclick={copy}
>

  <Icon icon={copied ? 'check' : error ? 'x' : 'copy'} size="16" />
  <span class="label">Copy</span>

</button>

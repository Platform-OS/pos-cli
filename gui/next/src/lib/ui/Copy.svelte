<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import Icon from '$lib/ui/Icon.svelte';


// properties
// ------------------------------------------------------------------------
// what will be copied to clipboard (any type, converted to string)
export let text;
// if the text was already copied a second ago (bool)
let copied = false;
// if the copying is in progess, used for animation (bool)
let copying = false;
// if an error occured when trying to copy (bool)
let error = false;


// purpose:   copy text to clipboard
// returns:   triggers the button animation
// ------------------------------------------------------------------------
const copy = () => {
  copying = true;

  navigator.clipboard.writeText(text.toString())
    .then(() => {
      // success animation
      setTimeout(() => { copied = true; }, 150);
      setTimeout(() => { copying = false; }, 300);

      // get back to default
      setTimeout(() => { copying = true; }, 2300);
      setTimeout(() => { copied = false; }, 2450);

      // reset state
      setTimeout(() => { copying = false; }, 2600);
    })
    .catch(e => {
      copying = false;
      error = true;
      console.error(e);
    });
}

</script>


<!-- ================================================================== -->
<style>

button[aria-disabled="true"] {
  pointer-events: none;
}

button :global(svg) {
  width: 16px;
  height: 16px;

  position: relative;
  top: .05em;
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
  on:click={copy}
>

  <Icon icon={copied ? 'check' : error ? 'x' : 'copy'} size="16" />
  <span class="label">Copy</span>

</button>

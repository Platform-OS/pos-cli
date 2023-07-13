<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { afterUpdate, tick } from 'svelte';
import '../../style/code.css';

// properties
// ------------------------------------------------------------------------
// code language name for the highligher (string)
export let language;
// the template that will be cloned and used to show the highlighted code (dom node)
let template;


// a little hacky way to use Prism highlighting with dynamic code
// ------------------------------------------------------------------------
afterUpdate(async() => {
  await tick();
  document.querySelector('#code')?.remove();
  const clone = template.content.cloneNode(true);
  clone.firstChild.id = 'code';
  template.after(clone);
  Prism.highlightAll();
});

</script>


<!-- ================================================================== -->
<style>

:global(#code) {
  border-radius: 1rem;
  border-start-start-radius: 0;
}

:global(#code[class*=language-]) {
  background-color: var(--color-context);
}

</style>



<!-- ================================================================== -->
<template bind:this={template}>
  <pre class="line-numbers language-{language}"><code class="language-{language}"><slot></slot></code></pre>
</template>

<!-- ================================================================== -->
<script module>

// purpose:   loads the Prism highlighter from /prism.js, once for the whole app
// returns:   Prism (promise of object)
// ------------------------------------------------------------------------
let prism;
const loadPrism = () => prism ??= new Promise((resolve, reject) => {
  if(window.Prism?.highlightElement){
    resolve(window.Prism);
    return;
  }

  // only highlight what is asked for, not every code block once the script has loaded
  window.Prism = window.Prism || {};
  window.Prism.manual = true;

  const script = document.createElement('script');
  script.src = '/prism.js';
  script.onload = () => resolve(window.Prism);
  script.onerror = () => { prism = undefined; reject(new Error('Could not load /prism.js')); };
  document.head.append(script);
});

</script>


<script>

// imports
// ------------------------------------------------------------------------
import '../../style/code.css';

// properties
// ------------------------------------------------------------------------
let {
  // code language name for the highlighter (string)
  language,
  // the code to show (string)
  code = ''
} = $props();


// purpose:   shows the code in the element and highlights it, again whenever the code changes
// arguments: the code (string)
// returns:   an attachment for the <code> element (function)
// ------------------------------------------------------------------------
// the element's content is written here rather than by the template, because Prism
// replaces it with its own markup, which the template would not know about
const highlight = (code) => (node) => {
  node.textContent = code;

  loadPrism()
    .then(Prism => { if(node.isConnected && node.textContent === code){ Prism.highlightElement(node); } })
    // the code stays on screen as plain text
    .catch(() => {});
};

</script>


<!-- ================================================================== -->
<style>

pre {
  border-radius: 1rem;
  border-start-start-radius: 0;
}

pre[class*=language-] {
  background-color: var(--color-context);
}

</style>



<!-- ================================================================== -->
<pre class="line-numbers language-{language}"><code class="language-{language}" {@attach highlight(code)}></code></pre>

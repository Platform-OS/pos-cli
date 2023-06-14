<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import JSONTree from 'svelte-json-tree';


// properties
// ------------------------------------------------------------------------
// JSON to show as a tree (object)
export let value;
// if you want to output the full value instead of trimming long lines (bool)
export let showFullLines = false;

</script>


<style>

div :global(.root) {
  display: none;
}

div :global(.arrow) {
  top: 2px;
  cursor: pointer;
}

div :global(.indent) {
  max-width: 600px;
  overflow: hidden;

  white-space: nowrap;
  text-overflow: ellipsis;
}

div.showFullLines :global(.indent) {
  max-width: auto;
  overflow: visible;

  white-space: normal;
  word-wrap: break-word;
  text-overflow: unset;
}

div :global(div > ul) {
  margin-left: 0;
}

div :global(div > ul > ul > .indent) {
  padding-left: 0;
}

</style>



<!-- ================================================================== -->
<div class:showFullLines>

  <JSONTree
    value={value}
    defaultExpandedLevel={2}
    --json-tree-font-size="16px"
    --json-tree-li-line-height="1.7"
    --json-tree-font-family="monospace"
    --json-tree-string-color="var(--color-text)"
    --json-tree-label-color="var(--color-interaction)"
    --json-tree-property-color="var(--color-interaction)"
    --json-tree-number-color="var(--color-text-secondary)"
    --json-tree-boolean-color="var(--color-text-secondary)"
  />

</div>

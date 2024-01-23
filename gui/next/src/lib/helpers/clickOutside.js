/*
  svelte action that handles clicking outside given node
*/


const clickOutside = (node, callback) => {
  const handleClick = event => {

    const path = event.composedPath();

    if (!path.includes(node)) {

      callback();
    }
  }

  document.addEventListener('mousedown', handleClick);

  return {
    destroy() {
      document.removeEventListener('mousedown', handleClick);
    }
  }
};



// exports
// ------------------------------------------------------------------------
export { clickOutside };

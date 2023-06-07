<!-- ================================================================== -->
<script>

export let name;
export let options = [];
export let checked = options[0].value;

let choosen = (' ' + checked).slice(1);

</script>



<!-- ================================================================== -->
<style>

.toggle {
  display: flex;
  align-items: center;
  gap: .5em;
}

.toggle input[type="radio"] {
  position: absolute;
  left: -100vw;
}

.toggle label {
  cursor: pointer;

  transition: opacity .1s linear;
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

</style>



<!-- ================================================================== -->
<div class="toggle">

  {#if options.length === 2}

    <input type="radio" name={name} value={options[0].value} bind:group={choosen} id="toggle-{name}-{options[0].value}">
    <label for="toggle-{name}-{options[0].value}">{options[0].label}</label>

    <label for="toggle-{name}-{choosen === options[0].value ? options[1].value : options[0].value}" class="switcher"></label>

    <input type="radio" name={name} value={options[1].value} bind:group={choosen} id="toggle-{name}-{options[1].value}">
    <label for="toggle-{name}-{options[1].value}">{options[1].label}</label>

  {/if}

</div>

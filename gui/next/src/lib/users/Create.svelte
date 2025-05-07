<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { onMount, createEventDispatcher } from 'svelte';
import { quintOut } from 'svelte/easing';
import { state } from '$lib/state.js';
import { user } from '$lib/api/user.js';
import Icon from '$lib/ui/Icon.svelte';


// properties
// ------------------------------------------------------------------------
// main container for the component (dom node)
let container;
// edit form (dom node)
let form;
// list of errors for the current form taken from back-end (array of objects)
let errors = [];

const dispatch = createEventDispatcher();


// transition: 	fades and resizes from 0
// options: 	delay (int), duration (int)
// ------------------------------------------------------------------------
const appear = function(node, {
  delay = 0,
  duration = 150
}){
  return {
    delay,
    duration,
    css: (t) => {
      const eased = quintOut(t);

      return `opacity: ${eased}; transform: scale(${eased});` }
  }
};


// purpose: 	use JS to open the modal on mount to get all of the <modal> benefits
// ------------------------------------------------------------------------
onMount(() => {
  setTimeout(() => {
    container.showModal();
  }, 10);
});


// purpose: 	handles keyboard shortcuts
// ------------------------------------------------------------------------
document.addEventListener('keydown', event => {
  if(event.key === 'Escape'){
    event.preventDefault();

    $state.user = undefined;
  }
}, { once: true });



const save = async (event) => {
  event.preventDefault();

  // form data as object with properties
  const properties = new FormData(form);
  // create new record
  if($state.user === null){
    const create = await user.create(
      properties.get("email"),
      properties.get("password"),
      properties.get("firstName"),
      properties.get("lastName")
    );
    if(!create.errors){
      $state.user = undefined;
      state.notification.create('success', `User ${create} created`);
      dispatch('success');
    }
    else {
      errors = create.errors;
    }
  }
};

</script>


<!-- ================================================================== -->
<style>

dialog {
  height: 100vh;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  inset: 0;
  z-index: 100;
}

  dialog::backdrop {
    background-color: rgba(var(--color-rgb-background), .6);
  }


.content {
  width: clamp(300px, 800px, 80vw);
  max-height: 94vh;
  overflow: auto;

  border-radius: 1rem;
}


form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 2rem;
}

fieldset {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 1rem;
}

fieldset + fieldset {
  margin-block-start: 2rem;
}

label {
  word-break: break-all;
}

input {
  width: 100%;
  max-height: 40rem;
}

[role="alert"]:not(:empty) {
  margin-block-start: .5em;
  padding: .5em 1em .6em;
  position: relative;

  border-radius: 1rem;
  background-color: var(--color-danger);
}

  [role="alert"]:not(:empty):before {
    width: 1em;
    height: .5em;
    position: absolute;
    top: -6px;
    right: 1rem;

    clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
    background-color: var(--color-danger);

    content: '';
  }


.footer {
  padding: 1.5rem 0;
  position: sticky;
  bottom: 0;
  gap: 1rem;

  background-color: var(--color-context);
}

.error li {
  margin-block-end: 1rem;
  padding: 1rem;

  border-radius: 1rem;
  background-color: var(--color-danger);

  color: var(--color-text-inverted);
}
.actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

</style>



<!-- ================================================================== -->
<dialog bind:this={container} transition:appear>

  <div class="content content-context">

    <form bind:this={form} on:submit|preventDefault={save}>
      <fieldset>
        <dir>
          <label for="firstName">
            First name
          </label>
        </dir>
        <div>
          <input
            type="text"
            name="firstName"
            id="first_name"
          />
        </div>
      </fieldset>
      <fieldset>
        <dir>
          <label for="lastName">
            Last name
          </label>
        </dir>
        <div>
          <input
            type="text"
            name="lastName"
            id="last_name"
          />
        </div>
      </fieldset>
      <fieldset>
        <dir>
          <label for="email">
            Email
          </label>
        </dir>
        <div>
          <input
            type="email"
            name="email"
            id="email"
          />
        </div>
      </fieldset>
      <fieldset>
        <dir>
          <label for="password">
            Password
          </label>
        </dir>
        <div>
          <input
            type="password"
            name="password"
            id="password"
          />
        </div>
      </fieldset>

      <div class="footer">
        <ul class="error" aria-live="assertive">
          {#each errors as error}
            <li>
              {JSON.stringify(error)}
            </li>
          {/each}
        </ul>
        <fieldset class="actions">
          <button type="button" class="button" on:click={() => $state.user = undefined}>Cancel</button>
          <button type="submit" class="button">
            Create user
            <Icon icon="arrowRight" />
          </button>
        </fieldset>
      </div>
    </form>
  </div>

</dialog>

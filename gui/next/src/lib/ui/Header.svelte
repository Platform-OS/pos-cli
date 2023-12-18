<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import { page } from '$app/stores';
import { table } from '$lib/api/table';
import { state } from '$lib/state';

import Icon from '$lib/ui/Icon.svelte';



// purpose:		preload tables data into the state store for faster navigation
// returns:		loads the tables into the $state.tables (array)
// ------------------------------------------------------------------------
const preloadTables = async () => {
  if(!$state.tables.length){
    $state.tables = await table.get();
  }
}

</script>


<!-- ================================================================== -->
<style>

/* layout */
header {
  max-width: 100vw;
  padding-block: var(--space-navigation);
  position: sticky;
  top: 0;
  z-index: 100;

  border-bottom: 1px solid var(--color-frame);
  background-color: var(--color-page);
}

.wrapper {
  min-width: 0;
  width: 100%;
  padding-inline: var(--space-page);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-navigation) var(--space-page);
}

/* logo */
.logo {
  min-width: 0;
  min-height: 2.5625rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.logo .label {
  position: absolute;
  left: -100vw;
}

.logo .sign {
  width: 100%;
  min-width: 2rem;
  max-width: 3.125rem;

  transition: scale .2s var(--easing-rapid);
}

  .logo .sign:hover,
  .logo:has(.logotype:hover) .sign {
    scale: 1.1;
  }

.logo h1 {
  min-width: 2rem;
  display: flex;
  flex-direction: column;
}

.logo .logotype {
  width: 100%;
  max-width: 120px;

  fill: var(--color-text);

  transition: fill .2s var(--easing-rapid);
}

  .logo .logotype:hover,
  .logo:has(.sign:hover) .logotype {
    fill: color-mix(in srgb, var(--color-text), var(--color-text-secondary) 40%);
  }

.logo .instance {
  max-width: 260px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: .8rem;
  color: var(--color-text-secondary);

  transition: font-size .2s ease-in-out;
}

.logo .instance.offline {
  font-size: 0;
  color: transparent;
}

.logo .instance:hover {
  color: var(--color-interaction-hover);
}

/* navigation */
ul {
  display: flex;
  gap: 1rem;
}

li a {
  padding: .8rem;
  display: flex;
  flex-direction: column;
  gap: .5rem;
  justify-items: center;
  align-items: center;
  position: relative;

  border-radius: 1rem;
  background-color: var(--color-background);

  text-transform: uppercase;
  font-size: .9rem;
  color: var(--color-text-secondary);

  transition-property: background-color, border-radius;
  transition-duration: .1s, .2s;
  transition-timing-function: linear, cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

  @media (max-width: 525px) {
    li a {
      padding: .5rem;
    }
  }

  li a:hover {
    border-radius: 1.2rem;
    background-color: var(--color-middleground);
  }

  li a.active {
    background-color: var(--color-middleground);

    color: var(--color-text);
  }

/* tooltip appearing on hover */
nav .label {
  margin-block-start: .4rem;
  padding: .2rem .5rem;
  position: absolute;
  top: 105%;
  right: 0;
  left: auto;
  bottom: auto;
  opacity: 0;

  border-radius: .2rem;
  background-color: var(--color-text);

  white-space: nowrap;
  font-weight: 500;
  color: var(--color-page);

  transition: opacity .1s ease-in-out;
}

nav .label:before {
  width: 10px;
  height: 6px;
  position: absolute;
  top: -6px;
  right: 1.25rem;

  background-color: var(--color-text);
  clip-path: polygon(50% 0%, 100% 100%, 0% 100%);

  content: '';
}

nav a:hover .label {
  opacity: 1;
}

</style>



<!-- ================================================================== -->
<header>
  <div class="wrapper">

    <div class="logo">
      <a href="/">
        <svg class="sign" xmlns="http://www.w3.org/2000/svg" xml:space="preserve" x="0" y="0" style="enable-background:new 0 0 28.4 24.5" version="1.1" viewBox="0 0 28.4 24.5"><style>.st0,.st1{fill-rule:evenodd;clip-rule:evenodd;fill:#56b146}.st1{fill:#c3233d}.st2,.st3,.st4,.st5,.st6,.st7,.st8,.st9{fill-rule:evenodd;clip-rule:evenodd;fill:#d5246a}.st3,.st4,.st5,.st6,.st7,.st8,.st9{fill:#e77a2b}.st4,.st5,.st6,.st7,.st8,.st9{fill:#fac922}.st5,.st6,.st7,.st8,.st9{fill:#487fb5}.st6,.st7,.st8,.st9{fill:#23477b}.st7,.st8,.st9{fill:#419845}.st8,.st9{fill:#014c3d}.st9{fill:#008b47}</style><path d="M4.7 0h2.4L3.3 3.9 4.7 0z" class="st0"/><path d="M2 10.4 0 6.8h2v3.6z" class="st1"/><path d="M2 6.7h4l-4 3.6V6.7z" class="st2"/><path d="M5.8 13.6 6 6.7l-4 3.6 3.8 3.3z" class="st3"/><path d="m10.6 10.2-4.8 3.4.2-6.9 4.6 3.5z" class="st4"/><path d="M13.6 5.7 6 6.7l4.7 3.4 2.9-4.4z" class="st0"/><path d="M11.9 0 8.8 3.8l4.9 1.8L11.9 0z" class="st1"/><path d="M19.1 0h-7.3l1.8 5.7L19.1 0z" class="st5"/><path d="m6 6.7 7.6-1.1-4.8-1.8L6 6.7z" class="st2"/><path d="M20.5 5.7h-6.9L19.1 0l1.4 5.7z" class="st6"/><path d="m17 12-6.4-1.8 3-4.5L17 12z" class="st7"/><path d="M20.5 5.7 17 12l-3.4-6.3h6.9z" class="st8"/><path d="M22.9 10.2 17 12l3.4-6.3 2.5 4.5z" class="st7"/><path d="M21.8 13.9 17 12l5.8-1.8-1 3.7z" class="st0"/><path d="m19.1 0 5.3 4.4-3.9 1.3L19.1 0z" class="st5"/><path d="m20.5 5.7 3.9-1.3-1.5 5.8-2.4-4.5z" class="st9"/><path d="m22.9 10.2 5.4 1-6.5 2.6 1.1-3.6z" class="st8"/><path d="m28.3 11.2.1 5.2-6.5-2.6 6.4-2.6z" class="st7"/><path d="m21.8 13.9 6.5 2.5-4.9.8-1.6-3.3z" class="st6"/><path d="m28.4 16.4-2.5 5.7-2.4-4.8 4.9-.9z" class="st0"/><defs><filter id="Adobe_OpacityMaskFilter" width="10.8" height="7.2" x="15.1" y="17.2" filterUnits="userSpaceOnUse"><feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0"/></filter></defs><mask id="a_00000065067817451968692310000014300811633783240372_" width="10.8" height="7.2" x="15.1" y="17.2" maskUnits="userSpaceOnUse"><path d="M15.1 17.2h10.8v7.2H15.1v-7.2z" style="fill-rule:evenodd;clip-rule:evenodd;fill:#fff;filter:url(#Adobe_OpacityMaskFilter)"/></mask><g style="mask:url(#a_00000065067817451968692310000014300811633783240372_)"><path d="m23.4 17.2 2.4 4.8-3.6-2 1.2-2.8z" class="st5"/><path d="m25.8 22.1-3.6 2.4V20l3.6 2.1z" class="st6"/><path d="M22.2 20v4.5l-1.8-2.9 1.8-1.6z" class="st5"/><path d="M22.2 24.5h-4.8l3-2.9 1.8 2.9z" class="st6"/><path d="m20.4 21.6-3 2.9.5-2.9h2.5z" class="st1"/><path d="m17.9 21.6-.5 2.9-2.3-2.9h2.8z" class="st2"/></g><path d="M17.9 21.6H15l1.7-2 1.2 2z" class="st1"/><path d="M15.1 21.6v-3.8l1.7 1.8-1.7 2z" class="st3"/><path d="m24.4 4.4 3.9 6.8-5.4-1 1.5-5.8z" class="st0"/><path d="m17.9 17.9-.4-1.9 2.9 1.3-2.5.6z" class="st7"/><path d="m15.1 17.8 2.9.1-.4-1.9-2.5 1.8z" class="st0"/><path d="m16.7 19.6 1.2-1.7-2.9-.1 1.7 1.8z" class="st4"/><path d="m6.7 2.5 2.1 1.3-.1-2.6-2 1.3z" class="st7"/><path d="m6.7 2.5 2-1.3L7.1 0l-.4 2.5z" class="st0"/><path d="M3.3 3.9 7.1 0l-.4 2.5-3.4 1.4z" class="st9"/><path d="M8.8 3.8 6.7 2.5l-1 1.4 3.1-.1z" class="st8"/><path d="m3.3 3.9 3.3-1.4-1 1.4H3.3z" class="st7"/><path d="m2 6.7 3.7-2.8.3 2.8H2z" class="st3"/><path d="M5.7 3.9 6 6.7l2.8-2.9-3.1.1z" class="st1"/><path d="m2 6.7 1.4-2.8h2.4L2 6.7z" class="st4"/><path d="m11 13.6-1.2 2h3.3l-2.1-2z" class="st7"/><path d="m8.5 13.6 1.4 2 1.2-2H8.5z" class="st0"/><path d="m10.6 10.2.4 3.4 6-1.6-6.4-1.8z" class="st8"/><path d="M13.2 15.6 17 12l-6 1.6 2.2 2z" class="st9"/></svg>
      </a>
      <h1>
        <a href="/">
          <svg class="logotype" xmlns="http://www.w3.org/2000/svg" xml:space="preserve" style="enable-background:new 0 0 135 22.2" viewBox="0 0 135 22.2" fill="currentColor"><path d="m96.2 4.3-1.4 1.3-1.4-1.3h-3.1l-1.7 2-2-2v13.4h3.9V8.4h1.8l.6 1v8.3h3.9l-.4-.5.4.5V9.4l.6-1h1.2l.5 1v8.3h4V7.3l-3.1-3h-3.8zM9.5 12.2l-1.4 1.4H4V8.4h4.1L9.5 10v2.2zM6.8 4.4H4L2 6.3 0 4.4v17.8h4v-4.6l-.1-.1.1.1h5.7l3.5-3.1V8L9.6 4.4H6.8zm34.7 8.2V9.1h4.2v-4h-4.2l-2-2.2-2-2v13.7l3.9 3h5v-4h-3.3l-1.6-1zm-10.4 1.1h-4.2l-1.5-1.5V9.9l1.5-1.3h4.2v5.1zm0-9h-5.7l-3.5 3V14l3.5 3.6h5.7l2-1.9 2 1.9v-9l-2-1.9-2-2zm46.8-.1-2 2.1-2-2.1v13h4v-9h4.2l2.5 2.6V6.7L82 4.6h-4.1zM48.4 3.1v14.5h4v-4.8h4.2V8.9h-4.2V5.4L54.1 4h3.3V0h-5l-4 3.1zm-31.1-.8-2-2.2v17.6h4V4.5l-2-2.2zm50.8 9.8-1.5 1.6h-2.7l-1.5-1.6V9.9l1.5-1.3h2.7l1.5 1.3v2.2zm-5.8-7.5-3.6 3V14l3.6 3.6h6l3.6-3.6V7.6l-3.6-3h-6zm52.9 4.1V12l-1.4 2h-3l-1.4-2V5.5l1.4-2h3l1.4 2v3.2zM109.3 0l-3.7 3.5V14l3.7 3.5h6L119 14V3.5L115.3 0h-6zm22.5 7.1-.2-.1v.1h-.1V7h-5.2l-1.1-1V4.7l1.1-1.2h3.3l2.1 1.8 3.2-1.8-3.6-3.5h-6l-3.7 3.5v4.3l3.4 2.6h4.8l1.4 1v1.4l-1.4 1.2h-3l-2.1-1.8-3.2 1.8 3.7 3.5h6L135 14V9.7l-3.2-2.6z"/></svg>
          <span class="label">platformOS development tools</span>
        </a>
        <span class="instance" class:offline={!$state.online}>
        {#if $state.online === undefined}
          connecting…
        {:else if $state.online === false}
          disconnected
        {:else}
          <a href={$state.online?.MPKIT_URL}>
            {$state.online?.MPKIT_URL.replace('https://', '')}
          </a>
        {/if}
      </h1>
    </div>

    <nav>
      <ul>
        {#if $state.header.includes('database')}
        <li>
          <a href="/database" class:active={$page.url.pathname.startsWith('/database')} on:focus|once={preloadTables} on:mouseover|once={preloadTables}>
            <Icon icon="database" />
            <span class="label">
              Database
            </span>
          </a>
        </li>
        {/if}

        {#if $state.header.includes('users')}
        <li>
          <a href="/users" class:active={$page.url.pathname.startsWith('/users')}>
            <Icon icon="users" />
            <span class="label">
              Users
            </span>
          </a>
        </li>
        {/if}

        {#if $state.header.includes('logs')}
        <li>
          <a href="/logs" class:active={$page.url.pathname.startsWith('/logs')}>
            <Icon icon="log" />
            <span class="label">
              Logs
            </span>
          </a>
        </li>
        {/if}

        {#if $state.header.includes('backgroundJobs')}
        <li>
          <a href="/backgroundJobs" class:active={$page.url.pathname.startsWith('/backgroundJobs')}>
            <Icon icon="backgroundJob" />
            <span class="label">
              Background Jobs
            </span>
          </a>
        </li>
        {/if}

        {#if $state.header.includes('constants')}
        <li>
          <a href="/constants" class:active={$page.url.pathname.startsWith('/constants')}>
            <Icon icon="constant" />
            <span class="label">
              Constants
            </span>
          </a>
        </li>
        {/if}

        {#if $state.header.includes('liquid')}
        {@const url = (typeof window !== 'undefined' && window.location.port !== '4173' && window.location.port !== '5173') ? `http://localhost:${parseInt(window.location.port)}` : 'http://localhost:3333'}
        <li>
          <a href="{url}/gui/liquid">
            <Icon icon="liquid" />
            <span class="label">
              Liquid Evaluator
            </span>
          </a>
        </li>
        {/if}

        {#if $state.header.includes('graphiql')}
        {@const url = (typeof window !== 'undefined' && window.location.port !== '4173' && window.location.port !== '5173') ? `http://localhost:${parseInt(window.location.port)}` : 'http://localhost:3333'}
        <li>
          <a href="{url}/gui/graphql">
            <Icon icon="graphql" />
            <span class="label">
              GraphiQL
            </span>
          </a>
        </li>
        {/if}

      </ul>
    </nav>

  </div>
</header>

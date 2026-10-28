<!-- ================================================================== -->
<script>

// imports
// ------------------------------------------------------------------------
import '../style/reset.css';
import '../style/config.css';
import '../style/general.css';
import '../style/button.css';
import '../style/forms.css';

import Header from '#lib/ui/Header.svelte';
import Notifications from '#lib/ui/Notifications.svelte';


// properties
// ------------------------------------------------------------------------
let { children } = $props();

</script>



<!-- ================================================================== -->
<Header />

{@render children()}

<Notifications />

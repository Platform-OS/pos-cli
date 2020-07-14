<script>
  import Header from '@/_components/Header.svelte'
  import Footer from '@/_components/Footer.svelte'
  import { NotificationDisplay } from '@beyonk/svelte-notifications';
</script>


<Header />

<slot />

<Footer />

<NotificationDisplay />

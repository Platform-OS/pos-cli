<script>
  import { url } from "@sveltech/routify";
</script>

<header class="text-gray-700 body-font">
  <div class="container flex flex-col flex-wrap items-center py-5 mx-auto md:flex-row">
    <a href="/" class="flex items-center mb-4 font-medium text-gray-900 title-font md:mb-0">
      <span class="text-xl">platformOS Admin</span>
    </a>
    <nav class="flex flex-wrap items-center justify-center mx-auto text-base">
      <a class="mr-5 text-lg text-blue-700 hover:underline" href={$url('../Models/index')}>
        Models
      </a>
    </nav>
  </div>
</header>
<script>
  import { url } from "@sveltech/routify";
</script>

<section class="text-gray-700 ">
  <div class="container flex flex-wrap py-8 mx-auto">
    <div class="flex flex-wrap w-full -m-4">
      <div class="p-4 lg:w-1/2 md:w-full">
        <div class="flex p-8 border-2 border-gray-200 rounded-lg sm:flex-row">
          <div class="inline-flex items-center justify-center flex-shrink-0 w-16 h-16 mb-4 text-blue-500 bg-blue-100 rounded-full sm:mr-8 sm:mb-0">
            <svg fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="w-8 h-8" viewBox="0 0 24 24">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
            </svg>
          </div>
          <div class="flex-grow ml-8">
            <h2 class="mb-3 text-lg font-medium text-gray-900 title-font">Manage database records in your application</h2>
            <ul class="list-disc list-inside">
              <li>Inspect tables and schemas</li>
              <li>Manage records (create, read, update, delete)</li>
            </ul>
            <a  href={$url('../Models/index')} class="inline-flex items-center mt-3 text-blue-500">Go to Records
              <svg fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="w-4 h-4 ml-2" viewBox="0 0 24 24">
                <path d="M5 12h14M12 5l7 7-7 7"></path>
              </svg>
            </a>
          </div>
        </div>
      </div>
      <div class="p-4 lg:w-1/2 md:w-full">
        <div class="flex p-8 border-2 border-gray-200 rounded-lg sm:flex-row">
          <div class="inline-flex items-center justify-center flex-shrink-0 w-16 h-16 mb-4 text-blue-500 bg-blue-100 rounded-full sm:mr-8 sm:mb-0">
            <svg fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="w-8 h-8" viewBox="0 0 24 24">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
            </svg>
          </div>
          <div class="flex-grow ml-8">
            <h2 class="mb-3 text-lg font-medium text-gray-900 title-font">Manage users</h2>
            <ul class="list-disc list-inside">
              <li>Inspect registered users</li>
              <li>Manage users (create, read, update, delete)</li>
            </ul>
            <a  href={$url('../Users/index')} class="inline-flex items-center mt-3 text-blue-500">Go to Users
              <svg fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="w-4 h-4 ml-2" viewBox="0 0 24 24">
                <path d="M5 12h14M12 5l7 7-7 7"></path>
              </svg>
            </a>
          </div>
        </div>
      </div>

      <div class="p-4 lg:w-1/2 md:w-full">
        <div class="flex p-8 border-2 border-gray-200 rounded-lg sm:flex-row">
          <div class="inline-flex items-center justify-center flex-shrink-0 w-16 h-16 mb-4 text-blue-500 bg-blue-100 rounded-full sm:mr-8 sm:mb-0">
            <svg fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="w-8 h-8" viewBox="0 0 24 24">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
            </svg>
          </div>
          <div class="flex-grow ml-8">
            <h2 class="mb-3 text-lg font-medium text-gray-900 title-font">Instance Logs</h2>
            <ul class="list-disc list-inside">
              <li>View system logs about performance and others</li>
              <li>View your own logs</li>
            </ul>
            <a  href={$url('/Logs')} class="inline-flex items-center mt-3 text-blue-500">Go to Logs
              <svg fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="w-4 h-4 ml-2" viewBox="0 0 24 24">
                <path d="M5 12h14M12 5l7 7-7 7"></path>
              </svg>
            </a>
          </div>
        </div>
      </div>

      <div class="p-4 lg:w-1/2 md:w-full">
        <div class="flex p-8 border-2 border-gray-200 rounded-lg sm:flex-row">
          <div class="inline-flex items-center justify-center flex-shrink-0 w-16 h-16 mb-4 text-blue-500 bg-blue-100 rounded-full sm:mr-8 sm:mb-0">
            <svg fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="w-8 h-8" viewBox="0 0 24 24">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
            </svg>
          </div>
          <div class="flex-grow ml-8">
            <h2 class="mb-3 text-lg font-medium text-gray-900 title-font">Constants editor</h2>
            <ul class="list-disc list-inside">
              <li>Check all constants in one place</li>
              <li>Create, delete, update</li>
            </ul>
            <a  href={$url('/Constants')} class="inline-flex items-center mt-3 text-blue-500">Go to Constants editor
              <svg fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="w-4 h-4 ml-2" viewBox="0 0 24 24">
                <path d="M5 12h14M12 5l7 7-7 7"></path>
              </svg>
            </a>
          </div>
        </div>
      </div>

    </div>
  </div>
</section>

<hr>

<section class="text-gray-700 ">
  <div class="container flex flex-wrap py-8 mx-auto">
    <div class="flex flex-wrap w-full -m-4">
      <div class="p-4 lg:w-1/2 md:w-full">
        <div class="flex p-8 border-2 border-gray-200 rounded-lg">
          <img src="./dupa.png" alt="Liquid Evaluator" class="w-1/3 mr-6 shadow-md">

          <div class="flex-grow">
            <h2 class="mb-3 text-lg font-medium text-gray-900 title-font">Liquid Evaluator</h2>
            <ul class="text-sm list-disc list-inside">
              <li>Run Liquid code against your instance</li>
              <li>Test Liquid logic</li>
              <li>Quickly prototype your ideas</li>
            </ul>
            <a  href="/gui/liquid" target="_blank" class="inline-flex items-center mt-3 text-blue-500">Go to Liquid Evaluator
              <svg fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="w-4 h-4 ml-2" viewBox="0 0 24 24">
                <path d="M5 12h14M12 5l7 7-7 7"></path>
              </svg>
            </a>
          </div>
        </div>
      </div>

      <div class="p-4 lg:w-1/2 md:w-full">
        <div class="flex p-8 border-2 border-gray-200 rounded-lg">
          <img src="./graphiql.png" alt="Liquid Evaluator" class="w-1/3 mr-6 shadow-md">

          <div class="flex-grow">
            <h2 class="mb-3 text-lg font-medium text-gray-900 title-font">GraphiQL</h2>
            <ul class="text-sm list-disc list-inside">
              <li>Run GraphQL against your instance</li>
              <li>Explore documentation</li>
              <li>Quickly prototype your queries and mutations</li>
            </ul>
            <a  href="/gui/graphql" target="_blank" class="inline-flex items-center mt-3 text-blue-500">Go to GraphiQL
              <svg fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="w-4 h-4 ml-2" viewBox="0 0 24 24">
                <path d="M5 12h14M12 5l7 7-7 7"></path>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<hr>

<div class="container flex flex-wrap py-8 mx-auto">
  <section class="w-full p-8 border-2 border-gray-200 rounded-lg bg-no-repeat bg-right flex flex-col gap-14 md:flex-row items-center justify-center" style="min-height: 450px; background-color: #f5f6fc">
    <div>
      <h2 class="mb-3 text-2xl font-medium text-gray-900 title-font">Try the new pos-cli gui</h2>
      <p class="mb-8">Fully operational public beta version available</p>

      <a href="http://localhost:3334" class="px-4 py-2 inline-flex items-center gap-4 bg-blue-500 text-white rounded">
        Try it
        <svg fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="w-4 h-4" viewBox="0 0 24 24">
          <path d="M5 12h14M12 5l7 7-7 7"></path>
        </svg>
      </a>
    </div>
    <img src="/tryNew.png" alt="" width="473" height="309">
  </section>
</div>

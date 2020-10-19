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
            <h2 class="mb-3 text-lg font-medium text-gray-900 title-font">Manage models in your application</h2>
            <ul class="list-disc list-inside">
              <li>Inspect model schemas</li>
              <li>Manage models (create, read, update, delete)</li>
            </ul>
            <a  href={$url('../Models/index')} class="inline-flex items-center mt-3 text-blue-500">Go to Models
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

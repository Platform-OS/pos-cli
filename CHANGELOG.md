# Changelog

## 4.21.2
* Bug: Fixed deploy not showing an error message when the release package is too large

## 4.21.1
* Bug: (GUI) Fixed parsing non-existent properties when displaying records

## 4.21.0
* Feature: (GUI) Ability to sort Network Logs

## 4.20.1
* Chore: (GUI) Updated build files

## 4.20.0
* Feature: (GUI) Added ability to aggregate Network Logs by request URL

## 4.19.0
* Feature: (GUI) Added ability to show currently running background jobs
* Feature: Added `modules update` command
* Improvement: (GUI) Made browsing logs detail faster in Logs V2
* Feature: (GUI) Added ability to filter Network Logs by Status Code
* Feature: (GUI) Extended information available in Netwok Log detail with 'execution duration' and 'response size'

## 4.18.1
* Bug: Fixed `pos-cli logs --filter` to consider log `type`

## 4.18.0
* Bug: (GUI) Fixed adding and editing records with `datetime` field
* Chore: Set minimal node version to 16
* Improvement: (GUI) Show currently running jobs in Background Jobs

## 4.17.5
* Feature: (GUI) Basic network log under `/network`
* Improvement: add new command `modules download`, bring back old syntax to `modules pull`

## 4.17.4
* Feature: (GUI) Ability to filter logs by string
* Bug: Fixed updating module version in `pos-cli modules install <module_name>` command

## 4.17.3
* Bug: Fix packing module files for `pos-cli modules push` command

## 4.17.2
* Feature: (LogsV2 Reports) Added a few built-in reports based on requests https://github.com/mdyd-dev/pos-cli/pull/572
* Bug: (GUI) Fixed parsing `null` values on the database table view for `boolean` type
* Improvement: (GUI) Editing `boolean` values not uses `<select>` instead of `textarea`
* Bug: Fixed exporting as zip instead of JSON
* Bug: Generate uniq filenames when deploying assets zip to s3

## 4.17.1
* Bug: (GUI) Fixed clearing `boolean` value saved as 'null' (string)
* Bug: (GUI) Fixed adding and editing JSONs with special characters, especially brackets

## 4.17.0
* Bug: (GUI) `0` (int) no longer outputs `null` in the database browser
* Improvement: (GUI) Make the record context menu stay open untill user clicks outside it

## 4.16.2
* Bug: Fix passing arguments to generator

## 4.16.1
* Chore: (GUI) Updated to SvelteKit 2 and Vite 5
* Chore: (GUI) Updated naming in GraphQL requests
* Feature: List and pass additional options to generators
* Feature: add `pos-cli generate list` command
* Improvement: allow to pull public modules files without env
* Improvement: modules push will pack all files

## 4.16.0
* Feature: (GUI) Added filtering by date to Logs v2
* Feature: (GUI) Added hover and active states to the table in Logs v2
* Feature: (GUI) Ability to reset sidebar width by double clicking the resize handle
* Feature: (GUI) Don't fetch logs for connection indicator and just use /info
* Feature: (GUI) Show instance link in the header and in the page title
* Feature: allow to pull public module files via `modules pull`

## 4.15.2
* Bug: Fixed running the GUI in custom port number

## 4.15.1
* Bug: Fix downloading module source with `modules pull`

## 4.15.0
* Chore: Updated Svelte dependencies
* Bug: Hardcoded links to GraphiQL and Liquid Evaluator in old GUI
* Feature: Ability to list and restore deleted records through the UI
* Feature: (PoC) Ability to search for given log timestamp and showing logs before and after it

## 4.14.4
* Improvement: allow to push modules with new directory structure `modules/<module_name>/public`
* Bug: Properly parse boolean values in GUI
* Bug: Fix adding env with `url` only

## 4.14.3
* Chore: New package build

## 4.14.2
* Bug: Fixed new logs response structure so /logsv2 would work for selected instances

## 4.14.1
* Bug: Fixed old GUI not being able to connect to the API

## 4.14.0
* Feature: Updated pos-cli gui interface with the 'Next' version, hidden the old pos-cli gui under localhost:3334

## 4.13.3
* Bug: Cleaned up Python and build tools dependencies that were blocking install on some configurations

## 4.13.2
* Chore: Recreated package-lock

## 4.13.1
* Bug: Fix `data import` request
* Bug: Fix `modules push` command

## 4.13.0
* Feature: Initial alpha implementation of new logs API

## 4.12.8
* Bug: fix adding env with `--email` option

## 4.12.7
* Bug: Fixed success message for `env add` command
* Bug: fix storing env in file

## 4.12.6

* Authorize adding new env with portal website when passing only `--url`

## 4.12.5
* Improvement: Improved UX of pagination in Next GUI
* Feature: add command `pos-cli modules install`

## 4.12.4
* Bug: graphql - fix error on deprecated types
* Improvement: graphql - update default query and mutation

## 4.12.3
* Bug: fix graphiql build

## 4.12.2
* Improvement: filter out deprecated queries and mutations in Graphiql
* Bug: Unhardcoded the API URL in new pos-cli GUI to enable using it on different ports

## 4.12.1
* Bring back schema explorer to the graphiql

## 4.12.0
* Added command for running generators from modules `pos-cli generate`
* Update graphiql
* Improvement: Accessibility improvements in pos-cli GUI
* Bug: Fixed pos-cli GUI crashing for fresh instances without logs
* Bug: Unhardcoded the API URL in new pos-cli GUI to enable using it on different ports

## 4.11.0
* Feature: Ability to sort the records
* Improvement: Pin icon on homescreen is now filled when the tool has been pinned for better UX
* Improvement: Added `arguments` section in the background job details panel
* Bug: Fixed showing `run_at` and `dead_at` dates in Background Jobs Manager
* Bug: Fixed not showing `undefined` when there is no URL for a background job
* Bug: Fixed app failure when using new background job syntax
* Bug: Fixed a problem with text overflow on Users details panel


### pos-cli gui next updates

## 4.10.0

### pos-cli gui next updates
* Added new tool - Background jobs manager
* Added ability to resize sidepanels
* New home screen design to fit more tools
* Ability to customize the header navigation by adding and removing the tool shortcuts
* Fixed hardcoded server port so multiple `pos-cli gui serve` can be run at once
* Users can now be filtered by uncomplete email string
* Fixed clearing filters and submitting form using keyboard when filtering Users
* Logs are now updated every 3 seconds
* The license changed to CC BY 3.0

## 4.9.2

### pos-cli gui next updates
* Reloading subpaths does not return 404 anymore
* More contrast on string-json toggle
* Inline validation when editing JSON type
* Enabled keyboard navigation for toggle switch in record edit form
* Fixes showing 'false' value for bool attributes
* Not clearing the filters after editing a record anymore
* Showing full values in parsed JSON logs
* Scrolling to bottom when new log appears and the page was scrolled to bottom before

## 4.9
* Add new `pos-cli gui serve` beta version at `localhost:3334`

## 4.8.1
* Fix `pos-cli sync` to not stop working when there were syntax in synced files

## 4.8.0
* use Liquid Evaluator as a title
* Fix fsevent os error
* Add `pos-cli modules init` command (initialize a module with the structure)
* Add `pos-cli modules version` command to create new version of the module
* Add `pos-cli modules push` command to publish new version fo the module

## 4.7.1
* Fix package-lock for graphql

## 4.7.0
* Fix error reporting in `pos-cli data import`
* `pos-cli data clean` runs async and waits for finish 

## 4.6.2
* Fix `--port` argument in `pos-cli gui serve`
* Add asset file size to manifest

## 4.6.1
* Add `--sync` to `pos-cli gui serve`. It will run gui and sync files in background.
* Fix deploy with custom `.pos` file location.

## 4.6.0 
* Fix logs

## 4.5.21
* Add `pos-cli constants`
* Escape HTML in `pos-cli gui` logs

### Usage

Add constant named `API_KEY` with value `abc123` on `dev` environment:

    pos-cli constants set --name API_KEY --value abc123 dev

Remove constant `API_KEY` on `staging` environment:

    pos-cli constants unset --name API_KEY staging

List defined constants without exposing their values on `production` environment:

    pos-cli constants list production

    SECRETTOKEN                                        "XX..."
    TEMP_TOKEN                                         "XX..."
    USE_SEARCH_INDEX                                   "tr..."

List defined constants showing their values on `production` environment:

    SAFE=1 pos-cli constants list production

    SECRETTOKEN                                        "XXXXXXX"
    TEMP_TOKEN                                         "XXXXXXXXXXXXXX"
    USE_SEARCH_INDEX                                   "true"

## 4.5.20
* Downgrade ora package

## 4.5.19
* Replace reporting tool
* Upgrade some npm dependencies

## 4.5.18

* Display more 99 constants in constants editor, instead of only 20

## 4.5.17

* Add `.br` and `.gz` extensions to synced files.  

## 4.5.16

* Add `pos-cli archive` command (creates a release archive without deployment)

## 4.5.15

* Do not include zip files in resources zip file (ie. `app/views/partials/Test.zip`). Zip files in assets remain intact

## 4.5.14

* Do not throw javascript error if internal waiting function rejects

## 4.5.13

* Add `.map` and `.pptx` extensions to `pos-cli sync`

## 4.5.12

#### `pos-cli gui serve` logs improvements
* Make filtering more prononunced
* Highlight filter phrase
* Make Prettified JSON full height so it is less scrolling confusion
* Add "Clear screen" button which clears all visible logs

## 4.5.11
* Add filtering of logs in `pos-cli gui serve`
* Add constants editor to `pos-cli gui serve` at `http://localhost:3333/Constants`

## 4.5.10
* Improve `pos-cli gui serve` logs behavior, layout, add pretty print

## 4.5.9
* Add logs to `pos-cli gui serve` at http://localhost:3333/Logs

## 4.5.5
* Add AVIF format to watch list

## 4.5.3
* Improve environment reporting

## 4.5.0
* Added new command `pos-cli uploads push` for uploading files for property of type `upload`

## 4.4.26
* Improve error message on wrong password when using `pos-cli env add`
* Fix `pos-cli sync` issue with `webpack` file generation, it will wait untill file is completly written.

## 4.4.25
* Deprecate `headers` in `api_calls` files in favour of `request_headers`
* Improve displaying errors on `import` and `deploy`
* Support `{% liquid %}` tag in `audit` command
* Add usage statistics

## 4.4.24 - pos-cli admin users
* Added list of users to admin (phase 1)
* Redesign of admin models list

## 4.4.22 - Init wizard
* Added `--wizard` (-w) to `pos-cli init` with choice between different templates

## 4.4.21 - 15 July 2020 - Admin improvements
* Correctly display arrays in fields
* Show `text` fields as textarea
* Fix updating `text` fields
* Add string filters to text fields
* Correctly display values in quotes, square brackets, etc. in edit view
* Improve example hints for filtering
* Improve placeholders for new records
* Improve placeholder for editing records
* Improve displaying of text, array and upload fields

## 4.4.18 - 14 July 2020
* Update GraphiQL to 1.x

## 4.4.16 - 14 July 2020
* Added platformOS Admin reached on [localhost:3333](http://localhost:3333) after running `pos-cli gui serve`
* Changed `-o` in `pos-cli gui serve` to open Admin instead of GraphiQL

## 4.4.14 - 25 May 2020
* Added liquid evaluator page in `pos-cli gui serve`

## 4.4.13 - 11 May 2020
* Fixed node.js v14 warnings

## 4.4.12 - 8 May 2020
* Added `'` and `&` as valid filename characters
* Added `-c` alias for `--concurrency` in `pos-cli sync`

## 4.5.0@beta - 8 April 2020
* `pos-cli deploy` will directly upload assets to S3 by default

## 4.4.11 - 8 April 2020
* Improved error message environment URL is not recognized, or there is no internet connection
* Added `--include-schema` (`-i`) to `pos-cli data clean`. It will additionally remove all admin resources pages, schemas, graphql queries, notifications. It will not clear instance constants or anything set up in Partner Portal

## 4.4.10 - 6 April 2020
* Fixed `pos-cli audit` - now auditing files only in `app` and `modules` directories
* Added `@` and `%` to valid `pos-cli sync` characters

## 4.4.9 - 31 March 2020
* Fixed `pos-cli deploy -d` assets manifest creation on Windows
* `pos-cli init` is now using `--force` by default
* Fixed `pos-cli audit` for graphql audit when checking multiline tag

## 4.4.8 - 26 March 2020
* `pos-cli audit` will not report filenames with characters `+ ( )` as invalid

## 4.4.7 - 26 March 2020
* Fixed regression in `sync` not syncing anymore after couple files synced

## 4.4.6 - 26 March 2020
* Fixed regression when no `--livereload` was used in `sync`

## 4.4.5 - 25 March 2020
* Added `--livereload` (`-o`) flag to `pos-cli sync` which starts livereload server to refresh browsers automatically on file change. Requires installed livereload browser extension to work

## 4.4.4 - 23 March 2020
* Added `--open` (`-o`) flag to `pos-cli gui serve` and `pos-cli sync`. It opens respectively GraphiQL and instance in default browser when ready
* Fixed windows audit for invalid file paths

## 4.4.0 - 20 March 2020
* Added `pos-cli modules pull <environment> <module name>` command. It works similar to `pos-cli pull`, but pulls only given module files. Use `pos-cli modules pull --help` to read help
* Improve messaging of wrong file types
* Added `pos-cli audit` warnings for files with invalid characters in their name
* Added `pos-cli sync` check for invalid characters in file path - invalid files will not be synced

## 4.3.0 - 18 March 2020
* `pos-cli pull` command has been added. It pulls compressed resources (pages, notifications, forms, graphql files etc.) from given environment. It pulls only files from `app/` directory. Use `pos-cli pull --help` to read help
* `pos-cli sync` is now deleting files, if file was removed while sync running
* `pos-cli audit` is now warning about wrong file types in some directories

## 4.2.5 - 25 February 2020
* Added `mp3`, `mp4`, `webm` and `ogg`, extensions to `pos-cli sync` watch list
* Added `--direct-assets-upload` (`-d`) option to `pos-cli sync` command for faster
  assets syncing

## 4.2.4 - 5 February 2020
* `pos-cli logs` now prints info about request path and partial when available
* `pos-cli migrations list` list migrations in order of execution
* Fixed `pos-cli deploy` command with `-d` option for direct assets upload

## 4.2.3 - 20 December 2019
* `pos-cli gui serve` now remembers last used query between page reloads
* `pos-cli gui serve` GraphiQL explorer will not show deprecated queries/mutations

## 4.2.2 - 19 December 2019
* Fix prettify and history features in `pos-cli gui serve`

## 4.2.1 - 19 December 2019
* Add filter to `pos-cli logs` that allows to display only given log type
* Fixed git submodules in modules/
* Add graphiql explorer to `pos-cli gui serve`

## 4.1.19 - 5 December 2019
* .zip files are now correctly synced

## 4.1.18 - 29 November 2019
* Upgrade GraphiQL to 0.17.0

## 4.1.17 - 4 November 2019
* Add support for `.posignore` file which works the same way as `.gitignore` for git
* Do not include modules assets using `pos-cli deploy` with `--direct-assets-upload` flag
* Fix packing and uploading assets when using `pos-cli deploy` with `--direct-assets-upload` flag

## 4.1.16 - 16 October 2019
* Fix error when there is no environments to list using `pos-cli env list`
* Fix spelling issue in `pos-cli data clean` message

## 4.1.15 - 1 October 2019
* Use `bundledDependencies` to prevent conflicts with globally installed npm packages

## 4.1.14 - 30 September 2019
* Send false in `partialDeploy` when deploying module

## 4.1.13 - 30 September 2019
* Fix rare case when dependency conflict between local and global packages

## 4.1.12 - 27 September 2019
* Revert commander.js version to ^2

## 4.1.10 -  27 August 2019
* Improved error handling when migration doesn't exist on the server
* Added support for Windows

## 4.1.9 - 22 August 2019
* Fixed paths to all binaries required in `pos-cli deploy` win32 + PowerShell

## 4.1.8 - 21 August 2019
* Fixed spawning audit command in `pos-cli deploy` win32 + PowerShell
* Handle deploy errors better

## 4.1.7 - 15 August 2019
* Fix syncing module files on win32 + PowerShell

## 4.1.3 - 12 August 2019
* Do not use colors or notifier when `CI=true`
* Added 413 `Entity too large` server error support
* Added MIT License
* Improved displaying errors
* Added `--force` option to `pos-cli init`

## 4.1.2 - 31 July 2019
* Fixed some server errors not showing up in `pos-cli deploy`
* Fixed `--direct-assets-upload` modules assets deploy

## 4.1.1 - 30 July, 2019
* Fixed cut off messages in notifier

## 4.1.0 - 30 July, 2019
* Improved performance of repetitive http requests (sync, logs, deploy status etc.) by using `keepAlive`
* Fixed CI environment variable support in audit
* Censored token in `DEBUG=true` mode to prevent accidental leaks
* Improved error message when there is syntax error in config file
* Improved server error handling and messages
* Switched from `glob` to `tiny-glob`
* Switched from `node-watch` to `chokidar`
* `pos-cli sync` is syncing newly created files
* `pos-cli sync` is syncing `template-values.json` files inside module directory

## 4.0.4 - 26 July, 2019
* Added audit rule for unnecessary brackets after field name
* Fixed audit bug where files deeply nested were not checked
* Added more useful information when JSON file is invalid (ie. your main config)
* `pos-cli sync` will not stop if `template-values.json` is invalid JSON
* Improved error handling for templates exception
* Improved error messages returned by the server

## 4.0.3 - 25 July, 2019
* Init is now not overriding files in current directory. Added `--force` flag to override
* Added sentry for error reporting
* Improved displaying server errors
* Added platformOS logo to sync/logs errors notifications on OS other than macOS

## 4.0.2 - 24 July, 2019
* Hotfixed deploy with modules

## 4.0.1 - 24 July, 2019
* Updated all npm dependencies
* Fixed partial deploy (`-p`) and tightened checks for app and module directories
* Fixed deploy on windows
* Fixed E2BIG error when server error/log is very big

## 4.0.0 - July 22, 2019
* 💥 BREAKING 💥 Removed `--config-file` option from all commands. `CONFIG_FILE_PATH` environment variable is working as previously
* Renamed `.marketplace-kit` file to `.pos`. To not break existing processes, `pos-cli` is looking for `.marketplace-kit` as well. This fallback will be removed in the next major version release
* Improved audit performance (by ~55x)

## 3.0.8 - July 16, 2019
* Improved messaging when using `--direct-assets-upload` in `pos-cli deploy`
* Improved help message when command is not found or argument is missing

## 3.0.7 - July 11, 2019
* Fixed `--direct-assets-upload` in `pos-cli deploy`
* Added `--concurrency` (`-c`) option to `pos-cli sync`

## 3.0.6 - July 9, 2019
* Migrated `pos-cli init` implementation to use `degit`

## 3.0.5 - July 9, 2019
* Improve error message when `pos-cli gui serve` cannot start server on a given port

## 3.0.4 - July 9, 2019
* Fixed `pos-cli gui serve`

## 3.0.0 - July 7, 2019
* Renamed `-V` flag to `-v` for version check
* Deprecated `-f` flag on `pos-cli deploy`
* Added support for `CI` environment variable. If set to `true`, `audit` will be skipped during deploy
* Added running `pos-cli audit` on deploy
* Upgraded minium supported version of node.js to 10

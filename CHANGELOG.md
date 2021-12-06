# Changelog

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

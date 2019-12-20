# Changelog

## 4.2.3 20 December 2019
* `pos-cli gui serve` now remembers last used query between page reloads 
* `pos-cli gui serve` GraphiQL explorer will not show deprecated queries/mutations

## 4.2.2 19 December 2019
* Fix prettify and history features in `pos-cli gui serve`

## 4.2.1 19 December 2019
* Add filter to `pos-cli logs` that allows to display only given log type
* Fixed git submodules in modules/ 
* Add graphiql explorer to `pos-cli gui serve`

## 4.1.19 5 December 2019
* .zip files are now correctly synced

## 4.1.18 29 November 2019
* Upgrade GraphiQL to 0.17.0

## 4.1.17 4 November 2019
* Add support for `.posignore` file
* Do not include modules assets using `pos-cli deploy` with `--direct-assets-upload` flag 
* Fix packing and uploading assets when using `pos-cli deploy` with `--direct-assets-upload` flag

## 4.1.16 16 October 2019
* Fix error when there is no environments to list using `pos-cli env list`
* Fix spelling issue in `pos-cli data clean` message

## 4.1.15 1 October 2019
* Use `bundledDependencies` to prevent conflicts with globally installed npm packages  

## 4.1.14 30 September 2019
* Send false in `partialDeploy` when deploying module

## 4.1.13 30 September 2019
* Add safety check for conflicting commanderjs instances

## 4.1.12 27 September 2019
* Revert commander.js version to ^2

## 4.1.10  27 August 2019
* Improved error handling when migration doesn't exist on the server
* Added support for Windows

## 4.1.9 22 August 2019
* Fixed paths to all binaries required in `pos-cli deploy` win32 + PowerShell

## 4.1.8 21 August 2019
* Fixed spawning audit command in `pos-cli deploy` win32 + PowerShell
* Handle deploy errors better

## 4.1.7 15 August 2019
* Fix syncing module files on win32 + PowerShell

## 4.1.3 12 August 2019
* Do not use colors when `CI=true`
* Do not use notifier when `CI=true`
* Added 413 `Entity too large` server error support.
* Added MIT License.
* Improved displaying errors.
* Added `--force` option to `pos-cli init`

## 4.1.2 31 July 2019
* Fixed some server errors not showing up in `pos-cli deploy`.
* Fixed `--direct-assets-upload` modules assets deploy

## 4.1.1 30 July, 2019
* Fixed cut off messages in notifier.

## 4.1.0 30 July, 2019
* Improved performance of repetitive http requests (sync, logs, deploy status etc.) by using keepAlive.
* Fixed CI environment variable support in audit.
* Censored token in `DEBUG=true` mode to prevent accidental leaks.
* Improved error message when there is syntax error in config file.
* Improved server error handling and messages.
* Switched from `glob` to `tiny-glob`.
* Switched from `node-watch` to `chokidar`.
* `pos-cli sync` is syncing newly created files.
* `pos-cli sync` is syncing `template-values.json` files inside module directory.

## 4.0.4 26 July, 2019
* Added audit rule for unnecessary brackets after field name.
* Fixed audit bug where files deeply nested were not checked.
* Added more useful information when JSON file is invalid (ie. your main config).
* `pos-cli sync` will not stop if `template-values.json` is invalid JSON.
* Improved error handling for templates exception.
* Improved error messages returned by the server.

## 4.0.3 25 July, 2019
* Init is now not overriding files in current directory.
* Added sentry.
* Improved displaying server errors.
* Added platformOS logo to sync/logs errors notifications on OS other than macOS.

## 4.0.2 24 July, 2019
* Hotfixed deploy with modules

## 4.0.1 24 July, 2019
* Updated all npm dependencies.
* Fixed partial deploy (`-p`) and tightened checks for app and module directories.
* Fixed deploy on windows.
* Fixed E2BIG error when server error/log is very big.

## 4.0.0 July 22, 2019
* 💥 BREAKING 💥 Removed `--config-file` option from all commands. `CONFIG_FILE_PATH` environment variable is working as previously.
* Renamed `.marketplace-kit` file to `.pos`. To not break existing processes, `pos-cli` is looking for `.marketplace-kit` as well. This fallback will be removed in the next major version release.
* Improved audit performance (by ~55x).

## 3.0.8 July 16, 2019
* Improved messaging when using `--direct-assets-upload` in `pos-cli deploy`.
* Improved help message when command is not found or argument is missing.

## 3.0.7 July 11, 2019
* Fixed `--direct-assets-upload` in `pos-cli deploy`.
* Added `--concurrency` (`-c`) option to `pos-cli sync`.

## 3.0.6 July 9, 2019
* Migrated `pos-cli init` implementation to use `degit`.

## 3.0.5 July 9, 2019
* Improve error message when `pos-cli gui serve` cannot start server on a given port.

## 3.0.4 July 9, 2019
* Fixed `pos-cli gui serve`.

## 3.0.0 July 7, 2019
* Renamed `-V` flag to `-v` for version check.
* Deprecated `-f` flag on `pos-cli deploy`.
* Added support for `CI` environment variable. If set to `true`, `audit` will be skipped during deploy.
* Added running `pos-cli audit` on deploy.
* Upgraded minium supported version of node.js to 10.

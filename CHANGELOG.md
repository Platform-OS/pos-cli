# Changelog

## 4.0.0 July 22, 2019
* 💥 BREAKING 💥 Removed `--config-file` option from all commands. `CONFIG_FILE_PATH` environment variable is working as previously.
* Renamed `.marketplace-kit` file to `.pos`. To not break existing processes, `pos-cli` is looking for `.marketplace-kit` as well. This fallback will be removed in the next major version release.
* Improved audit performance.

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

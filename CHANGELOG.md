# Changelog

## 3.0.7
* Added --concurrency (-c) option to sync

## 3.0.6 July 9, 2019
* Migrated `pos-cli init` implementation to use `degit`

## 3.0.5 July 9, 2019
* Improve messaging when `pos-cli gui serve` cannot start server on a given port.

## 3.0.4 July 9, 2019
* Fixed `pos-cli gui serve`

## 3.0.0 July 7, 2019
* Rename `-V` flag to `-v` for version check.
* Deprecated `-f` flag. Added message informing about it.
* Add support for `CI` environment variable. If true, audit will be skipped during deploy.
* Run `pos-cli audit` on deploy.
* Supported minimum node version bumped to 10.

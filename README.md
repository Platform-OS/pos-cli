# MarketplaceKit [![Version](http://img.shields.io/gem/v/marketplace-kit.svg)](https://rubygems.org/gems/marketplace-kit) [![Build Status](https://travis-ci.org/mdyd-dev/marketplace-kit.svg?branch=master)](https://travis-ci.org/mdyd-dev/marketplace-kit) [![Code Climate](https://codeclimate.com/github/crashbreak/crashbreak/badges/gpa.svg)](https://codeclimate.com/github/mdyd-dev/marketplace-kit) [![Coverage Status](https://coveralls.io/repos/github/mdyd-dev/marketplace-kit/badge.svg?branch=master)](https://coveralls.io/github/mdyd-dev/marketplace-kit?branch=master)

MarketplaceKit is a gem for Marketplace Platform users.

## Installation

Install it yourself as:

    $ gem install marketplace-kit

## Configuration

1. Go to marketplace folder you are working on
2. Ensure `marketplace_builder` directory exists
3. Create `marketplace_builder/.builder` file with endpoint names and their urls
```
{
  "localhost": {
    "url": "http://marketplace-name.lvh.me:3000"
  },
  "staging": {
    "url": "https://staging-url.near-me.com"
  },
  "production": {
    "url": "https://production-url.near-me.com"
  }
}
```

## Usage
`marketplace-kit <command> [flags]`

Example:
`marketplace-kit deploy -f -e staging`

## Available commands
All commands should be run in the marketplace directory (ie. `marketplace-nearme/`)

| Command            | Description           |
| ----------------- | ------------- |
| `pull`      | Pulls files from database and saves them in the filesystem |
| `deploy`      | Updates database using the filesystem as a source      |
| `deploy -e staging` | Deploys to staging environment (-e option is available for all commands)      |
| `deploy -f` | Updates database using the filesystem as a source with force mode enabled (override all files, don't skip not changed) |
| `sync` | Watches filesystem and updates the database on every change |


## Contributing

Contributing quick start: https://github.com/mdyd-dev/marketplace-kit/blob/master/CONTRIBUTE_README.md

Bug reports, feature requests: https://github.com/mdyd-dev/marketplace-kit/issues

Pull requests https://github.com/mdyd-dev/marketplace-kit/pulls

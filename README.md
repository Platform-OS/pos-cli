# MarketplaceKit [![Version](http://img.shields.io/gem/v/marketplace-kit.svg)](https://rubygems.org/gems/marketplace-kit) [![Build Status](https://travis-ci.org/mdyd-dev/marketplace-kit.svg?branch=master)](https://travis-ci.org/mdyd-dev/marketplace-kit) [![Code Climate](https://codeclimate.com/github/crashbreak/crashbreak/badges/gpa.svg)](https://codeclimate.com/github/mdyd-dev/marketplace-kit) [![Coverage Status](https://coveralls.io/repos/github/mdyd-dev/marketplace-kit/badge.svg?branch=master)](https://coveralls.io/github/mdyd-dev/marketplace-kit?branch=master)

MarketplaceKit is a gem for Marketplace Platform users.

## Installation

Install it yourself as:

    $ gem install marketplace-kit

## Configuration

1. Go to marketplace folder you are working on
2. Ensure marketplace_builder directory exists
3. Create marketplace_builder/.builder file
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

## Commands
All commands should be run in the marketplace directory (ie. marketplace-nearme/)

```
marketplace-kit pull
```
Pulls files from database and saves them in the filesystem

```
marketplace-kit deploy
```
Updates database using the filesystem as a source

```
marketplace-kit deploy -e staging
```
Deploys to staging environment (-e option is available for all commands)

```
marketplace-kit deploy -f
```
Updates database using the filesystem as a source with force mode enabled (override all files, don't skip not changed)
```
marketplace-kit sync
```
Enables sync mode - saves changes made in the filesystem to the database

## Contributing

Bug reports and pull requests are welcome on GitHub at https://github.com/mdyd-dev/marketplace-kit.

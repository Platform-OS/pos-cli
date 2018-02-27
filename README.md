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
  "staging": {
    "url": "https://staging-url.near-me.com"
  },
  "production": {
    "url": "https://production-url.near-me.com"
  }
}
```

4. [Optional] `default`. Endpoint marked as default will be used if you do not pass any endpoint with `-e` flag.

```
{
   "staging": {
     "url": "https://staging-url.near-me.com",
     "default": true
   }
}
```

## Usage

`marketplace-kit <command> [flags]`

### Available flags

| Flag                       | For command | Description                                                                                              |
| -------------------------- | ----------- | -------------------------------------------------------------------------------------------------------- |
| <pre>`-e <endpoint>`</pre> | all         | Specifies endpoint. Endpoint name is the key inside the `.builder` config file                           |
| `-f`<br/>`--force`         | deploy      | When added to deploy command it will deploy all the files (also those not changed) to specified endpoint |

### Available commands

All commands should be run in the marketplace directory (ie. `marketplace-nearme/`)

| Command  | Description                                                                                                                                |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `pull`   | Pulls files from database and saves them in the filesystem                                                                                 |
| `sync`   | Watches filesystem and updates specified endpoint on every file change inside `marketplace_builder` directory                              |
| `deploy` | Updates database using the filesystem as a source. By default this command is trying to send only files that changed since the last deploy |

### Examples

`marketplace-kit pull -e qa`

`marketplace-kit sync -e production`

`marketplace-kit deploy -f -e staging`

### Docker version

In case of problems with installing MPKit on your system we recommend using dockerized version of MPKit.

    docker run --rm -it -v $PWD:/src platformos/marketplace-kit sync -e sandbox -f

    docker run --rm -it -v $PWD:/src platformos/marketplace-kit deploy -e production


## Contributing

[Contributing quick start](https://github.com/mdyd-dev/marketplace-kit/blob/master/CONTRIBUTE_README.md)

[Bug reports, feature requests](https://github.com/mdyd-dev/marketplace-kit/issues)

[Pull requests](https://github.com/mdyd-dev/marketplace-kit/pulls)

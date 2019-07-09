## Overview

[pos-cli](https://github.com/mdyd-dev/pos-cli) is command line tool, which was developed to allow you to easily deploy your configuration files and assets to the platformOS. It expects you to follow a certain file structure in order to correctly communicate with the PlatformOS API. You do not have to use it, however it is highly recommended that you do. It is a CLI tool, hence you are expected to have basic knowledge in working with Terminal.

If you have any feature requests, feedback or problems please head over to the [issues page](https://github.com/mdyd-dev/pos-cli/issues) and let us know.

All commands should be run in the project root directory - i.e. one level above `app` or `modules` directory.

### Requirements

`pos-cli` requires nodejs >= v10 to work properly. [Read more on how to install node on your platform](https://nodejs.org/en/download/).

## Installation and update

If your node is installed for all users you might need to use `sudo` to install npm packages globally:

    sudo npm install -g @platformos/pos-cli

If you are using nvm or have node installed on your account, you can omit that:

    npm install -g @platformos/pos-cli

## Usage

### Adding environments and authenticating

Authentication is done with your **Partner Portal** account credentials.
See this [guide](https://documentation.platformos.com/get-started/partner-portal/inviting-new-user-to-partner-portal) if you don't have Partner Portal account yet.

To add your environment to a config file, run the `env add` command, and authenticate with your **Partner Portal** credentials:

```
pos-cli env add [environment] --email <your email> --url <your application url>
```

Example: `pos-cli env add staging --email myemail@example.com --url https://example.com`

Configuration for environments lays down in `.marketplace-kit` file.

### Syncing changes

```
pos-cli sync [environment]
```

Example: `pos-cli sync staging`

Enables sync mode - immediately pushes changes made to filesystem to the proper environment. It feels like working on localhost. For obvious reason, it is dangerous to use on production, on a live application - it is recommended to use it only for staging.

### Deploying changes

```
pos-cli deploy [environment]
```

Example: `pos-cli deploy staging`

Deploys all the changes. It is recommended to first deploy to `staging`, test, and only then trigger to production. Effectively, deploy creates a zip file containning all your files and sends it to API. It is then processed in the background. Each zip file is stored by us, in order to allow you to rollback in case something goes wrong.

To skip audit during deploy, set environmental variable `CI` to `true`.

### Code audit

```
pos-cli audit
```

Example: `pos-cli audit`

Runs statical analysis on your current project directory.

### Listing environments

If you forgot know what your environments are named or the url that is corresponding to any name, use:

```
pos-cli env list
```

### Initializing required directory structure

If you need to create new project from scratch you can init directory structure using:

```
pos-cli init --url mdyd-dev/directory-structure --branch master
```

Default url: `mdyd-dev/directory-structure`
Default branch: `master`

Init command supports all formats supported by [degit](https://github.com/Rich-Harris/degit), as it is used as an engine underneath.

It will download directory structure from official repository and extract it in your current directory.

### Graphical interface

To start http server locally that will serve GUI use:

```
pos-cli gui serve [environment]
```

Example: `pos-cli gui serve staging`

#### GraphQL Browser

To explore your instance database using GraphQL open [http://localhost:3333/gui/graphql](http://localhost:3333/gui/graphql) in your web browser.

In the right sidebar there is a schema documentation should you need it.

#### Resources editor

To list, edit and create resources open [http://localhost:3333/gui/editor](http://localhost:3333/gui/) in your web browser.

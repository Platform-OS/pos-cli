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
pos-cli env add [environment] --email [your email] --url [your application url]
```

Example: `pos-cli env add staging --email myemail@example.com --url https://example.com`

Configuration for environments lays down in `.pos` file.

### Syncing changes

```
pos-cli sync [environment]
```

Example: `pos-cli sync staging`

Enables sync mode - immediately pushes changes made to filesystem to the proper environment. It feels like working on localhost. For obvious reason, it is dangerous to use on production, on a live application - it is recommended to use it only for staging.

#### Livereloading changes

Add `--livereload` (`-l`) to your sync command to run livereload server in the background.
You need to install livereload browser extension for it to refresh your browser on file changes.

```
pos-cli sync [environment] -l
```

#### Automatically opening browser

If you add `--open` (`-o`) to the sync command, it will open your instance in default browser.  

```
pos-cli sync [environment] -o
```

#### Concurrency

By default `sync` command is using 3 concurrent connections to our server when syncing resources and assets. You can adjust it for your connection. 

```
pos-cli sync [environment] -c 10
```

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

Runs statical analysis on file in your current application directory.

### Reading logs

Errors and logs that you or the system logs for you can be accessed via `logs` command. Read more [how to create logs](https://documentation.platformos.com/api-reference/liquid/platformos-tags#log).

```
pos-cli logs [environment]
```

From now on as long as your `logs` command is running, logs will aprear here. Errors will trigger system notification if your operating system is supporting them.

You can filter logs by type using `--filter` argument.

```
pos-cli logs [environment] --filter type
```

Example:

```
pos-cli logs staging --filter debug
```

### Listing environments

If you forgot know what your environments are named or the url that is corresponding to any name, use:

```
pos-cli env list
```

### Initializing directory structure

If you need to create new project from scratch you can init directory structure using:

```
pos-cli init --url mdyd-dev/directory-structure --branch master
```

Default url: `mdyd-dev/directory-structure`
Default branch: `master`

Init command supports all formats supported by [degit](https://github.com/Rich-Harris/degit), as it is used as an engine underneath.

It will download directory structure from given git repository and extract it in your current directory.

### Modules

#### List

Lists all the installed modules via Partners Portal on a given environment.
This command will not list modules that are deployed by you via `modules/` directory.

```
pos-cli modules list [environment]
```

#### Remove

Removes a module from your application.

```
pos-cli modules remove [environment] <module name>
```

### Migrations

Migrations are files that contain liquid code (including graphql) that you want to run and have trace of what exactly has been run.

This is very helpful if you want to execute the same code on multiple environments, after code has been deployed. For example: seeding initial data.

Read more about migrations in our documentation:

* https://documentation.platformos.com/tutorials/migrations/migrating-data
* https://documentation.platformos.com/use-cases/e-commerce/seeding-configuration-data

#### List

Lists migrations deployed to the server and their current status.

```
pos-cli migrations list [environment] [name]
```

#### Generate

Generates new migration with the name you provided. It will be prepended with a timestamp so if you create more than one, they will be run in the order you intended.

Migrations are run automatically on deploy.

```
pos-cli migrations generate [environment] [name]
```

#### Run

You can run migration manually using `run` command. You must first sync the migration file to the environment.

Name of the migration is the filename without extension, or just the timestamp.

```
pos-cli migrations run [environment] [name]
```

Example:

```
pos-cli migrations run staging 20190715132951_update_admin_password
```

### Data

#### Export

Exports data from the environment to a given file in form of JSON.

Read more about exporting data with CLI, REST API and GraphQL [in our documentation](https://documentation.platformos.com/tutorials/data-import-export/export).

```
pos-cli data export staging --path=data.json
```

#### Import

Imports data from a given JSON file with proper data structure.

Read more about importing data with CLI, REST API and GraphQL [in our documentation](https://documentation.platformos.com/tutorials/data-import-export/import).


```
pos-cli data import staging --path=data.json
```

#### Clean (only staging)

Cleans data on an instance. Keep in mind that this is only removing rows of data, not the structure definition.

For example, if you have model schema `car` and there are 10 entries of type `car`, those will be deleted, but the model schema `car` will remain intact.

This is useful for testing your imports/exports or resetting your database to pristine state between tests.

**This operation is irreversible**. You will be asked twice by `pos-cli` if you are sure you want to do it.

```
pos-cli data clean staging
```

### Graphical interface

To start http server locally that will serve GUI use:

```
pos-cli gui serve [environment]
```

Example: `pos-cli gui serve staging`

#### GraphiQL Browser

To explore your instance database using GraphQL open [http://localhost:3333/gui/graphql](http://localhost:3333/gui/graphql) in your web browser.

In the right sidebar there is a schema documentation should you need it.


#### Opening GraphiQL automatically 

If you want to open GraphiQL as soon as `gui serve` is running, add `--open` (`-o`) as your argument.

```
pos-cli gui serve [environment] -o
```

#### Liquid evaluator

To open a page where you can experiment with liquid and evaluate it on your instance, open [http://localhost:3333/gui/liquid](http://localhost:3333/gui/liquid) in your browser.

## Development

`pos-cli gui serve` (graphiql) has its own build process. You will find it in `gui/editor/graphql`.

To develop install dependencies (`npm ci`) and start development mode (`npm start`).

After your work is done, build production assets (`npm run build`) and commit changes to repository.
## Overview

[pos-cli](https://github.com/mdyd-dev/pos-cli) is a command line tool developed to allow you to easily deploy your configuration files and assets to platformOS. It expects you to follow a certain file structure to correctly communicate with the platformOS API. You do not have to use it, however, it is highly recommended that you do. It is a CLI tool, hence you are expected to have basic knowledge in working with a command line interface like Terminal. 

If you have any feature requests, feedback, or problems, please head over to the [issues page](https://github.com/mdyd-dev/pos-cli/issues) and let us know.

Run all commands in the project root directory - one level above the `app` or `modules` directory.

### Requirements

`pos-cli` requires nodejs >= v16 to work properly. [Read more on how to install node on your platform](https://nodejs.org/en/download/).

## Installation and update

If your node is installed for all users you might need to use `sudo` to install npm packages globally:

    sudo npm install -g @platformos/pos-cli

If you are using nvm or have node installed on your account, you can omit that:

    npm install -g @platformos/pos-cli

## Usage

### Adding environments and authenticating

For authentication, you'll need your **Partner Portal** account credentials.
See this [guide](https://documentation.platformos.com/get-started/partner-portal/inviting-new-user-to-partner-portal) if you don't have a Partner Portal account yet.

To add your environment to a config file, run the `env add` command, and authenticate with your **Partner Portal** credentials:

    pos-cli env add [environment] --url [your application url]

Example: `pos-cli env add staging --url https://example.com`

Configuration for environments is in the `.pos` file.

### Syncing changes
    
    pos-cli sync [environment]

Example: `pos-cli sync staging`

Enables sync mode - immediately pushes changes made to the file system to the proper environment. It feels like working on localhost. Because changes are immediate, it is dangerous to use sync on production, on a live application - it is recommended to use it only for staging.

#### Livereloading changes

Add `--livereload` (`-l`) to your sync command to run the [LiveReload](http://livereload.com) server in the background.
You need to install the LiveReload browser extension for it to refresh your browser on file changes.

    pos-cli sync [environment] -l
    
#### Automatically opening the browser

If you add `--open` (`-o`) to the sync command, it will open your Instance in the default browser.  

    pos-cli sync [environment] -o
    
#### Concurrency

By default, the `sync` command uses 3 concurrent connections to our server when syncing resources and assets. You can adjust it for your connection. 

    pos-cli sync [environment] -c 10
    
### Deploying changes

    pos-cli deploy [environment]
    
Example: `pos-cli deploy staging`

Deploys all changes. It is recommended to first deploy to `staging`, test, and only then trigger a deploy to production. Effectively, deploy creates a zip file containing all your files and sends it to the API. It is then processed in the background. We store each zip file to allow you to roll back in case something goes wrong.

To skip the audit during deploy, set the environmental variable `CI` to `true`.

### Code audit

    pos-cli audit

Example: `pos-cli audit`

Runs statical analysis on files in your current application directory.

### Reading logs

Access errors and logs that you or the system logs for you using the `logs` command. Read more on [how to create logs](https://documentation.platformos.com/api-reference/liquid/platformos-tags#log).

    pos-cli logs [environment]

From now on, as long as your `logs` command is running, logs will appear here. Errors will trigger system notifications if your operating system supports them.

You can filter logs by type using the `--filter` argument.

    pos-cli logs [environment] --filter type

Example:

    pos-cli logs staging --filter debug

### Logs V2

#### LOGS

examples:

    pos-cli logsv2 search stg --size 5 --from 0

    pos-cli logsv2 search stg --sql "select *  from logs" --json | jq

    pos-cli logsv2 search stg --sql "select message,type  from logs" --json | jq

    pos-cli logsv2 search stg --sql "select * from logs where str_match(message, 'com')" --start_time 1694694303000000 --size 5 | jq

#### ALERTS

examples: 

    pos-cli logsv2 alerts list stg # list alerts

    pos-cli logsv2 alerts add stg --url SLACK_URL --name descriptive-alert-title-slack-02 --column message --operator Contains --keyword 'this is fine' --channel gcp-alerts

    pos-cli logsv2 alerts list stg 

    pos-cli logsv2 alerts trigger stg --name descriptive-alert-title-slack-02
    
    
#### ROADMAP

- alerts delete 
- better errors
- GUI

### Listing environments

If you forgot what your environments are called or the URL that corresponds to any name, use:

    pos-cli env list

### Initializing the directory structure

If you need to create a new project from scratch you can initialize the directory structure using:

    pos-cli init --url mdyd-dev/directory-structure --branch master

Default URL: `mdyd-dev/directory-structure`
Default branch: `master`

The `init` command supports all formats supported by [degit](https://github.com/Rich-Harris/degit), as it is used as an engine underneath.

It downloads the directory structure from a given git repository and extracts it in your current directory.

### Managing constants

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


### Modules

#### List

Lists all modules installed through the Partners Portal on a given environment.
This command will not list modules that you deployed via the `modules/` directory.

    pos-cli modules list [environment]

#### Initialize

Create a new module based on module starter repository.

    pos-cli modules init <module name>
    
#### Installation

You can install modules that are published in modules marketplace by adding them to `app/pos-modules.json`. To make that you can use `pos-cli modules install`

    pos-cli modules install <env> [module name]
    pos-cli deploy <env>

#### Remove

Removes a module from your application.

    pos-cli modules remove [environment] <module name>

#### Publishing

In order to publish module to our module repository first you have to create module on Partner Portal (https://partners.platformos.com/pos_modules/new) and give it a unique name.
Create sepeate directory for your new module. Then you can run `pos-cli init <module_name>` to create necessary directory structure. 

    mkdir <module_name>; cd <module_name>
    pos-cli init <module_name>

Once you have prepared your module you can release the new version and the publish it

    pos-cli modules version x.x.x
    pos-cli modules push --email <your_email>
    

#### Pulling module codebase

You can fetch the module codebase that is deployed on your instance.

    pos-cli modules pull <env> <module_name>
    
It will download and unpack module files into `modules/<module_name>` directory.

#### Downloading module version codebase

You can download public module codebase that has been released.

    pos-cli modules download <module_name>
    

##### module templates

Templates provide automatic processing for easier module configuration. For example, upon installing a module, it is possible to specify URIs under which pages will be available after the module has been installed. This works both in sync and deploy mode.

Markup is the commonly used ERB/EJS stye: `<%=` `=%>` there is no logic supported, the only available filter is `&` which will unescape the value provided by the user (by default they are all escaped).

Values for variables have to be provided in the root module directory `template-values.json`, but you can set the location of the configuration file using the `TEMPLATE_VALUES_FILE_PATH` variable.

For example, by executing `TEMPLATE_VALUES_FILE_PATH=templates/values.json pos-cli deploy staging` the `templates/values.json` file will be used as values for templates.

Directory structure with `template-values.json`:

```shell
modules
└──admincms
    ├── template-values.json
    ├── private
    │   └── graphql
    │       ├── get_models.graphql
    │       └── get_pages.graphql
    └── public
        └── views
            └── pages
                └── admin.liquid
```

**Example**

A page with this code

```yaml
---
slug: <%= &desired_location =%>
---

This is using templates <%= what =%> !
```

and a `template-values.json`

```json
{
  "desired_location": "index",
  "what": "magic"
}
```

will turn into this during deploy/sync:

```yaml
---
slug: index
---

This is using templates magic!
```

### Migrations

Migrations are files that contain Liquid code (including GraphQL) that you want to run and have a trace of what exactly has been run.

This is very helpful if you want to execute the same code on multiple environments after the code has been deployed. For example, seeding initial data.

Read more about migrations in our documentation:

* https://documentation.platformos.com/developer-guide/data-import-export/migrating-data
* https://documentation.platformos.com/use-cases/e-commerce/seeding-configuration-data

#### List

Lists migrations deployed to the server and their current status.

    pos-cli migrations list [environment] [name]

#### Generate

Generates new migration with the name you provided. It will be prepended with a timestamp so if you create more than one, they will be run in the order you intended.

Migrations run automatically on deploy.

    pos-cli migrations generate [environment] [name]

#### Run

You can run a migration manually using the `run` command. You must first sync the migration file to the environment.

The name of the migration is the filename without the extension, or just the timestamp.

    pos-cli migrations run [environment] [name]

Example:

    pos-cli migrations run staging 20190715132951_update_admin_password

### Data

#### Export

Exports data from the environment to a given file in JSON format.

Read more about [exporting data with the CLI, REST API and GraphQL](https://documentation.platformos.com/developer-guide/data-import-export/export) in our documentation.

    pos-cli data export staging --path=data.json

#### Import

Imports data from a given JSON file with proper data structure.

Read more about [importing data with the CLI, REST API and GraphQL](https://documentation.platformos.com/developer-guide/data-import-export/import) in our documentation.

    pos-cli data import staging --path=data.json

#### Clean (only staging)

Cleans data on an Instance. Keep in mind that this only removes rows of data, not the structure definition.

For example, if you have a model schema `car` and there are 10 entries of type `car`, those will be deleted, but the model schema `car` will remain intact.

This is useful for testing your imports/exports or resetting your database to a pristine state between tests.

**This operation is irreversible**. `pos-cli` will ask you twice if you are sure you want to do it.

    pos-cli data clean staging

### Admin - Graphical interface

To start the http server locally that will serve the GUI use:

    pos-cli gui serve [environment]

Example: `pos-cli gui serve staging`

To open platformOS Admin go to [http://localhost:3333](http://localhost:3333)

#### Opening Admin automatically 

If you want to open platformOS Admin as soon as `gui serve` is running, add `--open` (`-o`) as your argument.

    pos-cli gui serve [environment] -o
    
    
#### Running with sync

Usualy in day to day work you want to have `gui serve` and `sync` run. You can do it with one command:

    pos-cli gui serve [environment] -o --sync

#### GraphiQL Browser

To explore your Instance database using GraphQL open [http://localhost:3333/gui/graphql](http://localhost:3333/gui/graphql) in your web browser.

In the right sidebar there is a schema documentation should you need it.

#### Liquid evaluator

To open a page where you can experiment with Liquid and evaluate it on your Instance, open [http://localhost:3333/gui/liquid](http://localhost:3333/gui/liquid) in your browser.


### Generators

In order to quickly create files you can use generators. They are provided by modules. 
For example `core` module provide `command` generator. You can use it like this:

      pos-cli generate modules/core/generators/command users/create
      
You can also display help for generator with this command:

      pos-cli generate modules/core/generators/command --generator-help


## Development

`pos-cli gui serve` (graphiql) has its own build process. You will find it in `gui/editor/graphql`.

Develop install dependencies (`npm ci`) and start development mode (`npm start`).

After your work is done, build production assets (`npm run build`) and commit changes to the repository.

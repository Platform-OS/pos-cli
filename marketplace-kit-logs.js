#!/usr/bin/env node

const program = require('commander'),
  EventEmitter = require('events'),
  fetchAuthData = require('./lib/settings').fetchSettings,
  request = require('request'),
  notifier = require('node-notifier'),
  fs = require('fs');

const fetchLogs = (authData) => {
  return new Promise((resolve, reject) => {
    request(
      {
        uri: authData.url + 'api/marketplace_builder/logs',
        qs: { last_id: storage.lastId },
        method: 'GET',
        headers: { UserTemporaryToken: authData.token }
      },
      (error, response, body) => {
        if (error)
          reject({status: error});
        else if (response.statusCode != 200)
          reject({status: response.statusCode, message: response.statusMessage});
        else
          resolve(JSON.parse(body));
      }
    );
  });
};

const printLogEntry = (row) => {
  process.stdout.write(`${row.id} [${row.created_at}] ${row.error_type}: ${row.message.replace(/\n$/, '')} \n`);
};

class LogStream extends EventEmitter {
  constructor(authData) {
    super();
    this.authData = authData;
  }

  start() {
    const t = this;
    setInterval(() => t.fetchData(), process.env.INTERVAL);
  }

  fetchData() {
    fetchLogs(this.authData).then(
      ({logs}) => {
        for (let k in logs) {
          let row = logs[k];

          if (!storage.exists(row.id)) {
            this.emit('message', row);
          }
        };
      },
      error => {
        console.error(error);
        process.exit(1);
      }
    );
  }
}

const storage = {
  logs: {},
  lastId: 0,
  add: item => {
    storage.logs[item.id] = item;
    storage.lastId = item.id;
  },
  exists: key => {
    return storage.logs.hasOwnProperty(key);
  }
};

program
  .arguments('<environment>', 'name of environment. Example: staging')
  .option('-c --config-file <config-file>', 'config file path', '.marketplace-kit')
  .option('--interval <interval>', 'time to wait between updates in ms', 3000)
  .action((environment, params) => {
    process.env.CONFIG_FILE_PATH = params.configFile;
    process.env.INTERVAL = program.interval;

    const authData = fetchAuthData(environment);
    const stream = new LogStream(authData);

    stream.on('message', storage.add);
    stream.on('message', printLogEntry);
    stream.on('message', message => {
      if (message.error_type == 'error')
        notifier.notify({ title: message.error_type, message: message.message });
    });

    stream.start();
  });

program.parse(process.argv);
if (!program.args.length) {
  program.help();
  process.exit(1);
}

#!/usr/bin/env node

const program = require('commander'),
  EventEmitter = require('events'),
  fetchAuthData = require('./lib/settings').fetchSettings,
  notifier = require('node-notifier'),
  logger = require('./lib/kit').logger,
  Gateway = require('./lib/proxy'),
  validate = require('./lib/validators'),
  WebSocket = require('ws'),
  http = require('http');

class LogStream extends EventEmitter {
  constructor(authData) {
    super();
    this.authData = authData;
    this.gateway = new Gateway(authData);
    this.ws = new WebSocket(`${this.gateway.logsUrl}/connect`, this.authData.token);
    this.ws.on('error', (e) => {
      if(e.message.indexOf('401') > -1) {
        logger.Error('Error connecting to server: Unauthorized request.');
      } else
        logger.Error('Error connecting to server: ' + e);
    });
  }

  start() {
    this.subscribe();
    logger.Info('Live logging has started. \n ---');
  }

  subscribe() {
    const _this = this;

    this.ws.on('message', function incoming(data) {
      try {
        const msg = JSON.parse(data);
        if (!msg.message) return false;

        const options = { hideTimestamp: true };
        const text = `[${msg.created_at.replace('T', ' ')}] - ${msg.error_type}: ${msg.message.replace(/\n$/, '')}`;

        if(isError(msg)) {
          logger.Error(text, options);
          notifier.notify({ title: msg.error_type, message: msg.message });
        } else
          logger.Info(text, options);
      } catch (e) {
        logger.Error('Error parsing data: ' + e)
      }
    });
  }
}

const isError = msg => !msg.error_type.match(/info|debug/gi);

const fetchLogsByIndex = (authData, from, to) => {
  this.gateway = new Gateway(authData);
  this.gateway.logs(from, to).then(
    (logs) => {
      const options = { hideTimestamp: true };
      logs = Array.isArray(logs) ? logs : [logs];
      logs.forEach( (msg) => {
        try {
          msg = JSON.parse(msg);
        } catch(e) {}
        const text = `[${msg.created_at.replace('T', ' ')}] - ${msg.error_type}: ${msg.message.replace(/\n$/, '')}`;

        isError(msg) ? logger.Error(text, options) : logger.Info(text, options);
      });
    },
    error => {
      logger.Error(error);
      process.exit(1);
    }
  );
}

program
  .arguments('<environment>', 'name of environment. Example: staging')
  .option('-c --config-file <config-file>', 'config file path', '.marketplace-kit')
  .option('--index-from <integer>', 'Show logs from')
  .option('--index-to <integer>', 'Show logs to')
  .action((environment, params) => {
    process.env.CONFIG_FILE_PATH = params.configFile;
    const authData = fetchAuthData(environment);
    if(params.indexFrom || params.indexTo){
      fetchLogsByIndex(authData, params.indexFrom, params.indexTo);
    } else {
      const stream = new LogStream(authData);
      stream.start();
    }
  });

program.parse(process.argv);

validate.existence({ argumentValue: program.args[0], argumentName: 'environment', fail: program.help.bind(program) });

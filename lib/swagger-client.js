import { fetchSettings } from '../lib/settings.js';
import path from 'path';
import { fileURLToPath } from 'url';
import Gateway from '../lib/proxy.js';
import logger from '../lib/logger.js';
import { apiRequest } from './apiRequest.js';
import api from './logsv2/http.js';
import fs from 'fs';
import colors from 'colors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class APIs {
  constructor(ctx) {
    this.Search = new Search(ctx);
    this.Alerts = new Alerts(ctx);
  }
}

class Alerts {
  constructor(ctx) {
    this.ctx = ctx;
  }

  async ListAlerts({org_id}, {securities}) {
    return await api.get(this.ctx.url + `/api/${org_id}/alerts`, {
      securities: securities
    });
  }

  async TriggerAlert({org_id, stream_name, alert_name}, {requestBody, securities}) {
    return await api.put(this.ctx.url + `/api/${org_id}/${stream_name}/alerts/${alert_name}/trigger`, {
      securities: securities,
      body: requestBody
    });
  }
  async SaveAlert({org_id, stream_name, alert_name}, {requestBody, securities}) {
    console.log(requestBody);
    return await api.post(this.ctx.url + `/api/${org_id}/${stream_name}/alerts/${alert_name}`, {
      securities: securities,
      body: requestBody
    });
  }

  async CreateTemplate({org_id, template_name}, {requestBody, securities}) {
    return await api.post(this.ctx.url + `/api/${org_id}/alerts/templates/${template_name}`, {
      securities: securities,
      body: requestBody
    });
  }

  async CreateDestination({org_id, destination_name}, {requestBody, securities}) {
    return await api.post(this.ctx.url + `/api/${org_id}/alerts/destinations/${destination_name}`, {
      securities: securities,
      body: requestBody
    });
  }
}

class Search {
  constructor(ctx) {
    this.ctx = ctx;
  }

  async SearchSQL({org_id}, {requestBody, securities}) {
    return await api.post(this.ctx.url + `/api/${org_id}/_search`, {
      securities: securities,
      body: requestBody
    });
  }

  async SearchAround({org_id, stream_name, key, size, sql}, {requestBody, securities}) {
    if (sql == undefined) sql = "";
    return await api.get(this.ctx.url + `/api/${org_id}/${stream_name}/_around`, {
      securities: securities,
      params: { key, size, sql }
    });
  }

}

class LogClient {
  constructor({ url }) {
    this.apis = new APIs(this);
    this.url = url;
  }
}

class SwaggerProxy {
  static async client(environment) {
    try {
      const LOGS_PROXY_URL = process.env.LOGS_PROXY_URL || 'https://openobserve-proxy.platformos.dev'

      const client = new LogClient({url: LOGS_PROXY_URL});

      const authData = fetchSettings(environment);
      const securities = { authorized: { Authorization: authData.token }}
      const instance = await new Gateway(authData).getInstance()
      instance.url = authData.url

      logger.Debug({instance, authData, securities})

      return new SwaggerProxy(client, instance, securities);
    }
    catch(e) {
      if (e.statusCode == 401)
        logger.Error(`[Unauthorized] Please ensure your token is correct.\nTo refresh your token, execute the following command:\npos-cli env refresh-token ${ environment }`);
      else
        logger.Error(e)
    }
  }

  constructor(client, instance, securities) {
    this.client = client
    this.instance = instance
    this.securities = securities
  }

  async searchAround(program){
    return this.client.apis.Search
      .SearchAround(
        {org_id: this.instance.uuid, stream_name: program.stream_name, key: program.key, size: program.size, sql: program.sql},
        {securities: this.securities})
  }

  async searchSQLByQuery(query){
    return this.client.apis.Search
      .SearchSQL(
        {org_id: this.instance.uuid},
        {requestBody: query, securities: this.securities})
  }

  async searchSQL(program){
    return this.searchSQLByQuery(search.buildQuery(program))
  }

  async alerts(program){
    return this.client.apis.Alerts
      .ListAlerts({org_id: this.instance.uuid}, {securities: this.securities})
  }

  async triggerAlert(program){
    return this.client.apis.Alerts
      .TriggerAlert(
        {org_id: this.instance.uuid, stream_name: 'logs', alert_name: program.name},
        {securities: this.securities})
  }

  async createAlert(program){
    const alert = alerts.buildAlert(program)

    const template = await this.createTemplate(program)
    logger.Debug(template.body)
    const destination = await this.createDestination(program)
    logger.Debug(destination.body)

    return this.client.apis.Alerts
      .SaveAlert(
        {org_id: this.instance.uuid, stream_name: 'logs', alert_name: program.name},
        {requestBody: alert, securities: this.securities})
  }

  async createDestination(program){
    const destination = alerts.buildDestination(program)
    logger.Debug(destination)
    return this.client.apis.Alerts
      .CreateDestination(
        {org_id: this.instance.uuid, destination_name: program.name},
        {requestBody: destination, securities: this.securities})
  }

  async createTemplate(program){
    program.instance = this.instance
    const template = { name: program.name, body: alerts.templates.slack(program), isDefault: true }
    logger.Debug(template)
    return this.client.apis.Alerts
      .CreateTemplate(
        {org_id: this.instance.uuid, template_name: program.name},
        {requestBody: template, securities: this.securities})
  }
}

const alerts = {
  templates: {
    slack({name, operator, keyword, column, channel, instance}) {
      const template = JSON.parse(fs.readFileSync(path.join(__dirname, './openobserve/alerts/slack.json')));
      template.channel = channel

      const description = `*Alert details:*\n *${column}* column ${operator} *${keyword}* keyword`
      template.text = description
      template.blocks.push({type: 'section', text: {text: description, type: "mrkdwn"}})

      const instanceInfo = `*Instance*:\n ${instance.url}`
      template.blocks.push({type: 'section', text: {text: instanceInfo, type: "mrkdwn"}})

      return template
    }
  },
  buildDestination({url, name}){
    return {
      "headers": {
      },
      "method": "post",
      "name": name,
      "skip_tls_verify": false,
      "template": name,
      "url": url
    }
  },
  buildAlert({from, name, keyword, sql, column, operator}){
    return {
      "condition": {
        "column": "message",
        "ignoreCase": true,
        "isNumeric": true,
        "operator": operator,
        "value": keyword
      },
      "destination": name,
      "duration": 0,
      "frequency": 0,
      "is_real_time": true,
      "name": name,
      "time_between_alerts": 0
    }
  }
}

const search = {
  buildQuery({from, size, start_time, end_time, sql}) {
    query = {
      query: {
        from: parseInt(from),
        size: parseInt(size),
        sql: (sql || 'select * from logs')
      }
    }
    if (start_time) query.query['start_time'] = parseInt(start_time)
    if (end_time) query.query['end_time'] = parseInt(end_time)

    return query
  },
  printJSON: logger.Info,

  printLogs(response, key) {
    Object
      .entries(response.hits)
      .map((item) => {
        item[1].highlight = item[1]._timestamp.toString() == key;
        return item;
      })
      .forEach(search.printLog)
  },
  printLog(hit) { console.log(search.formatHit(hit)) },
  formatHit([id, hit]) {
    const row = `[${search.toDate(hit._timestamp)}] ${hit._timestamp} ${hit.type} | ${hit.message}`
    if (hit.highlight) {
      return row.blue
    } else {
      return row
    }
  },
  printReport(response, report) {
    console.log(report.meta.title)
    if (response.aggs)
      console.table(
        Object.entries(response.aggs.histogram).map((r) => { return r[1] }),
        report.meta.columns
      )
  },
  toDate(timestamp) {
    if (timestamp)
      return new Date(timestamp / 1000).toLocaleString()
    else
      "---"
  },
}

export { SwaggerProxy, search };

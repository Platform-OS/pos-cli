const fetchAuthData = require('../lib/settings').fetchSettings,
      path = require('path'),
      Gateway = require('../lib/proxy'),
      logger = require('../lib/logger'),
      fs = require('fs');

class HTTP {
  static async get(url, {params, securities}) {
    const r = await fetch(url + '?' + new URLSearchParams(params), {
      headers: {
        Authorization: `Bearer ${securities.authorized.Authorization}`
      }
    });

    if (r.status != 200) {
      console.log(r);
      const body = await r.json();
      throw new Error(r.statusText + ":" + JSON.stringify(body))
    }

    return await r.json();
  }

  static async post(url, {securities, body}) {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${securities.authorized.Authorization}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (r.status != 200) {
      console.log(r);
      throw new Error(r.statusText)
    }

    return await r.json();
  }

  static async put(url, {securities, body}) {
    const r = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${securities.authorized.Authorization}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (r.status != 200) {
      throw new Error(r.statusText)
    }

    return await r.json();
  }
}

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

  // /api/{org_id}/alerts
  async ListAlerts({org_id}, {securities}) {
    return await HTTP.get(this.ctx.url + `/api/${org_id}/alerts`, {
      securities: securities
    });
  }

  // /api/{org_id}/{stream_name}/alerts/{alert_name}/trigger
  async TriggerAlert({org_id, stream_name, alert_name}, {requestBody, securities}) {
    return await HTTP.put(this.ctx.url + `/api/${org_id}/${stream_name}/alerts/${alert_name}/trigger`, {
      securities: securities,
      body: requestBody
    });
  }
  // /api/{org_id}/{stream_name}/alerts/{alert_name}
  async SaveAlert({org_id, stream_name, alert_name}, {requestBody, securities}) {
    console.log(requestBody);
    return await HTTP.post(this.ctx.url + `/api/${org_id}/${stream_name}/alerts/${alert_name}`, {
      securities: securities,
      body: requestBody
    });
  }

  // /api/{org_id}/alerts/templates/{template_name}
  async CreateTemplate({org_id, template_name}, {requestBody, securities}) {
    return await HTTP.post(this.ctx.url + `/api/${org_id}/alerts/templates/${template_name}`, {
      securities: securities,
      body: requestBody
    });
  }

  // /api/{org_id}/alerts/destinations/{destination_name}
  async CreateDestination({org_id, destination_name}, {requestBody, securities}) {
    return await HTTP.post(this.ctx.url + `/api/${org_id}/alerts/destinations/${destination_name}`, {
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
    return await HTTP.post(this.ctx.url + `/api/${org_id}/_search`, {
      securities: securities,
      body: requestBody
    });
  }

  async SearchAround({org_id, stream_name, key, size, sql}, {requestBody, securities}) {
    if (sql == undefined) sql = "";
    return await HTTP.get(this.ctx.url + `/api/${org_id}/${stream_name}/_around`, {
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

      const authData = fetchAuthData(environment);
      const securities = { authorized: { Authorization: authData.token }}
      const instance = await new Gateway(authData).getInstance()
      instance.url = authData.url

      logger.Debug({instance, authData, securities})

      return new SwaggerProxy(client, instance, securities);
    }
    catch(e) {
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

  async searchSQL(program){
    const query = search.buildQuery(program)
    logger.Debug(query)

    return this.client.apis.Search
      .SearchSQL(
        {org_id: this.instance.uuid},
        {requestBody: query, securities: this.securities})
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

    // console.log(this.client.apis.Alerts)

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

alerts = {
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

search = {
  buildQuery({from, size, start_time, end_time, sql}) {
    query = {
      agg: { histogram: "SELECT histogram(_timestamp, '5 minute') AS key, COUNT(*) AS num FROM query GROUP BY key ORDER BY key" },
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
  printLogs(response) {
    Object.entries(response.hits).forEach(search.printLog)
  },
  printLog(hit) { console.log(search.formatHit(hit)) },
  formatHit([id, hit]) { return `[${search.toDate(hit._timestamp)}] ${hit.type} | ${hit.message}` },
  toDate(timestamp) { return new Date(timestamp / 1000).toLocaleString() },
}

module.exports = { SwaggerProxy, search };

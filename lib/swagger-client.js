const SwaggerClient = require('swagger-client'),
      fetchAuthData = require('../lib/settings').fetchSettings,
      path = require('path'),
      Gateway = require('../lib/proxy'),
      logger = require('../lib/logger'),
      fs = require('fs');

class SwaggerProxy {
  static async client(environment) {
    try {
      const spec = JSON.parse(fs.readFileSync(path.join(__dirname, './openobserve/openapi.json')));
      spec.servers = [ { url: 'https://openobserve-proxy.platformos.dev'} ];
      const client = await SwaggerClient({ spec });

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
    Object.entries(JSON.parse(response.data).hits).forEach(search.printLog)
  },
  printLog(hit) { console.log(search.formatHit(hit)) },
  formatHit([id, hit]) { return `[${search.toDate(hit._timestamp)}] ${hit.type} | ${hit.message}` },
  toDate(timestamp) { return new Date(timestamp / 1000).toLocaleString() },
}

module.exports = { SwaggerProxy, search };

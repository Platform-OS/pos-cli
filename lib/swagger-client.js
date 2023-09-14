const SwaggerClient = require('swagger-client'),
      path = require('path'),
      fs = require('fs');

const spec = JSON.parse(fs.readFileSync(path.join(__dirname, './openobserve/openapi.json')));
spec.servers = [ { url: 'https://openobserve-proxy.platformos.dev'} ]

const client = async () => await SwaggerClient({ spec });

module.exports = { client };

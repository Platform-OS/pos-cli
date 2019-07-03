/* global React, ReactDOM, GraphiQL */

// Parse the search string to get url parameters.
var search = window.location.search;
var parameters = {};

search
  .substr(1)
  .split('&')
  .forEach(function(entry) {
    var eq = entry.indexOf('=');
    if (eq >= 0) {
      parameters[decodeURIComponent(entry.slice(0, eq))] = decodeURIComponent(entry.slice(eq + 1));
    }
  });

// if variables was provided, try to format it.
if (parameters.variables) {
  try {
    parameters.variables = JSON.stringify(JSON.parse(parameters.variables), null, 2);
  } catch (e) {
    console.error(e);
  }
}

// When the query and variables string is edited, update the URL bar so
// that it can be easily shared
function onEditQuery(newQuery) {
  parameters.query = newQuery;
  updateURL();
}

function onEditVariables(newVariables) {
  parameters.variables = newVariables;
  updateURL();
}

function onEditOperationName(newOperationName) {
  parameters.operationName = newOperationName;
  updateURL();
}

function updateURL() {
  let newSearch = Object.keys(parameters)
    .filter(key => Boolean(parameters[key]))
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(parameters[key])}`)
    .join('&');

  history.replaceState(null, null, `?${newSearch}`);
}

function graphQLFetcher(graphQLParams) {
  return fetch('/graphql', {
    method: 'post',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(graphQLParams),
    credentials: 'include'
  })
    .then(response => response.text())
    .then(responseBody => {
      try {
        return JSON.parse(responseBody);
      } catch (e) {
        console.error(e);
      }

      return responseBody;
    });
}

ReactDOM.render(
  React.createElement(GraphiQL, {
    fetcher: graphQLFetcher,
    query: parameters.query,
    variables: parameters.variables,
    operationName: parameters.operationName,
    onEditQuery: onEditQuery,
    onEditVariables: onEditVariables,
    onEditOperationName: onEditOperationName
  }),
  window['graphiql']
);

// Top bar connection info
let printConnectionInfo = env => {
  window['status-bar'].textContent = `platformOS - ${env.MPKIT_URL}`;
};

fetch('/info')
  .then(response => response.json())
  .then(printConnectionInfo)
  .catch(console.error);

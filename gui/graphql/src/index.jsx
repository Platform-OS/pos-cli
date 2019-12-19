import React, { Component } from "react";
import { render } from "react-dom";
import { buildClientSchema, getIntrospectionQuery, parse } from "graphql";
import GraphiQL from "graphiql";
import GraphiQLExplorer from "graphiql-explorer";
import "graphiql/graphiql.css";

let printConnectionInfo = env => {
  document.querySelector(
    "#status-bar"
  ).textContent = `platformOS - ${env.MPKIT_URL}`;
};

fetch("/info")
  .then(response => response.json())
  .then(printConnectionInfo)
  .catch(console.error);

const fetcher = params => {
  return fetch("/graphql", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    credentials: "same-origin",
    body: JSON.stringify(params)
  })
    .then(response => {
      return response.text();
    })
    .then(responseBody => {
      try {
        return JSON.parse(responseBody);
      } catch (e) {
        return responseBody;
      }
    });
};

const DEFAULT_QUERY = `query GetModel {
  models(per_page: 10) {
    results {
      id
      model_schema_name
    }
  }
}

mutation CreateSession {
  user_session_create(email: "test@example.com", password: "s3cretp@ssw0rd1337") {
    id
  }
}`;

class App extends Component {
  constructor(props) {
    super(props);
    this._graphiql = GraphiQL;
    this.state = {
      schema: null,
      query: DEFAULT_QUERY,
      explorerIsOpen: true
    };
  }

  componentDidMount() {
    fetcher({
      query: getIntrospectionQuery()
    }).then(result => {
      this.setState({ schema: buildClientSchema(result.data) });
    });
  }

  _handleEditQuery = query => {
    this.setState({ query });
  };

  _handleToggleExplorer = () => {
    this.setState({ explorerIsOpen: !this.state.explorerIsOpen });
  };

  render() {
    const { query, schema } = this.state;
    return (
      <div className="graphiql-container">
        <GraphiQLExplorer
          schema={schema}
          query={query}
          onEdit={this._handleEditQuery}
          explorerIsOpen={this.state.explorerIsOpen}
          onToggleExplorer={this._handleToggleExplorer}
        />
        <GraphiQL
          ref={n => {
            this.editor = n;
          }}
          fetcher={fetcher}
          schema={schema}
          query={query}
          onEditQuery={this._handleEditQuery}
          docExplorerOpen={false}
        >
          <GraphiQL.Toolbar>
            <GraphiQL.Button
              onClick={() => this.editor.handlePrettifyQuery()}
              title="Prettify Query (Shift-Ctrl-P)"
              label="Prettify"
            />
            <GraphiQL.Button
              onClick={() => this.editor.handleToggleHistory()}
              title="Show History"
              label="History"
            />
            <GraphiQL.Button
              onClick={() => this._handleToggleExplorer()}
              label="Explorer"
              title="Toggle Explorer"
            />
          </GraphiQL.Toolbar>
        </GraphiQL>
      </div>
    );
  }
}

render(<App />, document.getElementById("graphiql"));

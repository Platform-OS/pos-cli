// Must come first: it assigns MonacoEnvironment, which Monaco reads while graphiql is being
// imported below. See setup-workers.js.
import './setup-workers.js';

import { explorerPlugin } from '@graphiql/plugin-explorer';
import '@graphiql/plugin-explorer/style.css';
import { GraphiQL } from "graphiql";
import "graphiql/style.css";
import { buildClientSchema, getIntrospectionQuery } from "graphql";
import React from "react"; // This import is required!!!
import { useEffect, useState } from "react";
import { createRoot } from 'react-dom/client';
import './index.css';

let printConnectionInfo = env => {
  document.querySelector(
    "#status-bar"
  ).textContent = `platformOS - ${env.MPKIT_URL}`;
};

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

const DEFAULT_QUERY = `
query search {
  records(per_page: 10) {
    results {
      id
    }
  }
}

mutation create {
  user_create(
    user: {
      email: "foo@example.com"
    }
  ) {
    id
  }
}
`;


const cleanSchema = schema => {
  const types = schema.__schema.types.map(type => {
    if ((type.name === 'RootQuery' || type.name === 'RootMutation') && type.fields && type.fields.length > 0) {
      type.fields = type.fields.filter(field => !field.isDeprecated);
    }
    return type;
  })
  schema.__schema.types = types;

  return schema;
};

// Built once, at module scope: the plugin object is part of GraphiQL's state, so rebuilding it
// on every render would reset the explorer as you type.
const explorer = explorerPlugin();

function App() {
  const handleEditQuery = query => {
    localStorage.setItem("query", query);
  };

  useEffect(() => {
    fetcher({
      query: getIntrospectionQuery()
    }).then(result => {
      // GraphiQL 5 hands the schema to the Monaco GraphQL worker as SDL, so every input default
      // has to survive printSchema(). Under graphql 17 they all do: buildClientSchema keeps an
      // introspected default as the literal the server sent it as, and printSchema prints that
      // literal back. Nothing reconstructs a literal from a coerced value any more, so a custom
      // scalar with an object default — platformOS ships one,
      // UpdateFormConfigurationInputType.configuration: HashObject = {} — no longer costs the
      // WHOLE schema its validation and autocompletion. Under graphql 15 it did, and this call
      // was wrapped in a pass that cleared those defaults; don't reintroduce it.
      setSchema(buildClientSchema(cleanSchema(result.data)));
    });
  }, []);

  const [schema, setSchema] = useState(null);
  // Read once, on mount: GraphiQL 5 dropped the controlled `query` prop, so the editor owns the
  // text from here on and `onEditQuery` is what keeps our localStorage copy current. Passing a
  // value back in on every keystroke — what the old `query` state did — is exactly what the
  // prop removal was meant to stop.
  const [initialQuery] = useState(() => localStorage.getItem("query") || DEFAULT_QUERY);
  return (
    <div className="graphiql-container">
      <GraphiQL
        fetcher={fetcher}
        plugins={[explorer]}
        schema={schema}
        initialQuery={initialQuery}
        onEditQuery={handleEditQuery}
      >
        {/* Blanks out GraphiQL's own wordmark — the status bar above already says which
            instance this is pointed at. A slot child, since GraphiQL 5 reads its logo from
            children rather than from a `GraphiQL.Logo` assignment. */}
        <GraphiQL.Logo><span></span></GraphiQL.Logo>
      </GraphiQL>
    </div>
  );
}


fetch("/info")
  .then(response => response.json())
  .then(printConnectionInfo)
  .catch(console.error);

const root = createRoot(document.getElementById("graphiql"));
root.render(<App />);

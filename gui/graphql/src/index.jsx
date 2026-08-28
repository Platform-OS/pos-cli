// Must come first: it assigns MonacoEnvironment, which Monaco reads while graphiql is being
// imported below. See setup-workers.js.
import './setup-workers.js';

import { explorerPlugin } from '@graphiql/plugin-explorer';
import '@graphiql/plugin-explorer/style.css';
import { GraphiQL } from "graphiql";
import "graphiql/style.css";
import { astFromValue, buildClientSchema, getIntrospectionQuery } from "graphql";
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

// GraphiQL 5 hands the schema to the Monaco GraphQL worker as SDL, so every input default has to
// survive printSchema(). A custom scalar with an object default has no literal astFromValue can
// build — platformOS ships one, UpdateFormConfigurationInputType.configuration: HashObject = {} —
// and printSchema throws on the first one it meets, which costs the WHOLE schema its validation
// and autocompletion. Clearing just those defaults gives up nothing that SDL could have expressed
// anyway. Done by trying the conversion rather than by matching type names, so a new offending
// field in a later schema is handled without a change here.
const dropUnprintableDefaults = schema => {
  for (const type of Object.values(schema.getTypeMap())) {
    if (typeof type.getFields !== 'function') continue;
    for (const field of Object.values(type.getFields())) {
      // Object/interface fields carry their input values in `args`; input object fields are
      // input values themselves.
      for (const input of field.args ?? [field]) {
        if (input.defaultValue === undefined) continue;
        try {
          astFromValue(input.defaultValue, input.type);
        } catch {
          // undefined, not null: null is a legitimate default and prints as `= null`.
          input.defaultValue = undefined;
        }
      }
    }
  }

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
      setSchema(dropUnprintableDefaults(buildClientSchema(cleanSchema(result.data))));
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

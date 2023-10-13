import { explorerPlugin } from '@graphiql/plugin-explorer';
import '@graphiql/plugin-explorer/dist/style.css';
import GraphiQL from "graphiql";
import "graphiql/graphiql.css";
import { buildClientSchema, getIntrospectionQuery } from "graphql";
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


const cleanSchema = schema => {
  const types = schema.__schema.types.map(type => {
    if (type.fields) {
      type.fields = type.fields.filter(field => !field.isDeprecated);
    }
    return type;
  });

  return { ...schema, types };
};

function App() {
  const getInitialQuery = () => {
    return localStorage.getItem("query") || DEFAULT_QUERY;
  };

  const handleEditQuery = query => {
    setQuery(query);
    localStorage.setItem("query", query);
  };

  useEffect(() => {
    fetcher({
      query: getIntrospectionQuery()
    }).then(result => {
      setSchema(buildClientSchema(cleanSchema(result.data)));
    });
  }, []);

  const [schema, setSchema] = useState(null);
  const [query, setQuery] = useState(getInitialQuery());
  const Logo = () =>  <span></span>;
  GraphiQL.Logo = Logo;
  const explorer = explorerPlugin();
  return (
    <div className="graphiql-container">
      <GraphiQL
        fetcher={fetcher}
        plugins={[explorer]}
        schema={schema}
        query={query}
        onEditQuery={handleEditQuery}
      />
    </div>
  );
}


fetch("/info")
  .then(response => response.json())
  .then(printConnectionInfo)
  .catch(console.error);

const root = createRoot(document.getElementById("graphiql"));
root.render(<App />);

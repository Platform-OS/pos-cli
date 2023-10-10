import { explorerPlugin } from '@graphiql/plugin-explorer';
import GraphiQL from "graphiql";
import { buildClientSchema, getIntrospectionQuery } from "graphql";
import { useEffect, useState } from "react";
import { createRoot } from 'react-dom/client';
import '@graphiql/plugin-explorer/dist/style.css';
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


// const cleanSchema = schema => {
//   debugger;
//   const types = schema.__schema.types.map(type => {
//     if (type.fields) {
//       type.fields = type.fields.filter(field => !field.isDeprecated);
//     }

//     return type;
//   });

//   return { ...schema, types };
// };

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
      setSchema(buildClientSchema(result.data));
      // this.setState({ cleanSchema: buildClientSchema(cleanSchema(result.data)) });
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
        schema={schema} // we might want to use cleanSchema() to not show deprecated parts
        query={query}
        onEditQuery={handleEditQuery}
      />
    </div>
  );
}

const root = createRoot(document.getElementById("graphiql"));
root.render(<App />);

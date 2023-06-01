import{g as s}from"./graphql.b64cf78b.js";const m={get:e=>{const t=`
			query {
				admin_model_schemas(
					per_page: 100
					${e?`filter: { id: { value: ${e} } }`:""}
				) {
					results {
						id
						name
						properties {
							name
							attribute_type
						}
					}
				}
			}`;return s({query:t}).then(r=>r.admin_model_schemas.results)}};export{m as t};

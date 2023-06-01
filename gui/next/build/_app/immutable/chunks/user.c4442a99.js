import{g}from"./graphql.b64cf78b.js";const r={get:e=>{e=Object.fromEntries(e.entries());let a="";e.attribute&&e.value&&(a+=`${e.attribute}: { value: "${e.value}" }`);let t="";(e==null?void 0:e.attribute)==="id"&&(e!=null&&e.value)&&(t=`
				deleted_at
				created_at
				external_id
				jwt_token
				temporary_token
				name
				first_name
				middle_name
				last_name
				slug
				language
			`);const u=`
			query {
				users(
					page: ${(e==null?void 0:e.page)??1}
					per_page: 50
					sort: { id: { order: ASC } }
					filter: {
						${a}
					}
				) {
					current_page
					total_pages
					results {
						id
						email
						${t}
					}
				}
			}`;return g({query:u}).then(n=>n.users)}};export{r as u};

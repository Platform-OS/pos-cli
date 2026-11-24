import{n as e,r as t}from"./9O3AIQt7.js";import{t as n}from"./B_bKnyWZ.js";var r={get:async(e={},n)=>{let r=e.attribute===`id`?`id`:`email`,i=parseInt(e.page)>0?parseInt(e.page):1,a=e.value?JSON.stringify(String(e.value)):``,o=``,s=``;a&&(o+=r===`email`?`email: { contains: ${a} }`:`id: { value: ${a} }`,r===`id`&&(s=`
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
        `));let c=`
      query {
        users(
          page: ${i}
          per_page: 50
          sort: { id: { order: DESC } }
          filter: {
            ${o}
          }
        ) {
          current_page
          total_pages
          results {
            id
            email
            ${s}
            properties
          }
        }
      }`;return t({query:c},n).then(e=>e.users)},delete:async t=>{let n=`
      mutation {
        user_delete(id: ${JSON.stringify(String(t))}){ id }
      }
    `;return e({query:n},!1)},create:async(t,r,i)=>{let a=n(i),o=`
      mutation${a.variablesDefinition} {
        user: user_create(user: { email: ${JSON.stringify(String(t))}, password: ${JSON.stringify(String(r))}, properties: [${a.properties}] }) {
          id
        }
      }
    `;return e({query:o,variables:a.variables},!1)},edit:async(t,r,i)=>{let a=n(i),o=`
      mutation${a.variablesDefinition} {
        user_update(user: { email: ${JSON.stringify(String(r))}, properties: [${a.properties}] }, id: ${JSON.stringify(String(t))}) {
          id
        }
      }
    `;return e({query:o,variables:a.variables},!1)},getCustomProperties:async()=>t({query:`
      query {
        admin_user_schema {
          properties {
            attribute_type
            name
          }
        }
      }
    `},!1).then(e=>e.admin_user_schema.properties)};export{r as t};
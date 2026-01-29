import{g as n}from"./BD1m7lx9.js";import{b as s}from"./BkeFH9yg.js";const p={get:async(e={})=>{let r="",a="";e.value&&(e.attribute==="email"?r+=`${e.attribute}: { contains: "${e.value}" }`:r+=`${e.attribute}: { value: "${e.value}" }`,(e==null?void 0:e.attribute)==="id"&&(e!=null&&e.value)&&(a=`
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
        `));const t=`
      query {
        users(
          page: ${(e==null?void 0:e.page)??1}
          per_page: 50
          sort: { id: { order: DESC } }
          filter: {
            ${r}
          }
        ) {
          current_page
          total_pages
          results {
            id
            email
            ${a}
            properties
          }
        }
      }`;return n({query:t}).then(u=>u.users)},delete:async e=>{const r=`
      mutation {
        user_delete(id: ${e}){ id }
      }
    `;return n({query:r})},create:async(e,r,a)=>{const t=s(a),u=`
      mutation${t.variablesDefinition} {
        user: user_create(user: { email: "${e}", password: "${r}", properties: [${t.properties}] }) {
          id
        }
      }
    `;return n({query:u,variables:t.variables})},edit:async(e,r,a)=>{const t=s(a),u=`
      mutation${t.variablesDefinition} {
        user_update(user: { email: "${r}",  properties: [${t.properties}] }, id: ${e}) {
          id
        }
      }
    `;return n({query:u,variables:t.variables})},getCustomProperties:async()=>n({query:`
      query {
        admin_user_schema {
          properties {
            attribute_type
            name
          }
        }
      }
    `}).then(r=>r.admin_user_schema.properties)};export{p as u};

const t={get:async(r={})=>{const o="http://localhost:3333/api/logsv2";return r.from=r.from??0,r.size=r.size??10,r.stream_name=r.stream_name??"logs",r=new URLSearchParams(r).toString(),fetch(`${o}?${r}`).then(n=>n.ok?n.json():Promise.reject(n)).then(n=>n).catch(n=>({error:n}))}};export{t as l};
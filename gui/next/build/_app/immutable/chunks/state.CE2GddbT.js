import{w as g}from"./index.D3RYe3Rk.js";const p=b();function b(){const r=localStorage.view?JSON.parse(localStorage.view):null,e={};e.header=localStorage.header?JSON.parse(localStorage.header):["database","users","logs"],e.online=void 0,e.logs={},e.logsv2={},e.logv2={},e.networks={},e.network={},e.tables=[],e.table={},e.view={database:r!=null&&r.database?r.database:"table",tableStyle:r!=null&&r.tableStyle?r.tableStyle:"collapsed"},e.records={},e.record=null,e.highlighted={record:null,constant:null},e.filters={page:1,attributes:[{attribute_type:"id",name:"id",operation:"value",value:""}],deleted:"false"},e.sort={by:"created_at",order:"DESC"},e.notifications=[],e.asideWidth=localStorage.asideWidth?localStorage.asideWidth:!1;const{subscribe:s,set:d,update:i}=g(e),c=(a,t)=>{i(o=>(o[a]=t,o))},u=()=>{i(a=>(a.filters={page:1,attributes:[{attribute_type:"id",name:"id",operation:"value",value:""}],deleted:"false"},a.sort={by:"created_at",order:"DESC"},a))};let n;const l=(a,t)=>{i(o=>(o.highlighted[a]=t,o)),clearTimeout(n),n=setTimeout(()=>{l("record",null),l("constant",null)},7e3)};return{subscribe:s,set:d,data:c,clearFilters:u,highlight:l,notification:{create:(a,t)=>{i(o=>(o.notifications.push({id:Date.now(),type:a,message:t}),o))},remove:a=>{i(t=>(t.notifications=t.notifications.filter(o=>o.id!==a),t))}},setView:a=>{i(t=>(t.view={...t.view,...a},localStorage.view=JSON.stringify(t.view),t))}}}export{p as s};
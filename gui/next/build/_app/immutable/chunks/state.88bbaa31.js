import{w as g}from"./index.95c2a168.js";const f=b();function b(){const o=localStorage.view?JSON.parse(localStorage.view):null,e={};e.header=localStorage.header?JSON.parse(localStorage.header):["database","users","logs"],e.online=void 0,e.logs={},e.logsv2={},e.logv2={},e.tables=[],e.table={},e.view={database:o!=null&&o.database?o.database:"table",tableStyle:o!=null&&o.tableStyle?o.tableStyle:"collapsed"},e.records={},e.record=null,e.highlighted={record:null,constant:null},e.filters={page:1,attributes:[{attribute_type:"id",name:"id",operation:"value",value:""}]},e.sort={by:"created_at",order:"DESC"},e.notifications=[],e.asideWidth=localStorage.asideWidth?localStorage.asideWidth:"30%";const{subscribe:s,set:c,update:r}=g(e),d=(a,t)=>{r(i=>(i[a]=t,i))},u=()=>{r(a=>(a.filters={page:1,attributes:[{attribute_type:"id",name:"id",operation:"value",value:""}]},a.sort={by:"created_at",order:"DESC"},a))};let n;const l=(a,t)=>{r(i=>(i.highlighted[a]=t,i)),clearTimeout(n),n=setTimeout(()=>{l("record",null),l("constant",null)},7e3)};return{subscribe:s,set:c,data:d,clearFilters:u,highlight:l,notification:{create:(a,t)=>{r(i=>(i.notifications.push({id:Date.now(),type:a,message:t}),i))},remove:a=>{r(t=>(t.notifications=t.notifications.filter(i=>i.id!==a),t))}},setView:a=>{r(t=>(t.view={...t.view,...a},localStorage.view=JSON.stringify(t.view),t))}}}export{f as s};
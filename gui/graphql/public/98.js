"use strict";(self.webpackChunk_platformos_gui=self.webpackChunk_platformos_gui||[]).push([[98,480],{7480:(g,l,t)=>{t.r(l),t.d(l,{C:()=>a,c:()=>s});var c=t(5421),r=Object.defineProperty,d=(e,n)=>r(e,"name",{value:n,configurable:!0});function i(e,n){for(var _=0;_<n.length;_++){const u=n[_];if(typeof u!="string"&&!Array.isArray(u)){for(const f in u)if(f!=="default"&&!(f in e)){const v=Object.getOwnPropertyDescriptor(u,f);v&&Object.defineProperty(e,f,v.get?v:{enumerable:!0,get:()=>u[f]})}}}return Object.freeze(Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}))}d(i,"_mergeNamespaces");var o=(0,c.r)();const a=(0,c.g)(o),s=i({__proto__:null,default:a},[o])},8009:(g,l,t)=>{t.d(l,{i:()=>d});var c=Object.defineProperty,r=(i,o)=>c(i,"name",{value:o,configurable:!0});function d(i,o){var a,s;const{levels:e,indentLevel:n}=i;return((!e||e.length===0?n:e.at(-1)-(!((a=this.electricInput)===null||a===void 0)&&a.test(o)?1:0))||0)*(((s=this.config)===null||s===void 0?void 0:s.indentUnit)||0)}r(d,"indent")},2098:(g,l,t)=>{t.r(l);var c=t(7480),r=t(5798),d=t(8009),i=t(5421),o=Object.defineProperty,a=(e,n)=>o(e,"name",{value:n,configurable:!0});const s=a(e=>{const n=(0,r.Xs)({eatWhitespace:_=>_.eatWhile(r.WU),lexRules:r.nW,parseRules:r.kh,editorConfig:{tabSize:e.tabSize}});return{config:e,startState:n.startState,token:n.token,indent:d.i,electricInput:/^\s*[})\]]/,fold:"brace",lineComment:"#",closeBrackets:{pairs:'()[]{}""',explode:"()[]{}"}}},"graphqlModeFactory");c.C.defineMode("graphql",s)}}]);

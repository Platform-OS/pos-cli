import{s as le,e as v,a as N,c as k,b as I,g as K,A as F,f as g,y as b,i as j,h as p,B as X,C as U,F as ie,r as ce,k as Y,E as fe,O as ue,W as ae,t as de,d as he,G as O,j as _e,I as me,n as G,z as Z,l as pe,u as be,m as ge,o as ve}from"../chunks/scheduler.ts1nwYMk.js";import{S as ne,i as re,g as ke,a as V,e as Ee,t as C,j as ye,c as M,d as R,m as W,f as J}from"../chunks/index.MbwxngTa.js";import{e as x}from"../chunks/each.CLm8ZDgo.js";import{f as Se}from"../chunks/index.CqFcJeJT.js";import{p as Ie}from"../chunks/stores.D3n-8z5b.js";import{s as ee}from"../chunks/state.HIdUDD3F.js";import{t as we}from"../chunks/table.Cmn0kCDk.js";import{I as oe}from"../chunks/Icon.Dn_EaQMz.js";function te(i,e,t){const r=i.slice();return r[15]=e[t],r[17]=t,r}function Ce(i){let e,t,r;return t=new oe({props:{icon:"search",size:"18"}}),{c(){e=v("i"),M(t.$$.fragment),this.h()},l(o){e=k(o,"I",{class:!0});var l=I(e);R(t.$$.fragment,l),l.forEach(g),this.h()},h(){b(e,"class","svelte-117f3bg")},m(o,l){j(o,e,l),W(t,e,null),r=!0},p:G,i(o){r||(C(t.$$.fragment,o),r=!0)},o(o){V(t.$$.fragment,o),r=!1},d(o){o&&g(e),J(t)}}}function De(i){let e,t,r="Reset filter",o,l,d,s,a;return l=new oe({props:{icon:"x",size:"18"}}),{c(){e=v("button"),t=v("span"),t.textContent=r,o=N(),M(l.$$.fragment),this.h()},l(n){e=k(n,"BUTTON",{class:!0});var m=I(e);t=k(m,"SPAN",{class:!0,"data-svelte-h":!0}),F(t)!=="svelte-8g7ehw"&&(t.textContent=r),o=K(m),R(l.$$.fragment,m),m.forEach(g),this.h()},h(){b(t,"class","label"),b(e,"class","svelte-117f3bg")},m(n,m){j(n,e,m),p(e,t),p(e,o),W(l,e,null),d=!0,s||(a=U(e,"click",i[8]),s=!0)},p:G,i(n){d||(C(l.$$.fragment,n),d=!0)},o(n){V(l.$$.fragment,n),d=!1},d(n){n&&g(e),J(l),s=!1,a()}}}function se(i){let e,t,r=i[15].name+"",o,l,d,s;return{c(){e=v("li"),t=v("a"),o=de(r),d=N(),this.h()},l(a){e=k(a,"LI",{});var n=I(e);t=k(n,"A",{href:!0,class:!0});var m=I(t);o=he(m,r),m.forEach(g),d=K(n),n.forEach(g),this.h()},h(){b(t,"href",l="/database/table/"+i[15].id),b(t,"class","svelte-117f3bg"),O(t,"active",i[15].id===i[4].params.id)},m(a,n){j(a,e,n),p(e,t),p(t,o),p(e,d)},p(a,n){n&1&&r!==(r=a[15].name+"")&&_e(o,r),n&1&&l!==(l="/database/table/"+a[15].id)&&b(t,"href",l),n&17&&O(t,"active",a[15].id===a[4].params.id)},i(a){a&&(s||me(()=>{s=ye(e,Se,{duration:100,delay:7*i[17]}),s.start()}))},o:G,d(a){a&&g(e)}}}function $e(i){let e,t,r,o,l,d,s,a,n,m="Ctrl",y,z="K",L,D,$,A,T,c;const B=[De,Ce],S=[];function H(f,_){return f[3]?0:1}o=H(i),l=S[o]=B[o](i);let w=x(i[0]),h=[];for(let f=0;f<w.length;f+=1)h[f]=se(te(i,w,f));return{c(){e=v("aside"),t=v("div"),r=v("div"),l.c(),d=N(),s=v("input"),a=N(),n=v("kbd"),n.textContent=m,y=v("kbd"),y.textContent=z,L=N(),D=v("nav"),$=v("ul");for(let f=0;f<h.length;f+=1)h[f].c();this.h()},l(f){e=k(f,"ASIDE",{class:!0});var _=I(e);t=k(_,"DIV",{class:!0});var E=I(t);r=k(E,"DIV",{class:!0});var u=I(r);l.l(u),d=K(u),s=k(u,"INPUT",{type:!0,placeholder:!0,class:!0}),a=K(u),n=k(u,"KBD",{class:!0,"data-svelte-h":!0}),F(n)!=="svelte-1c7qffr"&&(n.textContent=m),y=k(u,"KBD",{class:!0,"data-svelte-h":!0}),F(y)!=="svelte-3k5xuj"&&(y.textContent=z),u.forEach(g),E.forEach(g),L=K(_),D=k(_,"NAV",{class:!0});var q=I(D);$=k(q,"UL",{});var Q=I($);for(let P=0;P<h.length;P+=1)h[P].l(Q);Q.forEach(g),q.forEach(g),_.forEach(g),this.h()},h(){b(s,"type","text"),b(s,"placeholder","Search tables"),b(s,"class","svelte-117f3bg"),b(n,"class","svelte-117f3bg"),b(y,"class","svelte-117f3bg"),b(r,"class","filter svelte-117f3bg"),b(t,"class","filter-container svelte-117f3bg"),b(D,"class","svelte-117f3bg"),b(e,"class","svelte-117f3bg")},m(f,_){j(f,e,_),p(e,t),p(t,r),S[o].m(r,null),p(r,d),p(r,s),i[9](s),X(s,i[3]),p(r,a),p(r,n),p(r,y),p(e,L),p(e,D),p(D,$);for(let E=0;E<h.length;E+=1)h[E]&&h[E].m($,null);i[11](e),A=!0,T||(c=[U(s,"input",i[10]),U(s,"input",i[5]),U(s,"keydown",i[6]),U(e,"keydown",i[7])],T=!0)},p(f,[_]){let E=o;if(o=H(f),o===E?S[o].p(f,_):(ke(),V(S[E],1,1,()=>{S[E]=null}),Ee(),l=S[o],l?l.p(f,_):(l=S[o]=B[o](f),l.c()),C(l,1),l.m(r,d)),_&8&&s.value!==f[3]&&X(s,f[3]),_&17){w=x(f[0]);let u;for(u=0;u<w.length;u+=1){const q=te(f,w,u);h[u]?(h[u].p(q,_),C(h[u],1)):(h[u]=se(q),h[u].c(),C(h[u],1),h[u].m($,null))}for(;u<h.length;u+=1)h[u].d(1);h.length=w.length}},i(f){if(!A){C(l);for(let _=0;_<w.length;_+=1)C(h[_]);A=!0}},o(f){V(l),A=!1},d(f){f&&g(e),S[o].d(),i[9](null),ie(h,f),i[11](null),T=!1,ce(c)}}}function qe(i,e,t){let r,o;Y(i,Ie,c=>t(4,r=c)),Y(i,ee,c=>t(13,o=c));let l=o.tables,d=l,s,a,n;(async()=>await we.get())().then(c=>{l=c,t(0,d=c),fe(ee,o.tables=c,o)});const m=ue();ae(async()=>{a.focus(),document.addEventListener("keydown",c=>{c.ctrlKey&&c.key==="k"&&(c.preventDefault(),m("sidebarNeeded"),a.focus(),a.select())}),r.data.table&&s.querySelector(`[href$="${r.data.table.id}"]`).scrollIntoView({behavior:"smooth",block:"center"})});const y=()=>{n?t(0,d=l.filter(c=>c.name.includes(n))):t(0,d=l)},z=c=>{c.key==="Escape"&&(t(3,n=""),y()),c.key==="Enter"&&s.querySelector("li:first-child a").click()},L=c=>{var B,S,H,w,h,f,_,E,u,q;c.key==="ArrowDown"&&s.contains(document.activeElement)&&(c.preventDefault(),document.activeElement.matches("input")?(B=s.querySelector("a"))==null||B.focus():(h=(w=(H=(S=document.activeElement)==null?void 0:S.parentElement)==null?void 0:H.nextElementSibling)==null?void 0:w.querySelector("a"))==null||h.focus()),c.key==="ArrowUp"&&s.contains(document.activeElement)&&(c.preventDefault(),(f=document.activeElement)!=null&&f.matches("li:first-child a")?a.focus():(q=(u=(E=(_=document.activeElement)==null?void 0:_.parentElement)==null?void 0:E.previousElementSibling)==null?void 0:u.querySelector("a"))==null||q.focus()),c.key==="Escape"&&s.contains(document.activeElement)&&(a.focus(),t(3,n=""),y())},D=()=>{t(3,n=null),y()};function $(c){Z[c?"unshift":"push"](()=>{a=c,t(2,a)})}function A(){n=this.value,t(3,n)}function T(c){Z[c?"unshift":"push"](()=>{s=c,t(1,s)})}return[d,s,a,n,r,y,z,L,D,$,A,T]}class Ae extends ne{constructor(e){super(),re(this,e,qe,$e,le,{})}}function Ne(i){let e,t,r,o,l;r=new Ae({}),r.$on("sidebarNeeded",i[3]);const d=i[2].default,s=pe(d,i,i[1],null);return{c(){e=v("div"),t=v("div"),M(r.$$.fragment),o=N(),s&&s.c(),this.h()},l(a){e=k(a,"DIV",{class:!0});var n=I(e);t=k(n,"DIV",{class:!0});var m=I(t);R(r.$$.fragment,m),m.forEach(g),o=K(n),s&&s.l(n),n.forEach(g),this.h()},h(){b(t,"class","tables-container svelte-s8xmdg"),b(e,"class","container svelte-s8xmdg"),O(e,"tablesHidden",i[0])},m(a,n){j(a,e,n),p(e,t),W(r,t,null),p(e,o),s&&s.m(e,null),l=!0},p(a,[n]){s&&s.p&&(!l||n&2)&&be(s,d,a,a[1],l?ve(d,a[1],n,null):ge(a[1]),null),(!l||n&1)&&O(e,"tablesHidden",a[0])},i(a){l||(C(r.$$.fragment,a),C(s,a),l=!0)},o(a){V(r.$$.fragment,a),V(s,a),l=!1},d(a){a&&g(e),J(r),s&&s.d(a)}}}function Ke(i,e,t){let{$$slots:r={},$$scope:o}=e,l=!1;ae(()=>{document.addEventListener("keydown",s=>{!s.target.matches("input, textarea")&&s.key==="b"&&(t(0,l=!l),localStorage.tablesHidden=l)})});const d=()=>t(0,l=!1);return i.$$set=s=>{"$$scope"in s&&t(1,o=s.$$scope)},[l,o,r,d]}class Oe extends ne{constructor(e){super(),re(this,e,Ke,Ne,le,{})}}export{Oe as component};
import{s as le,f as v,a as q,g as k,h as S,c as A,r as P,d as g,j as b,i as B,v as p,K as X,x as T,N as ie,y as ce,w as Y,A as fe,H as ue,o as ae,l as de,m as he,u as j,n as _e,B as me,z as F,p as Z,D as pe,E as be,F as ge,G as ve}from"../chunks/scheduler.C43H4T0F.js";import{S as ne,i as re,g as ke,t as K,c as Ee,a as w,j as ye,b as G,d as M,m as O,e as R}from"../chunks/index.JUyE3YTa.js";import{e as x}from"../chunks/each.7MJCLYVi.js";import{f as Se}from"../chunks/index.FXPeImVA.js";import{p as we}from"../chunks/stores.IMPXto9g.js";import{s as ee}from"../chunks/state.FTiieUpz.js";import{t as De}from"../chunks/table.2qc5Sp1a.js";import{I as oe}from"../chunks/Icon.HnzAYZiZ.js";function te(i,e,t){const r=i.slice();return r[15]=e[t],r[17]=t,r}function Ie(i){let e,t,r;return t=new oe({props:{icon:"search",size:"18"}}),{c(){e=v("i"),G(t.$$.fragment),this.h()},l(o){e=k(o,"I",{class:!0});var l=S(e);M(t.$$.fragment,l),l.forEach(g),this.h()},h(){b(e,"class","svelte-117f3bg")},m(o,l){B(o,e,l),O(t,e,null),r=!0},p:F,i(o){r||(w(t.$$.fragment,o),r=!0)},o(o){K(t.$$.fragment,o),r=!1},d(o){o&&g(e),R(t)}}}function Ce(i){let e,t,r="Reset filter",o,l,u,s,a;return l=new oe({props:{icon:"x",size:"18"}}),{c(){e=v("button"),t=v("span"),t.textContent=r,o=q(),G(l.$$.fragment),this.h()},l(n){e=k(n,"BUTTON",{class:!0});var _=S(e);t=k(_,"SPAN",{class:!0,"data-svelte-h":!0}),P(t)!=="svelte-8g7ehw"&&(t.textContent=r),o=A(_),M(l.$$.fragment,_),_.forEach(g),this.h()},h(){b(t,"class","label"),b(e,"class","svelte-117f3bg")},m(n,_){B(n,e,_),p(e,t),p(e,o),O(l,e,null),u=!0,s||(a=T(e,"click",i[8]),s=!0)},p:F,i(n){u||(w(l.$$.fragment,n),u=!0)},o(n){K(l.$$.fragment,n),u=!1},d(n){n&&g(e),R(l),s=!1,a()}}}function se(i){let e,t,r=i[15].name+"",o,l,u,s;return{c(){e=v("li"),t=v("a"),o=de(r),u=q(),this.h()},l(a){e=k(a,"LI",{});var n=S(e);t=k(n,"A",{href:!0,class:!0});var _=S(t);o=he(_,r),_.forEach(g),u=A(n),n.forEach(g),this.h()},h(){b(t,"href",l="/database/table/"+i[15].id),b(t,"class","svelte-117f3bg"),j(t,"active",i[15].id===i[4].params.id)},m(a,n){B(a,e,n),p(e,t),p(t,o),p(e,u)},p(a,n){n&1&&r!==(r=a[15].name+"")&&_e(o,r),n&1&&l!==(l="/database/table/"+a[15].id)&&b(t,"href",l),n&17&&j(t,"active",a[15].id===a[4].params.id)},i(a){a&&(s||me(()=>{s=ye(e,Se,{duration:100,delay:7*i[17]}),s.start()}))},o:F,d(a){a&&g(e)}}}function $e(i){let e,t,r,o,l,u,s,a,n,_="Ctrl",E,U="K",V,D,I,N,H,c;const J=[Ce,Ie],C=[];function Q(f,m){return f[3]?0:1}o=Q(i),l=C[o]=J[o](i);let $=x(i[0]),h=[];for(let f=0;f<$.length;f+=1)h[f]=se(te(i,$,f));return{c(){e=v("aside"),t=v("div"),r=v("div"),l.c(),u=q(),s=v("input"),a=q(),n=v("kbd"),n.textContent=_,E=v("kbd"),E.textContent=U,V=q(),D=v("nav"),I=v("ul");for(let f=0;f<h.length;f+=1)h[f].c();this.h()},l(f){e=k(f,"ASIDE",{class:!0});var m=S(e);t=k(m,"DIV",{class:!0});var y=S(t);r=k(y,"DIV",{class:!0});var d=S(r);l.l(d),u=A(d),s=k(d,"INPUT",{type:!0,placeholder:!0,class:!0}),a=A(d),n=k(d,"KBD",{class:!0,"data-svelte-h":!0}),P(n)!=="svelte-1c7qffr"&&(n.textContent=_),E=k(d,"KBD",{class:!0,"data-svelte-h":!0}),P(E)!=="svelte-3k5xuj"&&(E.textContent=U),d.forEach(g),y.forEach(g),V=A(m),D=k(m,"NAV",{class:!0});var L=S(D);I=k(L,"UL",{});var W=S(I);for(let z=0;z<h.length;z+=1)h[z].l(W);W.forEach(g),L.forEach(g),m.forEach(g),this.h()},h(){b(s,"type","text"),b(s,"placeholder","Search tables"),b(s,"class","svelte-117f3bg"),b(n,"class","svelte-117f3bg"),b(E,"class","svelte-117f3bg"),b(r,"class","filter svelte-117f3bg"),b(t,"class","filter-container svelte-117f3bg"),b(D,"class","svelte-117f3bg"),b(e,"class","svelte-117f3bg")},m(f,m){B(f,e,m),p(e,t),p(t,r),C[o].m(r,null),p(r,u),p(r,s),i[9](s),X(s,i[3]),p(r,a),p(r,n),p(r,E),p(e,V),p(e,D),p(D,I);for(let y=0;y<h.length;y+=1)h[y]&&h[y].m(I,null);i[11](e),N=!0,H||(c=[T(s,"input",i[10]),T(s,"input",i[5]),T(s,"keydown",i[6]),T(e,"keydown",i[7])],H=!0)},p(f,[m]){let y=o;if(o=Q(f),o===y?C[o].p(f,m):(ke(),K(C[y],1,1,()=>{C[y]=null}),Ee(),l=C[o],l?l.p(f,m):(l=C[o]=J[o](f),l.c()),w(l,1),l.m(r,u)),m&8&&s.value!==f[3]&&X(s,f[3]),m&17){$=x(f[0]);let d;for(d=0;d<$.length;d+=1){const L=te(f,$,d);h[d]?(h[d].p(L,m),w(h[d],1)):(h[d]=se(L),h[d].c(),w(h[d],1),h[d].m(I,null))}for(;d<h.length;d+=1)h[d].d(1);h.length=$.length}},i(f){if(!N){w(l);for(let m=0;m<$.length;m+=1)w(h[m]);N=!0}},o(f){K(l),N=!1},d(f){f&&g(e),C[o].d(),i[9](null),ie(h,f),i[11](null),H=!1,ce(c)}}}function Ne(i,e,t){let r,o;Y(i,we,c=>t(4,r=c)),Y(i,ee,c=>t(13,o=c));let l=o.tables,u=l,s,a,n;(async()=>await De.get())().then(c=>{l=c,t(0,u=c),fe(ee,o.tables=c,o)});const _=ue();ae(async()=>{a.focus(),document.addEventListener("keydown",c=>{c.ctrlKey&&c.key==="k"&&(c.preventDefault(),_("sidebarNeeded"),a.focus(),a.select())}),r.data.table&&s.querySelector(`[href$="${r.data.table.id}"]`).scrollIntoView({behavior:"smooth",block:"center"})});const E=()=>{n?t(0,u=l.filter(c=>c.name.includes(n))):t(0,u=l)},U=c=>{c.key==="Escape"&&(t(3,n=""),E()),c.key==="Enter"&&s.querySelector("li:first-child a").click()},V=c=>{c.key==="ArrowDown"&&s.contains(document.activeElement)&&(c.preventDefault(),document.activeElement.matches("input")?s.querySelector("a")?.focus():document.activeElement?.parentElement?.nextElementSibling?.querySelector("a")?.focus()),c.key==="ArrowUp"&&s.contains(document.activeElement)&&(c.preventDefault(),document.activeElement?.matches("li:first-child a")?a.focus():document.activeElement?.parentElement?.previousElementSibling?.querySelector("a")?.focus()),c.key==="Escape"&&s.contains(document.activeElement)&&(a.focus(),t(3,n=""),E())},D=()=>{t(3,n=null),E()};function I(c){Z[c?"unshift":"push"](()=>{a=c,t(2,a)})}function N(){n=this.value,t(3,n)}function H(c){Z[c?"unshift":"push"](()=>{s=c,t(1,s)})}return[u,s,a,n,r,E,U,V,D,I,N,H]}class qe extends ne{constructor(e){super(),re(this,e,Ne,$e,le,{})}}function Ae(i){let e,t,r,o,l;r=new qe({}),r.$on("sidebarNeeded",i[3]);const u=i[2].default,s=pe(u,i,i[1],null);return{c(){e=v("div"),t=v("div"),G(r.$$.fragment),o=q(),s&&s.c(),this.h()},l(a){e=k(a,"DIV",{class:!0});var n=S(e);t=k(n,"DIV",{class:!0});var _=S(t);M(r.$$.fragment,_),_.forEach(g),o=A(n),s&&s.l(n),n.forEach(g),this.h()},h(){b(t,"class","tables-container svelte-s8xmdg"),b(e,"class","container svelte-s8xmdg"),j(e,"tablesHidden",i[0])},m(a,n){B(a,e,n),p(e,t),O(r,t,null),p(e,o),s&&s.m(e,null),l=!0},p(a,[n]){s&&s.p&&(!l||n&2)&&be(s,u,a,a[1],l?ve(u,a[1],n,null):ge(a[1]),null),(!l||n&1)&&j(e,"tablesHidden",a[0])},i(a){l||(w(r.$$.fragment,a),w(s,a),l=!0)},o(a){K(r.$$.fragment,a),K(s,a),l=!1},d(a){a&&g(e),R(r),s&&s.d(a)}}}function Ke(i,e,t){let{$$slots:r={},$$scope:o}=e,l=!1;ae(()=>{document.addEventListener("keydown",s=>{!s.target.matches("input, textarea")&&s.key==="b"&&(t(0,l=!l),localStorage.tablesHidden=l)})});const u=()=>t(0,l=!1);return i.$$set=s=>{"$$scope"in s&&t(1,o=s.$$scope)},[l,o,r,u]}class Pe extends ne{constructor(e){super(),re(this,e,Ke,Ae,le,{})}}export{Pe as component};

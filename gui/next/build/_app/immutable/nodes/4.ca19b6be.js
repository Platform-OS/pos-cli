import{s as le,f as k,a as q,g,h as w,c as A,r as G,d as v,j as b,i as U,u as p,K as X,x as B,N as ie,y as ce,v as Y,z as ue,H as fe,o as ae,l as de,m as _e,w as P,n as he,B as me,A as M,p as Z,D as pe,E as be,F as ve,G as ke}from"../chunks/scheduler.bed694a1.js";import{S as ne,i as re,g as ge,t as K,c as ye,a as I,j as Ee,b as O,d as R,m as J,e as Q}from"../chunks/index.606d5641.js";import{e as x}from"../chunks/each.177d9825.js";import{f as Se}from"../chunks/index.35d92de3.js";import{p as we}from"../chunks/stores.1332f0b7.js";import{s as ee}from"../chunks/state.1edee324.js";import{t as De}from"../chunks/table.6d6102f7.js";import{I as oe}from"../chunks/Icon.62ba3e81.js";function te(i,e,t){const r=i.slice();return r[15]=e[t],r[17]=t,r}function Ie(i){let e,t,r;return t=new oe({props:{icon:"search"}}),{c(){e=k("i"),O(t.$$.fragment),this.h()},l(o){e=g(o,"I",{class:!0});var l=w(e);R(t.$$.fragment,l),l.forEach(v),this.h()},h(){b(e,"class","svelte-i8dz9k")},m(o,l){U(o,e,l),J(t,e,null),r=!0},p:M,i(o){r||(I(t.$$.fragment,o),r=!0)},o(o){K(t.$$.fragment,o),r=!1},d(o){o&&v(e),Q(t)}}}function ze(i){let e,t,r="Reset filter",o,l,d,s,a;return l=new oe({props:{icon:"x"}}),{c(){e=k("button"),t=k("span"),t.textContent=r,o=q(),O(l.$$.fragment),this.h()},l(n){e=g(n,"BUTTON",{class:!0});var m=w(e);t=g(m,"SPAN",{class:!0,"data-svelte-h":!0}),G(t)!=="svelte-8g7ehw"&&(t.textContent=r),o=A(m),R(l.$$.fragment,m),m.forEach(v),this.h()},h(){b(t,"class","label"),b(e,"class","svelte-i8dz9k")},m(n,m){U(n,e,m),p(e,t),p(e,o),J(l,e,null),d=!0,s||(a=B(e,"click",i[8]),s=!0)},p:M,i(n){d||(I(l.$$.fragment,n),d=!0)},o(n){K(l.$$.fragment,n),d=!1},d(n){n&&v(e),Q(l),s=!1,a()}}}function se(i){let e,t,r=i[15].name+"",o,l,d,s;return{c(){e=k("li"),t=k("a"),o=de(r),d=q(),this.h()},l(a){e=g(a,"LI",{});var n=w(e);t=g(n,"A",{href:!0,class:!0});var m=w(t);o=_e(m,r),m.forEach(v),d=A(n),n.forEach(v),this.h()},h(){b(t,"href",l="/database/table/"+i[15].id),b(t,"class","svelte-i8dz9k"),P(t,"active",i[15].id===i[4].params.id)},m(a,n){U(a,e,n),p(e,t),p(t,o),p(e,d)},p(a,n){n&1&&r!==(r=a[15].name+"")&&he(o,r),n&1&&l!==(l="/database/table/"+a[15].id)&&b(t,"href",l),n&17&&P(t,"active",a[15].id===a[4].params.id)},i(a){a&&(s||me(()=>{s=Ee(e,Se,{duration:100,delay:7*i[17]}),s.start()}))},o:M,d(a){a&&v(e)}}}function Ce(i){let e,t,r,o,l,d,s,a,n,m="Ctrl",E,j="K",T,z,C,N,V,c;const H=[ze,Ie],S=[];function L(u,h){return u[3]?0:1}o=L(i),l=S[o]=H[o](i);let D=x(i[0]),_=[];for(let u=0;u<D.length;u+=1)_[u]=se(te(i,D,u));return{c(){e=k("aside"),t=k("div"),r=k("div"),l.c(),d=q(),s=k("input"),a=q(),n=k("kbd"),n.textContent=m,E=k("kbd"),E.textContent=j,T=q(),z=k("nav"),C=k("ul");for(let u=0;u<_.length;u+=1)_[u].c();this.h()},l(u){e=g(u,"ASIDE",{class:!0});var h=w(e);t=g(h,"DIV",{class:!0});var y=w(t);r=g(y,"DIV",{class:!0});var f=w(r);l.l(f),d=A(f),s=g(f,"INPUT",{type:!0,placeholder:!0,class:!0}),a=A(f),n=g(f,"KBD",{class:!0,"data-svelte-h":!0}),G(n)!=="svelte-1c7qffr"&&(n.textContent=m),E=g(f,"KBD",{class:!0,"data-svelte-h":!0}),G(E)!=="svelte-3k5xuj"&&(E.textContent=j),f.forEach(v),y.forEach(v),T=A(h),z=g(h,"NAV",{class:!0});var $=w(z);C=g($,"UL",{});var W=w(C);for(let F=0;F<_.length;F+=1)_[F].l(W);W.forEach(v),$.forEach(v),h.forEach(v),this.h()},h(){b(s,"type","text"),b(s,"placeholder","Search tables"),b(s,"class","svelte-i8dz9k"),b(n,"class","svelte-i8dz9k"),b(E,"class","svelte-i8dz9k"),b(r,"class","filter svelte-i8dz9k"),b(t,"class","filter-container svelte-i8dz9k"),b(z,"class","svelte-i8dz9k"),b(e,"class","svelte-i8dz9k")},m(u,h){U(u,e,h),p(e,t),p(t,r),S[o].m(r,null),p(r,d),p(r,s),i[9](s),X(s,i[3]),p(r,a),p(r,n),p(r,E),p(e,T),p(e,z),p(z,C);for(let y=0;y<_.length;y+=1)_[y]&&_[y].m(C,null);i[11](e),N=!0,V||(c=[B(s,"input",i[10]),B(s,"input",i[5]),B(s,"keydown",i[6]),B(e,"keydown",i[7])],V=!0)},p(u,[h]){let y=o;if(o=L(u),o===y?S[o].p(u,h):(ge(),K(S[y],1,1,()=>{S[y]=null}),ye(),l=S[o],l?l.p(u,h):(l=S[o]=H[o](u),l.c()),I(l,1),l.m(r,d)),h&8&&s.value!==u[3]&&X(s,u[3]),h&17){D=x(u[0]);let f;for(f=0;f<D.length;f+=1){const $=te(u,D,f);_[f]?(_[f].p($,h),I(_[f],1)):(_[f]=se($),_[f].c(),I(_[f],1),_[f].m(C,null))}for(;f<_.length;f+=1)_[f].d(1);_.length=D.length}},i(u){if(!N){I(l);for(let h=0;h<D.length;h+=1)I(_[h]);N=!0}},o(u){K(l),N=!1},d(u){u&&v(e),S[o].d(),i[9](null),ie(_,u),i[11](null),V=!1,ce(c)}}}function $e(i,e,t){let r,o;Y(i,we,c=>t(4,r=c)),Y(i,ee,c=>t(13,o=c));let l=o.tables,d=l,s,a,n;(async()=>await De.get())().then(c=>{l=c,t(0,d=c),ue(ee,o.tables=c,o)});const m=fe();ae(async()=>{a.focus(),document.addEventListener("keydown",c=>{c.ctrlKey&&c.key==="k"&&(c.preventDefault(),m("sidebarNeeded"),a.focus(),a.select())}),r.data.table&&s.querySelector(`[href$="${r.data.table.id}"]`).scrollIntoView({behavior:"smooth",block:"center"})});const E=()=>{n?t(0,d=l.filter(c=>c.name.includes(n))):t(0,d=l)},j=c=>{c.key==="Escape"&&(t(3,n=""),E()),c.key==="Enter"&&s.querySelector("li:first-child a").click()},T=c=>{var H,S,L,D,_,u,h,y,f,$;c.key==="ArrowDown"&&s.contains(document.activeElement)&&(c.preventDefault(),document.activeElement.matches("input")?(H=s.querySelector("a"))==null||H.focus():(_=(D=(L=(S=document.activeElement)==null?void 0:S.parentElement)==null?void 0:L.nextElementSibling)==null?void 0:D.querySelector("a"))==null||_.focus()),c.key==="ArrowUp"&&s.contains(document.activeElement)&&(c.preventDefault(),(u=document.activeElement)!=null&&u.matches("li:first-child a")?a.focus():($=(f=(y=(h=document.activeElement)==null?void 0:h.parentElement)==null?void 0:y.previousElementSibling)==null?void 0:f.querySelector("a"))==null||$.focus()),c.key==="Escape"&&s.contains(document.activeElement)&&(a.focus(),t(3,n=""),E())},z=()=>{t(3,n=null),E()};function C(c){Z[c?"unshift":"push"](()=>{a=c,t(2,a)})}function N(){n=this.value,t(3,n)}function V(c){Z[c?"unshift":"push"](()=>{s=c,t(1,s)})}return[d,s,a,n,r,E,j,T,z,C,N,V]}class Ne extends ne{constructor(e){super(),re(this,e,$e,Ce,le,{})}}function qe(i){let e,t,r,o,l;r=new Ne({}),r.$on("sidebarNeeded",i[3]);const d=i[2].default,s=pe(d,i,i[1],null);return{c(){e=k("div"),t=k("div"),O(r.$$.fragment),o=q(),s&&s.c(),this.h()},l(a){e=g(a,"DIV",{class:!0});var n=w(e);t=g(n,"DIV",{class:!0});var m=w(t);R(r.$$.fragment,m),m.forEach(v),o=A(n),s&&s.l(n),n.forEach(v),this.h()},h(){b(t,"class","tables-container svelte-1hksv5m"),b(e,"class","container svelte-1hksv5m"),P(e,"tablesHidden",i[0])},m(a,n){U(a,e,n),p(e,t),J(r,t,null),p(e,o),s&&s.m(e,null),l=!0},p(a,[n]){s&&s.p&&(!l||n&2)&&be(s,d,a,a[1],l?ke(d,a[1],n,null):ve(a[1]),null),(!l||n&1)&&P(e,"tablesHidden",a[0])},i(a){l||(I(r.$$.fragment,a),I(s,a),l=!0)},o(a){K(r.$$.fragment,a),K(s,a),l=!1},d(a){a&&v(e),Q(r),s&&s.d(a)}}}function Ae(i,e,t){let{$$slots:r={},$$scope:o}=e,l=!1;ae(()=>{document.addEventListener("keydown",s=>{!s.target.matches("input, textarea")&&s.key==="b"&&(t(0,l=!l),localStorage.tablesHidden=l)})});const d=()=>t(0,l=!1);return i.$$set=s=>{"$$scope"in s&&t(1,o=s.$$scope)},[l,o,r,d]}class Pe extends ne{constructor(e){super(),re(this,e,Ae,qe,le,{})}}export{Pe as component};
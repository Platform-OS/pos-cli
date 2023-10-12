import{s as le,f as g,a as A,g as k,h as w,c as N,r as F,d as v,j as b,i as U,u as p,J as X,x as B,M as ie,y as ce,v as Y,z as fe,H as ue,o as ae,l as de,m as _e,w as M,n as me,B as he,A as G,p as Z,D as pe,E as be,F as ve,G as ge}from"../chunks/scheduler.e2aa1391.js";import{S as ne,i as re,g as ke,t as K,c as ye,a as I,h as Ee,b as J,d as O,m as R,e as Q}from"../chunks/index.12b5c620.js";import{e as x}from"../chunks/each.c0161bb5.js";import{f as Se}from"../chunks/index.ad4c134d.js";import{p as we}from"../chunks/stores.a142ec2e.js";import{s as ee}from"../chunks/state.f2691bd0.js";import{t as De}from"../chunks/table.aa2299a7.js";import{I as oe}from"../chunks/Icon.a5fa4953.js";function te(i,e,t){const r=i.slice();return r[15]=e[t],r[17]=t,r}function Ie(i){let e,t,r;return t=new oe({props:{icon:"search",size:"18"}}),{c(){e=g("i"),J(t.$$.fragment),this.h()},l(o){e=k(o,"I",{class:!0});var l=w(e);O(t.$$.fragment,l),l.forEach(v),this.h()},h(){b(e,"class","svelte-12fj0m9")},m(o,l){U(o,e,l),R(t,e,null),r=!0},p:G,i(o){r||(I(t.$$.fragment,o),r=!0)},o(o){K(t.$$.fragment,o),r=!1},d(o){o&&v(e),Q(t)}}}function je(i){let e,t,r="Reset filter",o,l,d,s,a;return l=new oe({props:{icon:"x",size:"18"}}),{c(){e=g("button"),t=g("span"),t.textContent=r,o=A(),J(l.$$.fragment),this.h()},l(n){e=k(n,"BUTTON",{class:!0});var h=w(e);t=k(h,"SPAN",{class:!0,"data-svelte-h":!0}),F(t)!=="svelte-8g7ehw"&&(t.textContent=r),o=N(h),O(l.$$.fragment,h),h.forEach(v),this.h()},h(){b(t,"class","label"),b(e,"class","svelte-12fj0m9")},m(n,h){U(n,e,h),p(e,t),p(e,o),R(l,e,null),d=!0,s||(a=B(e,"click",i[8]),s=!0)},p:G,i(n){d||(I(l.$$.fragment,n),d=!0)},o(n){K(l.$$.fragment,n),d=!1},d(n){n&&v(e),Q(l),s=!1,a()}}}function se(i){let e,t,r=i[15].name+"",o,l,d,s;return{c(){e=g("li"),t=g("a"),o=de(r),d=A(),this.h()},l(a){e=k(a,"LI",{});var n=w(e);t=k(n,"A",{href:!0,class:!0});var h=w(t);o=_e(h,r),h.forEach(v),d=N(n),n.forEach(v),this.h()},h(){b(t,"href",l="/database/table/"+i[15].id),b(t,"class","svelte-12fj0m9"),M(t,"active",i[15].id===i[4].params.id)},m(a,n){U(a,e,n),p(e,t),p(t,o),p(e,d)},p(a,n){n&1&&r!==(r=a[15].name+"")&&me(o,r),n&1&&l!==(l="/database/table/"+a[15].id)&&b(t,"href",l),n&17&&M(t,"active",a[15].id===a[4].params.id)},i(a){a&&(s||he(()=>{s=Ee(e,Se,{duration:100,delay:7*i[17]}),s.start()}))},o:G,d(a){a&&v(e)}}}function Ce(i){let e,t,r,o,l,d,s,a,n,h="Ctrl",E,z="K",T,j,C,q,V,c;const H=[je,Ie],S=[];function L(f,m){return f[3]?0:1}o=L(i),l=S[o]=H[o](i);let D=x(i[0]),_=[];for(let f=0;f<D.length;f+=1)_[f]=se(te(i,D,f));return{c(){e=g("aside"),t=g("div"),r=g("div"),l.c(),d=A(),s=g("input"),a=A(),n=g("kbd"),n.textContent=h,E=g("kbd"),E.textContent=z,T=A(),j=g("nav"),C=g("ul");for(let f=0;f<_.length;f+=1)_[f].c();this.h()},l(f){e=k(f,"ASIDE",{class:!0});var m=w(e);t=k(m,"DIV",{class:!0});var y=w(t);r=k(y,"DIV",{class:!0});var u=w(r);l.l(u),d=N(u),s=k(u,"INPUT",{type:!0,placeholder:!0,class:!0}),a=N(u),n=k(u,"KBD",{class:!0,"data-svelte-h":!0}),F(n)!=="svelte-1c7qffr"&&(n.textContent=h),E=k(u,"KBD",{class:!0,"data-svelte-h":!0}),F(E)!=="svelte-3k5xuj"&&(E.textContent=z),u.forEach(v),y.forEach(v),T=N(m),j=k(m,"NAV",{class:!0});var $=w(j);C=k($,"UL",{});var W=w(C);for(let P=0;P<_.length;P+=1)_[P].l(W);W.forEach(v),$.forEach(v),m.forEach(v),this.h()},h(){b(s,"type","text"),b(s,"placeholder","Search tables"),b(s,"class","svelte-12fj0m9"),b(n,"class","svelte-12fj0m9"),b(E,"class","svelte-12fj0m9"),b(r,"class","filter svelte-12fj0m9"),b(t,"class","filter-container svelte-12fj0m9"),b(j,"class","svelte-12fj0m9"),b(e,"class","svelte-12fj0m9")},m(f,m){U(f,e,m),p(e,t),p(t,r),S[o].m(r,null),p(r,d),p(r,s),i[9](s),X(s,i[3]),p(r,a),p(r,n),p(r,E),p(e,T),p(e,j),p(j,C);for(let y=0;y<_.length;y+=1)_[y]&&_[y].m(C,null);i[11](e),q=!0,V||(c=[B(s,"input",i[10]),B(s,"input",i[5]),B(s,"keydown",i[6]),B(e,"keydown",i[7])],V=!0)},p(f,[m]){let y=o;if(o=L(f),o===y?S[o].p(f,m):(ke(),K(S[y],1,1,()=>{S[y]=null}),ye(),l=S[o],l?l.p(f,m):(l=S[o]=H[o](f),l.c()),I(l,1),l.m(r,d)),m&8&&s.value!==f[3]&&X(s,f[3]),m&17){D=x(f[0]);let u;for(u=0;u<D.length;u+=1){const $=te(f,D,u);_[u]?(_[u].p($,m),I(_[u],1)):(_[u]=se($),_[u].c(),I(_[u],1),_[u].m(C,null))}for(;u<_.length;u+=1)_[u].d(1);_.length=D.length}},i(f){if(!q){I(l);for(let m=0;m<D.length;m+=1)I(_[m]);q=!0}},o(f){K(l),q=!1},d(f){f&&v(e),S[o].d(),i[9](null),ie(_,f),i[11](null),V=!1,ce(c)}}}function $e(i,e,t){let r,o;Y(i,we,c=>t(4,r=c)),Y(i,ee,c=>t(13,o=c));let l=o.tables,d=l,s,a,n;(async()=>await De.get())().then(c=>{l=c,t(0,d=c),fe(ee,o.tables=c,o)});const h=ue();ae(async()=>{a.focus(),document.addEventListener("keydown",c=>{c.ctrlKey&&c.key==="k"&&(c.preventDefault(),h("sidebarNeeded"),a.focus(),a.select())}),r.data.table&&s.querySelector(`[href$="${r.data.table.id}"]`).scrollIntoView({behavior:"smooth",block:"center"})});const E=()=>{n?t(0,d=l.filter(c=>c.name.includes(n))):t(0,d=l)},z=c=>{c.key==="Escape"&&(t(3,n=""),E()),c.key==="Enter"&&s.querySelector("li:first-child a").click()},T=c=>{var H,S,L,D,_,f,m,y,u,$;c.key==="ArrowDown"&&s.contains(document.activeElement)&&(c.preventDefault(),document.activeElement.matches("input")?(H=s.querySelector("a"))==null||H.focus():(_=(D=(L=(S=document.activeElement)==null?void 0:S.parentElement)==null?void 0:L.nextElementSibling)==null?void 0:D.querySelector("a"))==null||_.focus()),c.key==="ArrowUp"&&s.contains(document.activeElement)&&(c.preventDefault(),(f=document.activeElement)!=null&&f.matches("li:first-child a")?a.focus():($=(u=(y=(m=document.activeElement)==null?void 0:m.parentElement)==null?void 0:y.previousElementSibling)==null?void 0:u.querySelector("a"))==null||$.focus()),c.key==="Escape"&&s.contains(document.activeElement)&&(a.focus(),t(3,n=""),E())},j=()=>{t(3,n=null),E()};function C(c){Z[c?"unshift":"push"](()=>{a=c,t(2,a)})}function q(){n=this.value,t(3,n)}function V(c){Z[c?"unshift":"push"](()=>{s=c,t(1,s)})}return[d,s,a,n,r,E,z,T,j,C,q,V]}class qe extends ne{constructor(e){super(),re(this,e,$e,Ce,le,{})}}function Ae(i){let e,t,r,o,l;r=new qe({}),r.$on("sidebarNeeded",i[3]);const d=i[2].default,s=pe(d,i,i[1],null);return{c(){e=g("div"),t=g("div"),J(r.$$.fragment),o=A(),s&&s.c(),this.h()},l(a){e=k(a,"DIV",{class:!0});var n=w(e);t=k(n,"DIV",{class:!0});var h=w(t);O(r.$$.fragment,h),h.forEach(v),o=N(n),s&&s.l(n),n.forEach(v),this.h()},h(){b(t,"class","tables-container svelte-s8xmdg"),b(e,"class","container svelte-s8xmdg"),M(e,"tablesHidden",i[0])},m(a,n){U(a,e,n),p(e,t),R(r,t,null),p(e,o),s&&s.m(e,null),l=!0},p(a,[n]){s&&s.p&&(!l||n&2)&&be(s,d,a,a[1],l?ge(d,a[1],n,null):ve(a[1]),null),(!l||n&1)&&M(e,"tablesHidden",a[0])},i(a){l||(I(r.$$.fragment,a),I(s,a),l=!0)},o(a){K(r.$$.fragment,a),K(s,a),l=!1},d(a){a&&v(e),Q(r),s&&s.d(a)}}}function Ne(i,e,t){let{$$slots:r={},$$scope:o}=e,l=!1;ae(()=>{document.addEventListener("keydown",s=>{!s.target.matches("input, textarea")&&s.key==="b"&&(t(0,l=!l),localStorage.tablesHidden=l)})});const d=()=>t(0,l=!1);return i.$$set=s=>{"$$scope"in s&&t(1,o=s.$$scope)},[l,o,r,d]}class Me extends ne{constructor(e){super(),re(this,e,Ne,Ae,le,{})}}export{Me as component};

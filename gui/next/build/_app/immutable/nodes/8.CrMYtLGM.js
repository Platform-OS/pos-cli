import{s as Ge,z as Ke,a as I,e as h,t as ne,p as Je,f as b,g as S,c as d,b as j,A as G,d as oe,y as u,B as re,I as He,i as x,h as o,J as Ae,C as Z,D as Ye,j as ve,r as Qe,k as Ne,n as We,F as Xe,G as Oe,l as Ze,u as xe,m as et,o as tt,K as at,H as st}from"../chunks/scheduler.ts1nwYMk.js";import{S as lt,i as rt,b as nt,c as ge,d as ke,m as Ee,t as D,a as H,e as De,f as je,h as Ue,g as we}from"../chunks/index.MbwxngTa.js";import{g as ot}from"../chunks/globals.D0QH3NT1.js";import{e as Re}from"../chunks/each.CLm8ZDgo.js";import{g as it}from"../chunks/entry.DYTJR7db.js";import{s as ut}from"../chunks/state.HIdUDD3F.js";import{q as ft}from"../chunks/index.iVSWiVfi.js";import{p as ct}from"../chunks/stores.D3n-8z5b.js";import{u as _t}from"../chunks/user.DoFwVcfx.js";import{I as Ve}from"../chunks/Icon.Dn_EaQMz.js";import{N as mt}from"../chunks/Number.CAl2R2zF.js";const{document:be}=ot;function ye(a,s,r){const e=a.slice();return e[17]=s[r],e}function Be(a){let s,r,e="Clear filters",t,i,l,m,C,k;return i=new Ve({props:{icon:"x",size:"14"}}),{c(){s=h("button"),r=h("span"),r.textContent=e,t=I(),ge(i.$$.fragment),this.h()},l(n){s=d(n,"BUTTON",{type:!0,class:!0});var _=j(s);r=d(_,"SPAN",{class:!0,"data-svelte-h":!0}),G(r)!=="svelte-ki22n5"&&(r.textContent=e),t=S(_),ke(i.$$.fragment,_),_.forEach(b),this.h()},h(){u(r,"class","label svelte-1kz5jrb"),u(s,"type","button"),u(s,"class","clear svelte-1kz5jrb")},m(n,_){x(n,s,_),o(s,r),o(s,t),Ee(i,s,null),m=!0,C||(k=Z(s,"click",a[12]),C=!0)},p:We,i(n){m||(D(i.$$.fragment,n),n&&He(()=>{m&&(l||(l=Ue(s,a[6],{},!0)),l.run(1))}),m=!0)},o(n){H(i.$$.fragment,n),n&&(l||(l=Ue(s,a[6],{},!1)),l.run(0)),m=!1},d(n){n&&b(s),je(i),n&&l&&l.end(),C=!1,k()}}}function Me(a){let s,r=Re(a[2]),e=[];for(let t=0;t<r.length;t+=1)e[t]=qe(ye(a,r,t));return{c(){s=h("tbody");for(let t=0;t<e.length;t+=1)e[t].c()},l(t){s=d(t,"TBODY",{});var i=j(s);for(let l=0;l<e.length;l+=1)e[l].l(i);i.forEach(b)},m(t,i){x(t,s,i);for(let l=0;l<e.length;l+=1)e[l]&&e[l].m(s,null)},p(t,i){if(i&5){r=Re(t[2]);let l;for(l=0;l<r.length;l+=1){const m=ye(t,r,l);e[l]?e[l].p(m,i):(e[l]=qe(m),e[l].c(),e[l].m(s,null))}for(;l<e.length;l+=1)e[l].d(1);e.length=r.length}},d(t){t&&b(s),Xe(e,t)}}}function qe(a){let s,r,e,t=a[17].id+"",i,l,m,C,k,n=a[17].email+"",_,z,y;return{c(){s=h("tr"),r=h("td"),e=h("a"),i=ne(t),m=I(),C=h("td"),k=h("a"),_=ne(n),y=I(),this.h()},l(p){s=d(p,"TR",{class:!0});var E=j(s);r=d(E,"TD",{class:!0});var B=j(r);e=d(B,"A",{href:!0,class:!0});var T=j(e);i=oe(T,t),T.forEach(b),B.forEach(b),m=S(E),C=d(E,"TD",{class:!0});var M=j(C);k=d(M,"A",{href:!0,class:!0});var U=j(k);_=oe(U,n),U.forEach(b),M.forEach(b),y=S(E),E.forEach(b),this.h()},h(){u(e,"href",l="/users/"+a[17].id+"?"+a[0].url.searchParams.toString()),u(e,"class","svelte-1kz5jrb"),u(r,"class","table-id svelte-1kz5jrb"),u(k,"href",z="/users/"+a[17].id+"?"+a[0].url.searchParams.toString()),u(k,"class","svelte-1kz5jrb"),u(C,"class","svelte-1kz5jrb"),u(s,"class","svelte-1kz5jrb"),Oe(s,"active",a[0].params.id==a[17].id)},m(p,E){x(p,s,E),o(s,r),o(r,e),o(e,i),o(s,m),o(s,C),o(C,k),o(k,_),o(s,y)},p(p,E){E&4&&t!==(t=p[17].id+"")&&ve(i,t),E&5&&l!==(l="/users/"+p[17].id+"?"+p[0].url.searchParams.toString())&&u(e,"href",l),E&4&&n!==(n=p[17].email+"")&&ve(_,n),E&5&&z!==(z="/users/"+p[17].id+"?"+p[0].url.searchParams.toString())&&u(k,"href",z),E&5&&Oe(s,"active",p[0].params.id==p[17].id)},d(p){p&&b(s)}}}function Fe(a){let s;const r=a[8].default,e=Ze(r,a,a[7],null);return{c(){e&&e.c()},l(t){e&&e.l(t)},m(t,i){e&&e.m(t,i),s=!0},p(t,i){e&&e.p&&(!s||i&128)&&xe(e,r,t,t[7],s?tt(r,t[7],i,null):et(t[7]),null)},i(t){s||(D(e,t),s=!0)},o(t){H(e,t),s=!1},d(t){e&&e.d(t)}}}function pt(a){var Le;let s,r,e,t,i,l,m,C="Filter by",k,n,_,z,y="email",p,E="id",B,T,M,U,c,A,ee="Apply filter",W,q,ie,J,w,V,Ce='<tr class="svelte-1kz5jrb"><th class="table-id svelte-1kz5jrb">ID</th> <th class="svelte-1kz5jrb">Email</th></tr>',ue,fe,N,$,ze="Page:",ce,O,_e,me,X=a[3].totalPages+"",te,pe,Y,he,Pe;be.title=s="Users"+((Le=a[4].online)!=null&&Le.MPKIT_URL?": "+a[4].online.MPKIT_URL.replace("https://",""):"");let v=a[3].value&&Be(a);q=new Ve({props:{icon:"arrowRight"}});let P=a[2]&&Me(a);function $e(f){a[15](f)}let Te={form:"filters",name:"page",min:1,max:a[3].totalPages,step:1,decreaseLabel:"Previous page",increaseLabel:"Next page",style:"navigation"};a[3].page!==void 0&&(Te.value=a[3].page),O=new mt({props:Te}),Ke.push(()=>nt(O,"value",$e)),O.$on("input",a[16]);let g=a[0].params.id&&Fe(a);return{c(){r=I(),e=h("div"),t=h("section"),i=h("nav"),l=h("form"),m=h("label"),m.textContent=C,k=I(),n=h("fieldset"),_=h("select"),z=h("option"),z.textContent=y,p=h("option"),p.textContent=E,B=I(),T=h("input"),M=I(),v&&v.c(),U=I(),c=h("button"),A=h("span"),A.textContent=ee,W=I(),ge(q.$$.fragment),ie=I(),J=h("article"),w=h("table"),V=h("thead"),V.innerHTML=Ce,ue=I(),P&&P.c(),fe=I(),N=h("nav"),$=h("label"),$.textContent=ze,ce=I(),ge(O.$$.fragment),me=ne(`\r
    of `),te=ne(X),pe=I(),g&&g.c(),this.h()},l(f){Je("svelte-mcmxo",be.head).forEach(b),r=S(f),e=d(f,"DIV",{class:!0});var F=j(e);t=d(F,"SECTION",{class:!0});var R=j(t);i=d(R,"NAV",{class:!0});var Ie=j(i);l=d(Ie,"FORM",{action:!0,id:!0,class:!0});var ae=j(l);m=d(ae,"LABEL",{for:!0,"data-svelte-h":!0}),G(m)!=="svelte-rbwhex"&&(m.textContent=C),k=S(ae),n=d(ae,"FIELDSET",{class:!0});var K=j(n);_=d(K,"SELECT",{id:!0,name:!0,class:!0});var de=j(_);z=d(de,"OPTION",{"data-svelte-h":!0}),G(z)!=="svelte-51kto6"&&(z.textContent=y),p=d(de,"OPTION",{"data-svelte-h":!0}),G(p)!=="svelte-ns3pfu"&&(p.textContent=E),de.forEach(b),B=S(K),T=d(K,"INPUT",{type:!0,name:!0,class:!0}),M=S(K),v&&v.l(K),U=S(K),c=d(K,"BUTTON",{type:!0,class:!0});var se=j(c);A=d(se,"SPAN",{class:!0,"data-svelte-h":!0}),G(A)!=="svelte-ctu7wl"&&(A.textContent=ee),W=S(se),ke(q.$$.fragment,se),se.forEach(b),K.forEach(b),ae.forEach(b),Ie.forEach(b),ie=S(R),J=d(R,"ARTICLE",{class:!0});var Se=j(J);w=d(Se,"TABLE",{class:!0});var le=j(w);V=d(le,"THEAD",{class:!0,"data-svelte-h":!0}),G(V)!=="svelte-ge4529"&&(V.innerHTML=Ce),ue=S(le),P&&P.l(le),le.forEach(b),Se.forEach(b),fe=S(R),N=d(R,"NAV",{class:!0});var Q=j(N);$=d(Q,"LABEL",{for:!0,"data-svelte-h":!0}),G($)!=="svelte-1yefxsu"&&($.textContent=ze),ce=S(Q),ke(O.$$.fragment,Q),me=oe(Q,`\r
    of `),te=oe(Q,X),Q.forEach(b),R.forEach(b),pe=S(F),g&&g.l(F),F.forEach(b),this.h()},h(){u(m,"for","filters_attribute"),z.__value="email",re(z,z.__value),p.__value="id",re(p,p.__value),u(_,"id","filters_attribute"),u(_,"name","attribute"),u(_,"class","svelte-1kz5jrb"),a[3].attribute===void 0&&He(()=>a[9].call(_)),u(T,"type","text"),u(T,"name","value"),u(T,"class","svelte-1kz5jrb"),u(A,"class","label svelte-1kz5jrb"),u(c,"type","submit"),u(c,"class","button svelte-1kz5jrb"),u(n,"class","search svelte-1kz5jrb"),u(l,"action",""),u(l,"id","filters"),u(l,"class","svelte-1kz5jrb"),u(i,"class","filters svelte-1kz5jrb"),u(V,"class","svelte-1kz5jrb"),u(w,"class","svelte-1kz5jrb"),u(J,"class","contetnt"),u($,"for","page"),u(N,"class","pagination svelte-1kz5jrb"),u(t,"class","container svelte-1kz5jrb"),u(e,"class","page svelte-1kz5jrb")},m(f,L){x(f,r,L),x(f,e,L),o(e,t),o(t,i),o(i,l),o(l,m),o(l,k),o(l,n),o(n,_),o(_,z),o(_,p),Ae(_,a[3].attribute,!0),o(n,B),o(n,T),re(T,a[3].value),o(n,M),v&&v.m(n,null),o(n,U),o(n,c),o(c,A),o(c,W),Ee(q,c,null),a[13](l),o(t,ie),o(t,J),o(J,w),o(w,V),o(w,ue),P&&P.m(w,null),o(t,fe),o(t,N),o(N,$),o(N,ce),Ee(O,N,null),o(N,me),o(N,te),o(e,pe),g&&g.m(e,null),Y=!0,he||(Pe=[Z(_,"change",a[9]),Z(_,"change",a[10]),Z(T,"input",a[11]),Z(l,"submit",a[14])],he=!0)},p(f,[L]){var R;(!Y||L&16)&&s!==(s="Users"+((R=f[4].online)!=null&&R.MPKIT_URL?": "+f[4].online.MPKIT_URL.replace("https://",""):""))&&(be.title=s),L&8&&Ae(_,f[3].attribute),L&8&&T.value!==f[3].value&&re(T,f[3].value),f[3].value?v?(v.p(f,L),L&8&&D(v,1)):(v=Be(f),v.c(),D(v,1),v.m(n,U)):v&&(we(),H(v,1,1,()=>{v=null}),De()),f[2]?P?P.p(f,L):(P=Me(f),P.c(),P.m(w,null)):P&&(P.d(1),P=null);const F={};L&8&&(F.max=f[3].totalPages),!_e&&L&8&&(_e=!0,F.value=f[3].page,Ye(()=>_e=!1)),O.$set(F),(!Y||L&8)&&X!==(X=f[3].totalPages+"")&&ve(te,X),f[0].params.id?g?(g.p(f,L),L&1&&D(g,1)):(g=Fe(f),g.c(),D(g,1),g.m(e,null)):g&&(we(),H(g,1,1,()=>{g=null}),De())},i(f){Y||(D(v),D(q.$$.fragment,f),D(O.$$.fragment,f),D(g),Y=!0)},o(f){H(v),H(q.$$.fragment,f),H(O.$$.fragment,f),H(g),Y=!1},d(f){f&&(b(r),b(e)),v&&v.d(),je(q),a[13](null),P&&P.d(),je(O),g&&g.d(),he=!1,Qe(Pe)}}}function ht(a,s,r){let e,t;Ne(a,ct,c=>r(0,e=c)),Ne(a,ut,c=>r(4,t=c));let{$$slots:i={},$$scope:l}=s,m,C=[],k={page:1,attribute:"email",value:""},n={page:1,totalPages:1,attribute:"email",value:"",...Object.fromEntries(e.url.searchParams)};const _=function(c,{delay:A=0,duration:ee=150}){return{delay:A,duration:ee,css:W=>`scale: ${ft(W)};`}};function z(){n.attribute=at(this),r(3,n),r(0,e)}const y=()=>r(3,n.value="",n);function p(){n.value=this.value,r(3,n),r(0,e)}const E=()=>{r(3,n={...k}),m.requestSubmit()};function B(c){Ke[c?"unshift":"push"](()=>{m=c,r(1,m)})}const T=async c=>{var A;((A=c.submitter)==null?void 0:A.dataset.action)!=="numberIncrease"&&(c.preventDefault(),r(3,n.page=1,n),await st(),it(document.location.pathname+"?"+new URLSearchParams(new FormData(c.target)).toString()))};function M(c){a.$$.not_equal(n.page,c)&&(n.page=c,r(3,n),r(0,e))}const U=c=>{m.requestSubmit(c.detail.submitter)};return a.$$set=c=>{"$$scope"in c&&r(7,l=c.$$scope)},a.$$.update=()=>{a.$$.dirty&1&&_t.get(Object.fromEntries(e.url.searchParams)).then(c=>{r(2,C=c.results),r(3,n.totalPages=c.total_pages,n)})},[e,m,C,n,t,k,_,l,i,z,y,p,E,B,T,M,U]}class Lt extends lt{constructor(s){super(),rt(this,s,ht,pt,Ge,{})}}export{Lt as component};
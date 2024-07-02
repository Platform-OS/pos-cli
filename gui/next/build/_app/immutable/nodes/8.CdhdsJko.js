import{s as De,z as Pe,l as Fe,e as p,t as X,a as I,c as d,b as A,d as Y,A as z,f as T,g as P,B as se,y as f,I as ye,i as Ee,h as l,J as Ne,C as W,D as qe,j as pe,u as Be,m as Me,o as He,F as Re,r as Ue,k as Ve,K as je,n as ze,L as Je}from"../chunks/scheduler.D91BpYsI.js";import{S as Ke,i as Ge,b as Qe,c as de,d as ve,m as be,t as U,a as J,e as We,f as ge,h as $e,g as Xe}from"../chunks/index.BlSdqSUK.js";import{e as Le}from"../chunks/each.DobwZXGK.js";import{q as Ye}from"../chunks/index.iVSWiVfi.js";import{p as Ze}from"../chunks/stores.DByQsMt3.js";import{u as xe}from"../chunks/user.BOekq16u.js";import{I as Se}from"../chunks/Icon.ziKqNBVf.js";import{N as et}from"../chunks/Number.Ba9VSwmg.js";function Ae(s,t,a){const h=s.slice();return h[17]=t[a],h}function Oe(s){let t,a,h="Clear filters",i,b,n,o,k,r;return b=new Se({props:{icon:"x",size:"14"}}),{c(){t=p("button"),a=p("span"),a.textContent=h,i=I(),de(b.$$.fragment),this.h()},l(c){t=d(c,"BUTTON",{type:!0,class:!0});var g=A(t);a=d(g,"SPAN",{class:!0,"data-svelte-h":!0}),z(a)!=="svelte-ki22n5"&&(a.textContent=h),i=P(g),ve(b.$$.fragment,g),g.forEach(T),this.h()},h(){f(a,"class","label svelte-1t95hr7"),f(t,"type","button"),f(t,"class","clear svelte-1t95hr7")},m(c,g){Ee(c,t,g),l(t,a),l(t,i),be(b,t,null),o=!0,k||(r=W(t,"click",s[12]),k=!0)},p:ze,i(c){o||(U(b.$$.fragment,c),c&&ye(()=>{o&&(n||(n=$e(t,s[6],{},!0)),n.run(1))}),o=!0)},o(c){J(b.$$.fragment,c),c&&(n||(n=$e(t,s[6],{},!1)),n.run(0)),o=!1},d(c){c&&T(t),ge(b),c&&n&&n.end(),k=!1,r()}}}function Ie(s){let t,a,h=s[17].id+"",i,b,n,o,k=s[17].email+"",r,c,g;return{c(){t=p("tr"),a=p("td"),i=X(h),b=I(),n=p("td"),o=p("a"),r=X(k),g=I(),this.h()},l(m){t=d(m,"TR",{});var u=A(t);a=d(u,"TD",{class:!0});var B=A(a);i=Y(B,h),B.forEach(T),b=P(u),n=d(u,"TD",{class:!0});var M=A(n);o=d(M,"A",{href:!0});var L=A(o);r=Y(L,k),L.forEach(T),M.forEach(T),g=P(u),u.forEach(T),this.h()},h(){f(a,"class","svelte-1t95hr7"),f(o,"href",c="/users/"+s[17].id),f(n,"class","svelte-1t95hr7")},m(m,u){Ee(m,t,u),l(t,a),l(a,i),l(t,b),l(t,n),l(n,o),l(o,r),l(t,g)},p(m,u){u&2&&h!==(h=m[17].id+"")&&pe(i,h),u&2&&k!==(k=m[17].email+"")&&pe(r,k),u&2&&c!==(c="/users/"+m[17].id)&&f(o,"href",c)},d(m){m&&T(t)}}}function tt(s){let t,a,h,i,b,n,o,k="email",r,c="id",g,m,u,B,M,L,F,Z="Apply filter",K,_,G,y,q,le='<tr><th class="svelte-1t95hr7">id</th> <th class="svelte-1t95hr7">email</th></tr>',ne,re,S,H,Ce="Page:",oe,w,ie,ue,Q=(s[3]||1)+"",x,fe,R,ce,Te,v=s[2].value&&Oe(s);_=new Se({props:{icon:"arrowRight"}});let V=Le(s[1]),C=[];for(let e=0;e<V.length;e+=1)C[e]=Ie(Ae(s,V,e));function we(e){s[15](e)}let ke={form:"filters",name:"page",min:1,max:s[3],step:1,decreaseLabel:"Previous page",increaseLabel:"Next page",style:"navigation"};s[2].page!==void 0&&(ke.value=s[2].page),w=new et({props:ke}),Pe.push(()=>Qe(w,"value",we)),w.$on("input",s[5]);const _e=s[8].default,O=Fe(_e,s,s[7],null);return{c(){t=p("div"),a=p("section"),h=p("nav"),i=p("form"),b=X(`Filter by\r
        `),n=p("select"),o=p("option"),o.textContent=k,r=p("option"),r.textContent=c,g=I(),m=p("fieldset"),u=p("input"),B=I(),v&&v.c(),M=I(),L=p("button"),F=p("span"),F.textContent=Z,K=I(),de(_.$$.fragment),G=I(),y=p("table"),q=p("thead"),q.innerHTML=le,ne=I();for(let e=0;e<C.length;e+=1)C[e].c();re=I(),S=p("nav"),H=p("label"),H.textContent=Ce,oe=I(),de(w.$$.fragment),ue=X(`\r
      of `),x=X(Q),fe=I(),O&&O.c(),this.h()},l(e){t=d(e,"DIV",{class:!0});var E=A(t);a=d(E,"SECTION",{class:!0});var N=A(a);h=d(N,"NAV",{class:!0});var $=A(h);i=d($,"FORM",{id:!0,class:!0});var D=A(i);b=Y(D,`Filter by\r
        `),n=d(D,"SELECT",{name:!0});var he=A(n);o=d(he,"OPTION",{"data-svelte-h":!0}),z(o)!=="svelte-51kto6"&&(o.textContent=k),r=d(he,"OPTION",{"data-svelte-h":!0}),z(r)!=="svelte-ns3pfu"&&(r.textContent=c),he.forEach(T),g=P(D),m=d(D,"FIELDSET",{class:!0});var ee=A(m);u=d(ee,"INPUT",{type:!0,name:!0,class:!0}),B=P(ee),v&&v.l(ee),ee.forEach(T),M=P(D),L=d(D,"BUTTON",{type:!0,class:!0});var te=A(L);F=d(te,"SPAN",{class:!0,"data-svelte-h":!0}),z(F)!=="svelte-ctu7wl"&&(F.textContent=Z),K=P(te),ve(_.$$.fragment,te),te.forEach(T),D.forEach(T),$.forEach(T),G=P(N),y=d(N,"TABLE",{class:!0});var ae=A(y);q=d(ae,"THEAD",{class:!0,"data-svelte-h":!0}),z(q)!=="svelte-128602a"&&(q.innerHTML=le),ne=P(ae);for(let me=0;me<C.length;me+=1)C[me].l(ae);ae.forEach(T),re=P(N),S=d(N,"NAV",{class:!0});var j=A(S);H=d(j,"LABEL",{for:!0,"data-svelte-h":!0}),z(H)!=="svelte-1r8oyu6"&&(H.textContent=Ce),oe=P(j),ve(w.$$.fragment,j),ue=Y(j,`\r
      of `),x=Y(j,Q),j.forEach(T),N.forEach(T),fe=P(E),O&&O.l(E),E.forEach(T),this.h()},h(){o.__value="email",se(o,o.__value),r.__value="id",se(r,r.__value),f(n,"name","attribute"),s[2].attribute===void 0&&ye(()=>s[9].call(n)),f(u,"type","text"),f(u,"name","value"),f(u,"class","svelte-1t95hr7"),f(m,"class","svelte-1t95hr7"),f(F,"class","label svelte-1t95hr7"),f(L,"type","submit"),f(L,"class","button submit"),f(i,"id","filters"),f(i,"class","svelte-1t95hr7"),f(h,"class","filters svelte-1t95hr7"),f(q,"class","svelte-1t95hr7"),f(y,"class","svelte-1t95hr7"),f(H,"for","page"),f(S,"class","pagination svelte-1t95hr7"),f(a,"class","svelte-1t95hr7"),f(t,"class","container svelte-1t95hr7")},m(e,E){Ee(e,t,E),l(t,a),l(a,h),l(h,i),l(i,b),l(i,n),l(n,o),l(n,r),Ne(n,s[2].attribute,!0),l(i,g),l(i,m),l(m,u),se(u,s[2].value),l(m,B),v&&v.m(m,null),l(i,M),l(i,L),l(L,F),l(L,K),be(_,L,null),s[13](i),l(a,G),l(a,y),l(y,q),l(y,ne);for(let N=0;N<C.length;N+=1)C[N]&&C[N].m(y,null);l(a,re),l(a,S),l(S,H),l(S,oe),be(w,S,null),l(S,ue),l(S,x),l(t,fe),O&&O.m(t,null),R=!0,ce||(Te=[W(n,"change",s[9]),W(n,"change",s[10]),W(u,"input",s[11]),W(i,"submit",s[14])],ce=!0)},p(e,[E]){if(E&4&&Ne(n,e[2].attribute),E&4&&u.value!==e[2].value&&se(u,e[2].value),e[2].value?v?(v.p(e,E),E&4&&U(v,1)):(v=Oe(e),v.c(),U(v,1),v.m(m,null)):v&&(Xe(),J(v,1,1,()=>{v=null}),We()),E&2){V=Le(e[1]);let $;for($=0;$<V.length;$+=1){const D=Ae(e,V,$);C[$]?C[$].p(D,E):(C[$]=Ie(D),C[$].c(),C[$].m(y,null))}for(;$<C.length;$+=1)C[$].d(1);C.length=V.length}const N={};E&8&&(N.max=e[3]),!ie&&E&4&&(ie=!0,N.value=e[2].page,qe(()=>ie=!1)),w.$set(N),(!R||E&8)&&Q!==(Q=(e[3]||1)+"")&&pe(x,Q),O&&O.p&&(!R||E&128)&&Be(O,_e,e,e[7],R?He(_e,e[7],E,null):Me(e[7]),null)},i(e){R||(U(v),U(_.$$.fragment,e),U(w.$$.fragment,e),U(O,e),R=!0)},o(e){J(v),J(_.$$.fragment,e),J(w.$$.fragment,e),J(O,e),R=!1},d(e){e&&T(t),v&&v.d(),ge(_),s[13](null),Re(C,e),ge(w),O&&O.d(e),ce=!1,Ue(Te)}}}function at(s,t,a){let h;Ve(s,Ze,_=>a(16,h=_));let{$$slots:i={},$$scope:b}=t,n,o=[],k={page:1,attribute:"email",value:""},r={...k,...Object.fromEntries(h.url.searchParams)},c=1;const g=async()=>{await xe.get(r).then(_=>{a(1,o=_.results),a(3,c=_.total_pages)})};je(()=>{g()});const m=function(_,{delay:G=0,duration:y=150}){return{delay:G,duration:y,css:q=>`scale: ${Ye(q)};`}};function u(){r.attribute=Je(this),a(2,r)}const B=()=>a(2,r.value="",r);function M(){r.value=this.value,a(2,r)}const L=()=>{a(2,r={...k}),n.requestSubmit()};function F(_){Pe[_?"unshift":"push"](()=>{n=_,a(0,n)})}const Z=()=>{a(2,r.page=1,r),g()};function K(_){s.$$.not_equal(r.page,_)&&(r.page=_,a(2,r))}return s.$$set=_=>{"$$scope"in _&&a(7,b=_.$$scope)},[n,o,r,c,k,g,m,b,i,u,B,M,L,F,Z,K]}class ct extends Ke{constructor(t){super(),Ge(this,t,at,tt,De,{})}}export{ct as component};

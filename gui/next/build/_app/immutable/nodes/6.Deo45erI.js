import{s as Be,z as Re,a as $,e as p,t as x,p as Fe,f as g,g as A,c as h,b as w,A as he,d as ee,y as l,i as me,h as n,B as ne,C as oe,D as qe,j as ie,r as ze,k as De,E as He,F as Ke,G as J,l as Ve,u as je,m as Ge,o as Ye,H as Je}from"../chunks/scheduler.D91BpYsI.js";import{S as Qe,i as We,b as Xe,c as ge,d as ve,m as de,t as K,a as Q,e as Ze,f as be,g as xe}from"../chunks/index.BlSdqSUK.js";import{g as et}from"../chunks/globals.D0QH3NT1.js";import{e as $e}from"../chunks/each.DobwZXGK.js";import{g as tt}from"../chunks/entry.oBiidQuk.js";import{p as st}from"../chunks/stores.DByQsMt3.js";import{l as at}from"../chunks/logsv2.twsCDidx.js";import{s as Ae}from"../chunks/state.DMMxS8qS.js";import{I as ye}from"../chunks/Icon.ziKqNBVf.js";import{N as lt}from"../chunks/Number.Ba9VSwmg.js";const{document:ke}=et;function Me(t,a,i){const e=t.slice();return e[16]=a[i],e}function Ce(t){let a,i=$e(t[3].logsv2.hits),e=[];for(let s=0;s<i.length;s+=1)e[s]=Ne(Me(t,i,s));return{c(){a=p("tbody");for(let s=0;s<e.length;s+=1)e[s].c()},l(s){a=h(s,"TBODY",{});var _=w(a);for(let r=0;r<e.length;r+=1)e[r].l(_);_.forEach(g)},m(s,_){me(s,a,_);for(let r=0;r<e.length;r+=1)e[r]&&e[r].m(a,null)},p(s,_){if(_&13){i=$e(s[3].logsv2.hits);let r;for(r=0;r<i.length;r+=1){const c=Me(s,i,r);e[r]?e[r].p(c,_):(e[r]=Ne(c),e[r].c(),e[r].m(a,null))}for(;r<e.length;r+=1)e[r].d(1);e.length=i.length}},d(s){s&&g(a),Ke(e,s)}}}function Ne(t){let a,i,e,s=new Date(t[16].options_at/1e3).toLocaleString()+"",_,r,c,P,d,L=t[16].type+"",v,M,E,y,b,T,C=t[16].message+"",N,m,O;return{c(){a=p("tr"),i=p("td"),e=p("a"),_=x(s),c=$(),P=p("td"),d=p("a"),v=x(L),E=$(),y=p("td"),b=p("a"),T=p("div"),N=x(C),O=$(),this.h()},l(f){a=h(f,"TR",{class:!0});var u=w(a);i=h(u,"TD",{class:!0});var R=w(i);e=h(R,"A",{href:!0,class:!0});var W=w(e);_=ee(W,s),W.forEach(g),R.forEach(g),c=A(u),P=h(u,"TD",{class:!0});var V=w(P);d=h(V,"A",{href:!0,class:!0});var j=w(d);v=ee(j,L),j.forEach(g),V.forEach(g),E=A(u),y=h(u,"TD",{class:!0});var D=w(y);b=h(D,"A",{href:!0,class:!0});var U=w(b);T=h(U,"DIV",{class:!0});var X=w(T);N=ee(X,C),X.forEach(g),U.forEach(g),D.forEach(g),O=A(u),u.forEach(g),this.h()},h(){l(e,"href",r="/logsv2/"+t[16]._timestamp+"?"+t[0].url.searchParams.toString()),l(e,"class","svelte-9rwk4m"),l(i,"class","time svelte-9rwk4m"),l(d,"href",M="/logsv2/"+t[16]._timestamp+"?"+t[0].url.searchParams.toString()),l(d,"class","svelte-9rwk4m"),l(P,"class","type svelte-9rwk4m"),l(T,"class","svelte-9rwk4m"),l(b,"href",m="/logsv2/"+t[16]._timestamp+"?"+t[0].url.searchParams.toString()),l(b,"class","svelte-9rwk4m"),l(y,"class","message svelte-9rwk4m"),l(a,"class","svelte-9rwk4m"),J(a,"error",t[16].type.match(/error/i)),J(a,"highlight",t[2].key==t[16]._timestamp),J(a,"active",t[0].params.id==t[16]._timestamp)},m(f,u){me(f,a,u),n(a,i),n(i,e),n(e,_),n(a,c),n(a,P),n(P,d),n(d,v),n(a,E),n(a,y),n(y,b),n(b,T),n(T,N),n(a,O)},p(f,u){u&8&&s!==(s=new Date(f[16].options_at/1e3).toLocaleString()+"")&&ie(_,s),u&9&&r!==(r="/logsv2/"+f[16]._timestamp+"?"+f[0].url.searchParams.toString())&&l(e,"href",r),u&8&&L!==(L=f[16].type+"")&&ie(v,L),u&9&&M!==(M="/logsv2/"+f[16]._timestamp+"?"+f[0].url.searchParams.toString())&&l(d,"href",M),u&8&&C!==(C=f[16].message+"")&&ie(N,C),u&9&&m!==(m="/logsv2/"+f[16]._timestamp+"?"+f[0].url.searchParams.toString())&&l(b,"href",m),u&8&&J(a,"error",f[16].type.match(/error/i)),u&12&&J(a,"highlight",f[2].key==f[16]._timestamp),u&9&&J(a,"active",f[0].params.id==f[16]._timestamp)},d(f){f&&g(a)}}}function Oe(t){let a;const i=t[7].default,e=Ve(i,t,t[6],null);return{c(){e&&e.c()},l(s){e&&e.l(s)},m(s,_){e&&e.m(s,_),a=!0},p(s,_){e&&e.p&&(!a||_&64)&&je(e,i,s,s[6],a?Ye(i,s[6],_,null):Ge(s[6]),null)},i(s){a||(K(e,s),a=!0)},o(s){Q(e,s),a=!1},d(s){e&&e.d(s)}}}function rt(t){var Te;let a,i,e,s,_,r,c,P,d,L,v,M,E,y,b,T,C="Filter logs",N,m,O,f,u,R,W='<tr class="svelte-9rwk4m"><th class="svelte-9rwk4m">Time</th> <th class="svelte-9rwk4m">Type</th> <th class="message svelte-9rwk4m">Message</th></tr>',V,j,D,U,X="Page:",ue,B,fe,_e,q,Z=(Math.ceil(t[3].logsv2.total/t[3].logsv2.size)||1)+"",te,se,ce,H,pe,we;ke.title=a="Logs"+((Te=t[3].online)!=null&&Te.MPKIT_URL?": "+t[3].online.MPKIT_URL.replace("https://",""):""),v=new ye({props:{icon:"search"}}),m=new ye({props:{icon:"arrowRight"}});let S=t[3].logsv2.hits&&Ce(t);function Ue(o){t[13](o)}let Ee={form:"filters",name:"page",min:1,max:Math.ceil(t[3].logsv2.total/t[3].logsv2.size)||20,step:1,decreaseLabel:"Previous page",increaseLabel:"Next page",style:"navigation"};t[2].page!==void 0&&(Ee.value=t[2].page),B=new lt({props:Ee}),Re.push(()=>Xe(B,"value",Ue)),B.$on("input",t[14]);let k=t[0].params.id&&Oe(t);return{c(){i=$(),e=p("div"),s=p("section"),_=p("nav"),r=p("form"),c=p("input"),P=$(),d=p("fieldset"),L=p("label"),ge(v.$$.fragment),M=$(),E=p("input"),y=$(),b=p("button"),T=p("span"),T.textContent=C,N=$(),ge(m.$$.fragment),O=$(),f=p("article"),u=p("table"),R=p("thead"),R.innerHTML=W,V=$(),S&&S.c(),j=$(),D=p("nav"),U=p("label"),U.textContent=X,ue=$(),ge(B.$$.fragment),_e=x(`\r
        of `),q=p("span"),te=x(Z),ce=$(),k&&k.c(),this.h()},l(o){Fe("svelte-dfdkqr",ke.head).forEach(g),i=A(o),e=h(o,"DIV",{class:!0});var z=w(e);s=h(z,"SECTION",{class:!0});var F=w(s);_=h(F,"NAV",{class:!0});var Se=w(_);r=h(Se,"FORM",{action:!0,id:!0,class:!0});var ae=w(r);c=h(ae,"INPUT",{type:!0,name:!0,min:!0,max:!0,class:!0}),P=A(ae),d=h(ae,"FIELDSET",{class:!0});var G=w(d);L=h(G,"LABEL",{for:!0,class:!0});var Le=w(L);ve(v.$$.fragment,Le),Le.forEach(g),M=A(G),E=h(G,"INPUT",{type:!0,name:!0,id:!0,placeholder:!0,class:!0}),y=A(G),b=h(G,"BUTTON",{type:!0,class:!0});var le=w(b);T=h(le,"SPAN",{class:!0,"data-svelte-h":!0}),he(T)!=="svelte-y4mewk"&&(T.textContent=C),N=A(le),ve(m.$$.fragment,le),le.forEach(g),G.forEach(g),ae.forEach(g),Se.forEach(g),O=A(F),f=h(F,"ARTICLE",{class:!0});var Pe=w(f);u=h(Pe,"TABLE",{class:!0});var re=w(u);R=h(re,"THEAD",{class:!0,"data-svelte-h":!0}),he(R)!=="svelte-uyatsk"&&(R.innerHTML=W),V=A(re),S&&S.l(re),re.forEach(g),Pe.forEach(g),j=A(F),D=h(F,"NAV",{class:!0});var Y=w(D);U=h(Y,"LABEL",{for:!0,"data-svelte-h":!0}),he(U)!=="svelte-1xadase"&&(U.textContent=X),ue=A(Y),ve(B.$$.fragment,Y),_e=ee(Y,`\r
        of `),q=h(Y,"SPAN",{class:!0,title:!0});var Ie=w(q);te=ee(Ie,Z),Ie.forEach(g),Y.forEach(g),F.forEach(g),ce=A(z),k&&k.l(z),z.forEach(g),this.h()},h(){l(c,"type","date"),l(c,"name","start_time"),l(c,"min",t[5].toISOString().split("T")[0]),l(c,"max",t[4].toISOString().split("T")[0]),l(c,"class","svelte-9rwk4m"),l(L,"for","filter_message"),l(L,"class","svelte-9rwk4m"),l(E,"type","text"),l(E,"name","message"),l(E,"id","filter_message"),l(E,"placeholder","Find logs"),l(E,"class","svelte-9rwk4m"),l(T,"class","label"),l(b,"type","submit"),l(b,"class","button svelte-9rwk4m"),l(d,"class","search svelte-9rwk4m"),l(r,"action",""),l(r,"id","filters"),l(r,"class","svelte-9rwk4m"),l(_,"class","filters svelte-9rwk4m"),l(R,"class","svelte-9rwk4m"),l(u,"class","svelte-9rwk4m"),l(f,"class","content svelte-9rwk4m"),l(U,"for","page"),l(q,"class","info svelte-9rwk4m"),l(q,"title",se=t[3].logsv2.total+" logs total"),l(D,"class","pagination svelte-9rwk4m"),l(s,"class","container svelte-9rwk4m"),l(e,"class","page svelte-9rwk4m")},m(o,I){me(o,i,I),me(o,e,I),n(e,s),n(s,_),n(_,r),n(r,c),ne(c,t[2].start_time),n(r,P),n(r,d),n(d,L),de(v,L,null),n(d,M),n(d,E),ne(E,t[2].message),n(d,y),n(d,b),n(b,T),n(b,N),de(m,b,null),t[11](r),n(s,O),n(s,f),n(f,u),n(u,R),n(u,V),S&&S.m(u,null),n(s,j),n(s,D),n(D,U),n(D,ue),de(B,D,null),n(D,_e),n(D,q),n(q,te),n(e,ce),k&&k.m(e,null),H=!0,pe||(we=[oe(c,"input",t[8]),oe(c,"input",t[9]),oe(E,"input",t[10]),oe(r,"submit",t[12])],pe=!0)},p(o,[I]){var F;(!H||I&8)&&a!==(a="Logs"+((F=o[3].online)!=null&&F.MPKIT_URL?": "+o[3].online.MPKIT_URL.replace("https://",""):""))&&(ke.title=a),I&4&&ne(c,o[2].start_time),I&4&&E.value!==o[2].message&&ne(E,o[2].message),o[3].logsv2.hits?S?S.p(o,I):(S=Ce(o),S.c(),S.m(u,null)):S&&(S.d(1),S=null);const z={};I&8&&(z.max=Math.ceil(o[3].logsv2.total/o[3].logsv2.size)||20),!fe&&I&4&&(fe=!0,z.value=o[2].page,qe(()=>fe=!1)),B.$set(z),(!H||I&8)&&Z!==(Z=(Math.ceil(o[3].logsv2.total/o[3].logsv2.size)||1)+"")&&ie(te,Z),(!H||I&8&&se!==(se=o[3].logsv2.total+" logs total"))&&l(q,"title",se),o[0].params.id?k?(k.p(o,I),I&1&&K(k,1)):(k=Oe(o),k.c(),K(k,1),k.m(e,null)):k&&(xe(),Q(k,1,1,()=>{k=null}),Ze())},i(o){H||(K(v.$$.fragment,o),K(m.$$.fragment,o),K(B.$$.fragment,o),K(k),H=!0)},o(o){Q(v.$$.fragment,o),Q(m.$$.fragment,o),Q(B.$$.fragment,o),Q(k),H=!1},d(o){o&&(g(i),g(e)),be(v),be(m),t[11](null),S&&S.d(),be(B),k&&k.d(),pe=!1,ze(we)}}}function nt(t,a,i){let e,s;De(t,Ae,m=>i(3,e=m)),De(t,st,m=>i(0,s=m));let{$$slots:_={},$$scope:r}=a,c;const P=new Date,d=1e3*60*60*24,L=new Date(P-d*3);let v={page:1,start_time:P.toISOString().split("T")[0],...Object.fromEntries(s.url.searchParams)};function M(){v.start_time=this.value,i(2,v)}const E=()=>c.requestSubmit();function y(){v.message=this.value,i(2,v)}function b(m){Re[m?"unshift":"push"](()=>{c=m,i(1,c)})}const T=async m=>{var O;((O=m.submitter)==null?void 0:O.dataset.action)!=="numberIncrease"&&(m.preventDefault(),i(2,v.page=1,v),await Je(),tt(document.location.pathname+"?"+new URLSearchParams(new FormData(m.target)).toString()))};function C(m){t.$$.not_equal(v.page,m)&&(v.page=m,i(2,v))}const N=m=>{c.requestSubmit(m.detail.submitter)};return t.$$set=m=>{"$$scope"in m&&i(6,r=m.$$scope)},t.$$.update=()=>{t.$$.dirty&1&&at.get(Object.fromEntries(s.url.searchParams)).then(m=>He(Ae,e.logsv2=m,e))},[s,c,v,e,P,L,r,_,M,E,y,b,T,C,N]}class vt extends Qe{constructor(a){super(),We(this,a,nt,rt,Be,{})}}export{vt as component};

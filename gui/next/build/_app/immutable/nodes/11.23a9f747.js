import{s as Ie,a as k,f as d,l as he,J as Ue,d as g,c as F,g as _,h as D,r as ae,m as ve,j as s,i as Y,u as a,K as we,x as ee,R as be,N as Be,y as Fe,v as Me,A as qe,w as W,n as Ce,B as He}from"../chunks/scheduler.a497d5ec.js";import{S as Pe,i as Re,b as ue,d as fe,m as ce,a as R,t as G,c as Te,e as me,j as je,g as ye}from"../chunks/index.ca999c64.js";import{e as Ne}from"../chunks/each.1577bad0.js";import{f as Ve}from"../chunks/index.13972ea2.js";import{g as pe}from"../chunks/graphql.989a3e2b.js";import{s as z}from"../chunks/state.59162fba.js";import{I as de}from"../chunks/Icon.93862610.js";const ne={get:()=>pe({query:`
      query {
        constants(
          per_page: 100
        ) {
          results {
            name,
            value,
            updated_at
          }
        }
      }`}).then(l=>l.constants.results),edit:e=>{e=Object.fromEntries(e.entries());const l=`
      mutation {
        constant_set(name: "${e.name}", value: "${e.value}"){
          name,
          value
        }
      }`;return pe({query:l})},delete:e=>{e=Object.fromEntries(e.entries());const l=`
      mutation {
        constant_unset(name: "${e.name}"){
          name
        }
      }
    `;return pe({query:l})}};function Se(e,l,n){const u=e.slice();return u[13]=l[n],u[14]=l,u[15]=n,u}function Le(e){let l,n,u="Clear filter",E,$,T,c,M;return $=new de({props:{icon:"x",size:"12"}}),{c(){l=d("button"),n=d("span"),n.textContent=u,E=k(),ue($.$$.fragment),this.h()},l(y){l=_(y,"BUTTON",{class:!0});var p=D(l);n=_(p,"SPAN",{class:!0,"data-svelte-h":!0}),ae(n)!=="svelte-1bu6mgu"&&(n.textContent=u),E=F(p),fe($.$$.fragment,p),p.forEach(g),this.h()},h(){s(n,"class","label svelte-9flr1b"),s(l,"class","clearFilter svelte-9flr1b")},m(y,p){Y(y,l,p),a(l,n),a(l,E),ce($,l,null),T=!0,c||(M=ee(l,"click",e[8]),c=!0)},p:qe,i(y){T||(R($.$$.fragment,y),T=!0)},o(y){G($.$$.fragment,y),T=!1},d(y){y&&g(l),me($),c=!1,M()}}}function ke(e){let l,n,u,E,$,T,c,M="Delete constant",y,p,O,w,q,P=e[13].name+"",U,o,h,f,J,H,B,v,j,V,Q,b,N,i,X=e[13].exposed?"Hide value":"Show value",t,m,r,I,te,S,le="Save",se,Z,L,_e,ge;p=new de({props:{icon:"x",size:"14"}});function Oe(){return e[10](e[13],e[14],e[15])}r=new de({props:{icon:e[13].exposed?"eyeStriked":"eye"}});function Ae(){return e[11](e[13],e[14],e[15])}function De(...A){return e[12](e[15],...A)}return{c(){l=d("li"),n=d("form"),u=d("input"),$=k(),T=d("button"),c=d("span"),c.textContent=M,y=k(),ue(p.$$.fragment),O=k(),w=d("form"),q=d("label"),U=he(P),h=k(),f=d("input"),H=k(),B=d("fieldset"),v=d("input"),b=k(),N=d("button"),i=d("span"),t=he(X),m=k(),ue(r.$$.fragment),te=k(),S=d("button"),S.textContent=le,se=k(),this.h()},l(A){l=_(A,"LI",{class:!0});var C=D(l);n=_(C,"FORM",{class:!0});var x=D(n);u=_(x,"INPUT",{type:!0,name:!0,class:!0}),$=F(x),T=_(x,"BUTTON",{type:!0,title:!0,class:!0});var re=D(T);c=_(re,"SPAN",{class:!0,"data-svelte-h":!0}),ae(c)!=="svelte-1p7u8ms"&&(c.textContent=M),y=F(re),fe(p.$$.fragment,re),re.forEach(g),x.forEach(g),O=F(C),w=_(C,"FORM",{class:!0});var K=D(w);q=_(K,"LABEL",{for:!0,class:!0});var Ee=D(q);U=ve(Ee,P),Ee.forEach(g),h=F(K),f=_(K,"INPUT",{type:!0,name:!0,class:!0}),H=F(K),B=_(K,"FIELDSET",{class:!0});var oe=D(B);v=_(oe,"INPUT",{name:!0,id:!0,class:!0}),b=F(oe),N=_(oe,"BUTTON",{type:!0,class:!0,title:!0});var ie=D(N);i=_(ie,"SPAN",{class:!0});var $e=D(i);t=ve($e,X),$e.forEach(g),m=F(ie),fe(r.$$.fragment,ie),ie.forEach(g),oe.forEach(g),te=F(K),S=_(K,"BUTTON",{type:!0,class:!0,"data-svelte-h":!0}),ae(S)!=="svelte-1g3xn8h"&&(S.textContent=le),K.forEach(g),se=F(C),C.forEach(g),this.h()},h(){s(u,"type","hidden"),s(u,"name","name"),u.value=E=e[13].name,s(u,"class","svelte-9flr1b"),s(c,"class","label svelte-9flr1b"),s(T,"type","submit"),s(T,"title","Delete constant"),s(T,"class","svelte-9flr1b"),s(n,"class","delete svelte-9flr1b"),s(q,"for",o=e[13].name),s(q,"class","svelte-9flr1b"),s(f,"type","hidden"),s(f,"name","name"),f.value=J=e[13].name,s(f,"class","svelte-9flr1b"),v.disabled=j=!e[13].exposed,s(v,"name","value"),v.value=V=e[13].value,s(v,"id",Q=e[13].name),s(v,"class","svelte-9flr1b"),W(v,"exposed",e[13].exposed),s(i,"class","label svelte-9flr1b"),s(N,"type","button"),s(N,"class","toggleExposition svelte-9flr1b"),s(N,"title",I=e[13].exposed?"Hide value":"Show value"),s(B,"class","svelte-9flr1b"),s(S,"type","submit"),s(S,"class","button svelte-9flr1b"),W(S,"needed",e[1][e[15]].changed),s(w,"class","edit svelte-9flr1b"),s(l,"class","svelte-9flr1b"),W(l,"hidden",e[0]&&e[3](e[13])),W(l,"highlighted",e[2].highlighted.constant===e[13].name)},m(A,C){Y(A,l,C),a(l,n),a(n,u),a(n,$),a(n,T),a(T,c),a(T,y),ce(p,T,null),a(l,O),a(l,w),a(w,q),a(q,U),a(w,h),a(w,f),a(w,H),a(w,B),a(B,v),a(B,b),a(B,N),a(N,i),a(i,t),a(N,m),ce(r,N,null),a(w,te),a(w,S),a(l,se),L=!0,_e||(ge=[ee(n,"submit",be(e[9])),ee(v,"input",Oe),ee(N,"click",Ae),ee(w,"submit",be(De))],_e=!0)},p(A,C){e=A,(!L||C&2&&E!==(E=e[13].name))&&(u.value=E),(!L||C&2)&&P!==(P=e[13].name+"")&&Ce(U,P),(!L||C&2&&o!==(o=e[13].name))&&s(q,"for",o),(!L||C&2&&J!==(J=e[13].name))&&(f.value=J),(!L||C&2&&j!==(j=!e[13].exposed))&&(v.disabled=j),(!L||C&2&&V!==(V=e[13].value)&&v.value!==V)&&(v.value=V),(!L||C&2&&Q!==(Q=e[13].name))&&s(v,"id",Q),(!L||C&2)&&W(v,"exposed",e[13].exposed),(!L||C&2)&&X!==(X=e[13].exposed?"Hide value":"Show value")&&Ce(t,X);const x={};C&2&&(x.icon=e[13].exposed?"eyeStriked":"eye"),r.$set(x),(!L||C&2&&I!==(I=e[13].exposed?"Hide value":"Show value"))&&s(N,"title",I),(!L||C&2)&&W(S,"needed",e[1][e[15]].changed),(!L||C&11)&&W(l,"hidden",e[0]&&e[3](e[13])),(!L||C&6)&&W(l,"highlighted",e[2].highlighted.constant===e[13].name)},i(A){L||(R(p.$$.fragment,A),R(r.$$.fragment,A),A&&(Z||He(()=>{Z=je(l,Ve,{duration:100,delay:10*e[15]}),Z.start()})),L=!0)},o(A){G(p.$$.fragment,A),G(r.$$.fragment,A),L=!1},d(A){A&&g(l),me(p),me(r),_e=!1,Fe(ge)}}}function ze(e){let l,n,u,E,$="Find:",T,c,M,y,p,O,w,q='<label for="newName" class="svelte-9flr1b">Name</label> <input type="text" name="name" id="newName" placeholder="MY_NEW_CONSTANT" class="svelte-9flr1b"/>',P,U,o='<label for="newValue" class="svelte-9flr1b">Value</label> <input type="text" name="value" id="newValue" class="svelte-9flr1b"/>',h,f,J,H,B,v,j,V,Q,b=e[0]&&Le(e);H=new de({props:{icon:"arrowRight"}});let N=Ne(e[1]),i=[];for(let t=0;t<N.length;t+=1)i[t]=ke(Se(e,N,t));const X=t=>G(i[t],1,1,()=>{i[t]=null});return{c(){l=k(),n=d("nav"),u=d("form"),E=d("label"),E.textContent=$,T=k(),c=d("input"),M=k(),b&&b.c(),y=k(),p=d("section"),O=d("form"),w=d("fieldset"),w.innerHTML=q,P=k(),U=d("fieldset"),U.innerHTML=o,h=k(),f=d("button"),J=he(`Add\r
      `),ue(H.$$.fragment),B=k(),v=d("ul");for(let t=0;t<i.length;t+=1)i[t].c();this.h()},l(t){Ue("svelte-147nas7",document.head).forEach(g),l=F(t),n=_(t,"NAV",{class:!0});var r=D(n);u=_(r,"FORM",{});var I=D(u);E=_(I,"LABEL",{for:!0,"data-svelte-h":!0}),ae(E)!=="svelte-1otrvr9"&&(E.textContent=$),T=F(I),c=_(I,"INPUT",{type:!0,id:!0,class:!0}),M=F(I),b&&b.l(I),I.forEach(g),r.forEach(g),y=F(t),p=_(t,"SECTION",{class:!0});var te=D(p);O=_(te,"FORM",{class:!0});var S=D(O);w=_(S,"FIELDSET",{class:!0,"data-svelte-h":!0}),ae(w)!=="svelte-7bz5qn"&&(w.innerHTML=q),P=F(S),U=_(S,"FIELDSET",{class:!0,"data-svelte-h":!0}),ae(U)!=="svelte-ceosvb"&&(U.innerHTML=o),h=F(S),f=_(S,"BUTTON",{class:!0});var le=D(f);J=ve(le,`Add\r
      `),fe(H.$$.fragment,le),le.forEach(g),S.forEach(g),te.forEach(g),B=F(t),v=_(t,"UL",{class:!0});var se=D(v);for(let Z=0;Z<i.length;Z+=1)i[Z].l(se);se.forEach(g),this.h()},h(){document.title="Constants | platformOS",s(E,"for","filter"),s(c,"type","text"),s(c,"id","filter"),c.autofocus=!0,s(c,"class","svelte-9flr1b"),s(n,"class","svelte-9flr1b"),s(w,"class","svelte-9flr1b"),s(U,"class","svelte-9flr1b"),s(f,"class","button svelte-9flr1b"),s(O,"class","svelte-9flr1b"),s(p,"class","create svelte-9flr1b"),s(v,"class","svelte-9flr1b")},m(t,m){Y(t,l,m),Y(t,n,m),a(n,u),a(u,E),a(u,T),a(u,c),we(c,e[0]),a(u,M),b&&b.m(u,null),Y(t,y,m),Y(t,p,m),a(p,O),a(O,w),a(O,P),a(O,U),a(O,h),a(O,f),a(f,J),ce(H,f,null),Y(t,B,m),Y(t,v,m);for(let r=0;r<i.length;r+=1)i[r]&&i[r].m(v,null);j=!0,c.focus(),V||(Q=[ee(c,"input",e[7]),ee(O,"submit",be(e[6]))],V=!0)},p(t,[m]){if(m&1&&c.value!==t[0]&&we(c,t[0]),t[0]?b?(b.p(t,m),m&1&&R(b,1)):(b=Le(t),b.c(),R(b,1),b.m(u,null)):b&&(ye(),G(b,1,1,()=>{b=null}),Te()),m&63){N=Ne(t[1]);let r;for(r=0;r<N.length;r+=1){const I=Se(t,N,r);i[r]?(i[r].p(I,m),R(i[r],1)):(i[r]=ke(I),i[r].c(),R(i[r],1),i[r].m(v,null))}for(ye(),r=N.length;r<i.length;r+=1)X(r);Te()}},i(t){if(!j){R(b),R(H.$$.fragment,t);for(let m=0;m<N.length;m+=1)R(i[m]);j=!0}},o(t){G(b),G(H.$$.fragment,t),i=i.filter(Boolean);for(let m=0;m<i.length;m+=1)G(i[m]);j=!1},d(t){t&&(g(l),g(n),g(y),g(p),g(B),g(v)),b&&b.d(),me(H),Be(i,t),V=!1,Fe(Q)}}}function Je(e,l,n){let u;Me(e,z,o=>n(2,u=o));let E="",$=[];(async()=>await ne.get())().then(o=>{n(1,$=o)});const T=o=>o.name.toLowerCase().indexOf(E.toLowerCase())===-1&&o.value.toLowerCase().indexOf(E.toLowerCase())===-1,c=async(o,h)=>{o.preventDefault();const f=await ne.edit(new FormData(o.target));f.errors?z.notification.create("error",`Failed to update ${f.constant_set.name} constant`):(n(1,$[h].changed=!1,$),z.highlight("constant",f.constant_set.name),z.notification.create("success",`Constant ${f.constant_set.name} updated`))},M=async o=>{if(o.preventDefault(),confirm("Are you sure you want to delete this constant?")){const h=await ne.delete(new FormData(o.target));h.errors?z.notification.create("success",`Failed to delete ${h.constant_unset.name} constant`):(z.notification.create("success",`Constant ${h.constant_unset.name} deleted`),await ne.get().then(f=>{n(1,$=f)}))}},y=async o=>{o.preventDefault();const h=await ne.edit(new FormData(o.target));h.errors?z.notification.create("error",`Failed to create ${h.constant_set.name} constant`):(o.target.reset(),z.notification.create("success",`Constant ${h.constant_set.name} created`),await ne.get().then(f=>{n(1,$=f),z.highlight("constant",h.constant_set.name)}))};function p(){E=this.value,n(0,E)}return[E,$,u,T,c,M,y,p,()=>n(0,E=""),o=>M(o),(o,h,f)=>n(1,h[f].changed=!0,$),(o,h,f)=>n(1,h[f].exposed=!o.exposed,$),(o,h)=>c(h,o)]}class xe extends Pe{constructor(l){super(),Re(this,l,Je,ze,Ie,{})}}export{xe as component};
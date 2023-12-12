import{s as X,a as D,f as v,J as Z,d as u,c as L,g as b,h as E,r as $,j as m,i as O,u as h,v as x,o as ee,N as te,l as C,m as H,w as y,n as I,D as se,E as ae,F as le,G as re,p as ie}from"../chunks/scheduler.a497d5ec.js";import{S as oe,i as ne,a as M,t as B,c as fe,g as _e}from"../chunks/index.ca999c64.js";import{e as Y}from"../chunks/each.1577bad0.js";import{p as ce}from"../chunks/stores.61a7abf8.js";import{l as he}from"../chunks/logsv2.af5aa2f9.js";import"../chunks/state.8992c65b.js";function K(l,s,a){const e=l.slice();return e[7]=s[a],e}function Q(l){let s,a=Y(l[2].hits),e=[];for(let t=0;t<a.length;t+=1)e[t]=U(K(l,a,t));return{c(){s=v("tbody");for(let t=0;t<e.length;t+=1)e[t].c()},l(t){s=b(t,"TBODY",{});var o=E(s);for(let r=0;r<e.length;r+=1)e[r].l(o);o.forEach(u)},m(t,o){O(t,s,o);for(let r=0;r<e.length;r+=1)e[r]&&e[r].m(s,null)},p(t,o){if(o&13){a=Y(t[2].hits);let r;for(r=0;r<a.length;r+=1){const g=K(t,a,r);e[r]?e[r].p(g,o):(e[r]=U(g),e[r].c(),e[r].m(s,null))}for(;r<e.length;r+=1)e[r].d(1);e.length=a.length}},d(t){t&&u(s),te(e,t)}}}function U(l){let s,a,e,t=new Date(l[7].options_at/1e3).toLocaleString()+"",o,r,g,d,p,i=l[7].type+"",n,f,q,S,T,k,P=l[7].message+"",A,w,j;return{c(){s=v("tr"),a=v("td"),e=v("a"),o=C(t),g=D(),d=v("td"),p=v("a"),n=C(i),q=D(),S=v("td"),T=v("a"),k=v("div"),A=C(P),j=D(),this.h()},l(_){s=b(_,"TR",{class:!0});var c=E(s);a=b(c,"TD",{class:!0});var N=E(a);e=b(N,"A",{href:!0});var V=E(e);o=H(V,t),V.forEach(u),N.forEach(u),g=L(c),d=b(c,"TD",{class:!0});var z=E(d);p=b(z,"A",{href:!0});var F=E(p);n=H(F,i),F.forEach(u),z.forEach(u),q=L(c),S=b(c,"TD",{class:!0});var G=E(S);T=b(G,"A",{href:!0,class:!0});var J=E(T);k=b(J,"DIV",{class:!0});var R=E(k);A=H(R,P),R.forEach(u),J.forEach(u),G.forEach(u),j=L(c),c.forEach(u),this.h()},h(){m(e,"href",r="/logsv2/"+l[7]._timestamp+"?"+l[0].url.searchParams.toString()),m(a,"class","time svelte-1biq2ts"),m(p,"href",f="/logsv2/"+l[7]._timestamp+"?"+l[0].url.searchParams.toString()),m(d,"class","type svelte-1biq2ts"),m(k,"class","svelte-1biq2ts"),m(T,"href",w="/logsv2/"+l[7]._timestamp+"?"+l[0].url.searchParams.toString()),m(T,"class","svelte-1biq2ts"),m(S,"class","message svelte-1biq2ts"),m(s,"class","svelte-1biq2ts"),y(s,"error",l[7].type.match(/error/i)),y(s,"highlight",l[3].key==l[7]._timestamp),y(s,"active",l[0].params.id==l[7]._timestamp)},m(_,c){O(_,s,c),h(s,a),h(a,e),h(e,o),h(s,g),h(s,d),h(d,p),h(p,n),h(s,q),h(s,S),h(S,T),h(T,k),h(k,A),h(s,j)},p(_,c){c&4&&t!==(t=new Date(_[7].options_at/1e3).toLocaleString()+"")&&I(o,t),c&5&&r!==(r="/logsv2/"+_[7]._timestamp+"?"+_[0].url.searchParams.toString())&&m(e,"href",r),c&4&&i!==(i=_[7].type+"")&&I(n,i),c&5&&f!==(f="/logsv2/"+_[7]._timestamp+"?"+_[0].url.searchParams.toString())&&m(p,"href",f),c&4&&P!==(P=_[7].message+"")&&I(A,P),c&5&&w!==(w="/logsv2/"+_[7]._timestamp+"?"+_[0].url.searchParams.toString())&&m(T,"href",w),c&4&&y(s,"error",_[7].type.match(/error/i)),c&12&&y(s,"highlight",_[3].key==_[7]._timestamp),c&5&&y(s,"active",_[0].params.id==_[7]._timestamp)},d(_){_&&u(s)}}}function W(l){let s;const a=l[5].default,e=se(a,l,l[4],null);return{c(){e&&e.c()},l(t){e&&e.l(t)},m(t,o){e&&e.m(t,o),s=!0},p(t,o){e&&e.p&&(!s||o&16)&&ae(e,a,t,t[4],s?re(a,t[4],o,null):le(t[4]),null)},i(t){s||(M(e,t),s=!0)},o(t){B(e,t),s=!1},d(t){e&&e.d(t)}}}function ue(l){let s,a,e,t,o,r='<tr><th class="svelte-1biq2ts">Time</th> <th class="svelte-1biq2ts">Type</th> <th class="message svelte-1biq2ts">Message</th></tr>',g,d,p,i=l[2]&&Q(l),n=l[0].params.id&&W(l);return{c(){s=D(),a=v("div"),e=v("section"),t=v("table"),o=v("thead"),o.innerHTML=r,g=D(),i&&i.c(),d=D(),n&&n.c(),this.h()},l(f){Z("svelte-1xj5d21",document.head).forEach(u),s=L(f),a=b(f,"DIV",{class:!0});var S=E(a);e=b(S,"SECTION",{class:!0});var T=E(e);t=b(T,"TABLE",{class:!0});var k=E(t);o=b(k,"THEAD",{class:!0,"data-svelte-h":!0}),$(o)!=="svelte-1hz51lg"&&(o.innerHTML=r),g=L(k),i&&i.l(k),k.forEach(u),T.forEach(u),d=L(S),n&&n.l(S),S.forEach(u),this.h()},h(){document.title="Logs | platformOS",m(o,"class","svelte-1biq2ts"),m(t,"class","svelte-1biq2ts"),m(e,"class","logs svelte-1biq2ts"),m(a,"class","container svelte-1biq2ts")},m(f,q){O(f,s,q),O(f,a,q),h(a,e),h(e,t),h(t,o),h(t,g),i&&i.m(t,null),h(a,d),n&&n.m(a,null),l[6](a),p=!0},p(f,[q]){f[2]?i?i.p(f,q):(i=Q(f),i.c(),i.m(t,null)):i&&(i.d(1),i=null),f[0].params.id?n?(n.p(f,q),q&1&&M(n,1)):(n=W(f),n.c(),M(n,1),n.m(a,null)):n&&(_e(),B(n,1,1,()=>{n=null}),fe())},i(f){p||(M(n),p=!0)},o(f){B(n),p=!1},d(f){f&&(u(s),u(a)),i&&i.d(),n&&n.d(),l[6](null)}}}function me(l,s,a){let e;x(l,ce,i=>a(0,e=i));let{$$slots:t={},$$scope:o}=s,r,g,d={};ee(async()=>{a(2,g=await he.get(d))});function p(i){ie[i?"unshift":"push"](()=>{r=i,a(1,r)})}return l.$$set=i=>{"$$scope"in i&&a(4,o=i.$$scope)},l.$$.update=()=>{l.$$.dirty&1&&a(3,d=Object.fromEntries(e.url.searchParams))},[e,r,g,d,o,t,p]}class qe extends oe{constructor(s){super(),ne(this,s,me,ue,X,{})}}export{qe as component};

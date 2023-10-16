import{s as Ze,a as w,f as m,I as xe,d as _,c as S,g,h as $,r as le,j as c,i as F,u,J as ye,x as te,y as Ge,v as et,V as tt,b as lt,o as st,A as me,M as Ke,l as H,m as G,w as ne,R as nt,n as X,B as at,t as rt,z as Ne,p as it,e as $e}from"../chunks/scheduler.e2aa1391.js";import{S as ot,i as ft,b as ie,d as oe,m as fe,a as T,t as A,c as ae,e as ue,g as re,h as ut}from"../chunks/index.12b5c620.js";import{g as ct}from"../chunks/globals.7f7f1b26.js";import{e as Ee}from"../chunks/each.c0161bb5.js";import{f as _t}from"../chunks/index.ad4c134d.js";import{s as Te}from"../chunks/state.f2691bd0.js";import{t as Qe}from"../chunks/tryParseJSON.f125f883.js";import{J as We}from"../chunks/JSONTree.ba3a721c.js";import{I as ge}from"../chunks/Icon.a5fa4953.js";import{A as dt}from"../chunks/Aside.48de29ae.js";const{document:Ie}=ct;function Oe(a,e,s){const t=a.slice();t[21]=e[s],t[23]=e,t[24]=s;const l=t[21].message.length<262144&&Qe(t[21].message);return t[22]=l,t}function Pe(a,e,s){const t=a.slice();t[21]=e[s],t[25]=e,t[26]=s;const l=t[21].message.length<262144&&Qe(t[21].message);return t[22]=l,t}function Ue(a){let e,s,t="Clear filter",l,r,n,i,o;return r=new ge({props:{icon:"x",size:"12"}}),{c(){e=m("button"),s=m("span"),s.textContent=t,l=w(),ie(r.$$.fragment),this.h()},l(f){e=g(f,"BUTTON",{class:!0});var h=$(e);s=g(h,"SPAN",{class:!0,"data-svelte-h":!0}),le(s)!=="svelte-1bu6mgu"&&(s.textContent=t),l=S(h),oe(r.$$.fragment,h),h.forEach(_),this.h()},h(){c(s,"class","label svelte-125ig35"),c(e,"class","clearFilter svelte-125ig35")},m(f,h){F(f,e,h),u(e,s),u(e,l),fe(r,e,null),n=!0,i||(o=te(e,"click",a[9]),i=!0)},p:me,i(f){n||(T(r.$$.fragment,f),n=!0)},o(f){A(r.$$.fragment,f),n=!1},d(f){f&&_(e),ue(r),i=!1,o()}}}function Be(a){let e,s,t=Ee(a[4].logs.logs),l=[];for(let n=0;n<t.length;n+=1)l[n]=je(Pe(a,t,n));const r=n=>A(l[n],1,1,()=>{l[n]=null});return{c(){e=m("table");for(let n=0;n<l.length;n+=1)l[n].c();this.h()},l(n){e=g(n,"TABLE",{class:!0});var i=$(e);for(let o=0;o<l.length;o+=1)l[o].l(i);i.forEach(_),this.h()},h(){c(e,"class","svelte-125ig35")},m(n,i){F(n,e,i);for(let o=0;o<l.length;o+=1)l[o]&&l[o].m(e,null);s=!0},p(n,i){if(i&118){t=Ee(n[4].logs.logs);let o;for(o=0;o<t.length;o+=1){const f=Pe(n,t,o);l[o]?(l[o].p(f,i),T(l[o],1)):(l[o]=je(f),l[o].c(),T(l[o],1),l[o].m(e,null))}for(re(),o=t.length;o<l.length;o+=1)r(o);ae()}},i(n){if(!s){for(let i=0;i<t.length;i+=1)T(l[i]);s=!0}},o(n){l=l.filter(Boolean);for(let i=0;i<l.length;i+=1)A(l[i]);s=!1},d(n){n&&_(e),Ke(l,n)}}}function ht(a){let e;function s(r,n){return r[21].showFull?pt:gt}let t=s(a),l=t(a);return{c(){e=m("div"),l.c(),this.h()},l(r){e=g(r,"DIV",{class:!0});var n=$(e);l.l(n),n.forEach(_),this.h()},h(){c(e,"class","pre svelte-125ig35")},m(r,n){F(r,e,n),l.m(e,null)},p(r,n){t===(t=s(r))&&l?l.p(r,n):(l.d(1),l=t(r),l&&(l.c(),l.m(e,null)))},i:me,o:me,d(r){r&&_(e),l.d()}}}function mt(a){let e,s;return e=new We({props:{value:a[22],showFullLines:!0}}),{c(){ie(e.$$.fragment)},l(t){oe(e.$$.fragment,t)},m(t,l){fe(e,t,l),s=!0},p(t,l){const r={};l&16&&(r.value=t[22]),e.$set(r)},i(t){s||(T(e.$$.fragment,t),s=!0)},o(t){A(e.$$.fragment,t),s=!1},d(t){ue(e,t)}}}function gt(a){let e=a[21].message.substr(0,ee)+"",s,t,l,r=a[21].message.length>ee&&Ve(a);return{c(){s=H(e),t=w(),r&&r.c(),l=$e()},l(n){s=G(n,e),t=S(n),r&&r.l(n),l=$e()},m(n,i){F(n,s,i),F(n,t,i),r&&r.m(n,i),F(n,l,i)},p(n,i){i&16&&e!==(e=n[21].message.substr(0,ee)+"")&&X(s,e),n[21].message.length>ee?r?r.p(n,i):(r=Ve(n),r.c(),r.m(l.parentNode,l)):r&&(r.d(1),r=null)},d(n){n&&(_(s),_(t),_(l)),r&&r.d(n)}}}function pt(a){let e=a[21].message+"",s;return{c(){s=H(e)},l(t){s=G(t,e)},m(t,l){F(t,s,l)},p(t,l){l&16&&e!==(e=t[21].message+"")&&X(s,e)},d(t){t&&_(s)}}}function Ve(a){let e,s,t=a[21].message.length-ee+"",l,r,n,i;function o(){return a[11](a[21],a[25],a[26])}return{c(){e=m("div"),s=m("button"),l=H(t),r=H(" more characters"),this.h()},l(f){e=g(f,"DIV",{class:!0});var h=$(e);s=g(h,"BUTTON",{type:!0,class:!0});var b=$(s);l=G(b,t),r=G(b," more characters"),b.forEach(_),h.forEach(_),this.h()},h(){c(s,"type","button"),c(s,"class","svelte-125ig35"),c(e,"class","longStringInfo svelte-125ig35")},m(f,h){F(f,e,h),u(e,s),u(s,l),u(s,r),n||(i=te(s,"click",o),n=!0)},p(f,h){a=f,h&16&&t!==(t=a[21].message.length-ee+"")&&X(l,t)},d(f){f&&_(e),n=!1,i()}}}function Ae(a){let e,s,t,l=a[21].data.url+"",r,n,i=a[21].data.user&&Fe(a);return{c(){e=m("ul"),s=m("li"),t=H("Page: "),r=H(l),n=w(),i&&i.c(),this.h()},l(o){e=g(o,"UL",{class:!0});var f=$(e);s=g(f,"LI",{});var h=$(s);t=G(h,"Page: "),r=G(h,l),h.forEach(_),n=S(f),i&&i.l(f),f.forEach(_),this.h()},h(){c(e,"class","info svelte-125ig35")},m(o,f){F(o,e,f),u(e,s),u(s,t),u(s,r),u(e,n),i&&i.m(e,null)},p(o,f){f&16&&l!==(l=o[21].data.url+"")&&X(r,l),o[21].data.user?i?i.p(o,f):(i=Fe(o),i.c(),i.m(e,null)):i&&(i.d(1),i=null)},d(o){o&&_(e),i&&i.d()}}}function Fe(a){let e,s,t,l=a[21].data.user.id+"",r,n;return{c(){e=m("li"),s=H("User ID: "),t=m("a"),r=H(l),this.h()},l(i){e=g(i,"LI",{});var o=$(e);s=G(o,"User ID: "),t=g(o,"A",{href:!0,class:!0});var f=$(t);r=G(f,l),f.forEach(_),o.forEach(_),this.h()},h(){c(t,"href",n="/users/"+a[21].data.user.id),c(t,"class","svelte-125ig35")},m(i,o){F(i,e,o),u(e,s),u(e,t),u(t,r)},p(i,o){o&16&&l!==(l=i[21].data.user.id+"")&&X(r,l),o&16&&n!==(n="/users/"+i[21].data.user.id)&&c(t,"href",n)},d(i){i&&_(e)}}}function je(a){var Se;let e,s,t,l=new Date(a[21].created_at).toLocaleDateString(void 0,{})+"",r,n,i=new Date(a[21].created_at).toLocaleTimeString(void 0,{})+"",o,f,h,b,L=a[21].error_type+"",J,x,B,E,D,K,j,C,R,I,d,U="Copy message",Y,y,N,p,O,P="Pin this log",v,k,Q,q,M,Z,ce;const _e=[mt,ht],se=[];function Ce(z,V){return z[22]?0:1}E=Ce(a),D=se[E]=_e[E](a);let W=((Se=a[21].data)==null?void 0:Se.url)&&Ae(a);y=new ge({props:{icon:"copy"}});function Xe(...z){return a[12](a[21],...z)}k=new ge({props:{icon:"pin"}});function Ye(){return a[13](a[21])}function we(...z){return a[14](a[21],...z)}return{c(){e=m("tr"),s=m("td"),t=m("time"),r=H(l),n=w(),o=H(i),h=w(),b=m("td"),J=H(L),x=w(),B=m("td"),D.c(),K=w(),W&&W.c(),j=w(),C=m("td"),R=m("div"),I=m("button"),d=m("span"),d.textContent=U,Y=w(),ie(y.$$.fragment),N=w(),p=m("button"),O=m("span"),O.textContent=P,v=w(),ie(k.$$.fragment),Q=w(),this.h()},l(z){e=g(z,"TR",{class:!0});var V=$(e);s=g(V,"TD",{class:!0});var he=$(s);t=g(he,"TIME",{datetime:!0,class:!0});var de=$(t);r=G(de,l),n=S(de),o=G(de,i),de.forEach(_),he.forEach(_),h=S(V),b=g(V,"TD",{class:!0});var Le=$(b);J=G(Le,L),Le.forEach(_),x=S(V),B=g(V,"TD",{class:!0});var pe=$(B);D.l(pe),K=S(pe),W&&W.l(pe),pe.forEach(_),j=S(V),C=g(V,"TD",{class:!0});var De=$(C);R=g(De,"DIV",{class:!0});var ve=$(R);I=g(ve,"BUTTON",{type:!0,class:!0,title:!0});var be=$(I);d=g(be,"SPAN",{class:!0,"data-svelte-h":!0}),le(d)!=="svelte-1qjln59"&&(d.textContent=U),Y=S(be),oe(y.$$.fragment,be),be.forEach(_),N=S(ve),p=g(ve,"BUTTON",{type:!0,class:!0,title:!0});var ke=$(p);O=g(ke,"SPAN",{class:!0,"data-svelte-h":!0}),le(O)!=="svelte-yzd8i4"&&(O.textContent=P),v=S(ke),oe(k.$$.fragment,ke),ke.forEach(_),ve.forEach(_),De.forEach(_),Q=S(V),V.forEach(_),this.h()},h(){c(t,"datetime",f=a[21].created_at),c(t,"class","svelte-125ig35"),c(s,"class","date svelte-125ig35"),c(b,"class","logType svelte-125ig35"),c(B,"class","message svelte-125ig35"),c(d,"class","label"),c(I,"type","button"),c(I,"class","button svelte-125ig35"),c(I,"title","Copy message"),c(O,"class","label"),c(p,"type","button"),c(p,"class","button svelte-125ig35"),c(p,"title","Pin this log"),ne(p,"active",a[2].find(we)),c(R,"class","svelte-125ig35"),c(C,"class","actions svelte-125ig35"),c(e,"class","svelte-125ig35"),ne(e,"hidden",a[1]&&a[5](a[21])||a[21].hidden),ne(e,"error",a[21].error_type.match(/error/i)),ne(e,"fresh",a[21].downloaded_at>a[4].logs.downloaded_at[0])},m(z,V){F(z,e,V),u(e,s),u(s,t),u(t,r),u(t,n),u(t,o),u(e,h),u(e,b),u(b,J),u(e,x),u(e,B),se[E].m(B,null),u(B,K),W&&W.m(B,null),u(e,j),u(e,C),u(C,R),u(R,I),u(I,d),u(I,Y),fe(y,I,null),u(R,N),u(R,p),u(p,O),u(p,v),fe(k,p,null),u(e,Q),M=!0,Z||(ce=[te(I,"click",Xe),te(p,"click",nt(Ye))],Z=!0)},p(z,V){var de;a=z,(!M||V&16)&&l!==(l=new Date(a[21].created_at).toLocaleDateString(void 0,{})+"")&&X(r,l),(!M||V&16)&&i!==(i=new Date(a[21].created_at).toLocaleTimeString(void 0,{})+"")&&X(o,i),(!M||V&16&&f!==(f=a[21].created_at))&&c(t,"datetime",f),(!M||V&16)&&L!==(L=a[21].error_type+"")&&X(J,L);let he=E;E=Ce(a),E===he?se[E].p(a,V):(re(),A(se[he],1,1,()=>{se[he]=null}),ae(),D=se[E],D?D.p(a,V):(D=se[E]=_e[E](a),D.c()),T(D,1),D.m(B,K)),(de=a[21].data)!=null&&de.url?W?W.p(a,V):(W=Ae(a),W.c(),W.m(B,null)):W&&(W.d(1),W=null),(!M||V&20)&&ne(p,"active",a[2].find(we)),(!M||V&50)&&ne(e,"hidden",a[1]&&a[5](a[21])||a[21].hidden),(!M||V&16)&&ne(e,"error",a[21].error_type.match(/error/i)),(!M||V&16)&&ne(e,"fresh",a[21].downloaded_at>a[4].logs.downloaded_at[0])},i(z){M||(T(D),T(y.$$.fragment,z),T(k.$$.fragment,z),z&&(q||at(()=>{q=ut(e,_t,{duration:200}),q.start()})),M=!0)},o(z){A(D),A(y.$$.fragment,z),A(k.$$.fragment,z),M=!1},d(z){z&&_(e),se[E].d(),W&&W.d(),ue(y),ue(k),Z=!1,Ge(ce)}}}function Me(a){let e,s="No newer logs to show<br/>Checking every 3 seconds";return{c(){e=m("footer"),e.innerHTML=s,this.h()},l(t){e=g(t,"FOOTER",{class:!0,"data-svelte-h":!0}),le(e)!=="svelte-akhvzo"&&(e.innerHTML=s),this.h()},h(){c(e,"class","svelte-125ig35")},m(t,l){F(t,e,l)},d(t){t&&_(e)}}}function ze(a){let e,s;return e=new dt({props:{$$slots:{default:[Et]},$$scope:{ctx:a}}}),{c(){ie(e.$$.fragment)},l(t){oe(e.$$.fragment,t)},m(t,l){fe(e,t,l),s=!0},p(t,l){const r={};l&134217732&&(r.$$scope={dirty:l,ctx:t}),e.$set(r)},i(t){s||(T(e.$$.fragment,t),s=!0)},o(t){A(e.$$.fragment,t),s=!1},d(t){ue(e,t)}}}function Je(a){let e,s,t=Ee(a[2]),l=[];for(let n=0;n<t.length;n+=1)l[n]=He(Oe(a,t,n));const r=n=>A(l[n],1,1,()=>{l[n]=null});return{c(){e=m("ul");for(let n=0;n<l.length;n+=1)l[n].c()},l(n){e=g(n,"UL",{});var i=$(e);for(let o=0;o<l.length;o+=1)l[o].l(i);i.forEach(_)},m(n,i){F(n,e,i);for(let o=0;o<l.length;o+=1)l[o]&&l[o].m(e,null);s=!0},p(n,i){if(i&68){t=Ee(n[2]);let o;for(o=0;o<t.length;o+=1){const f=Oe(n,t,o);l[o]?(l[o].p(f,i),T(l[o],1)):(l[o]=He(f),l[o].c(),T(l[o],1),l[o].m(e,null))}for(re(),o=t.length;o<l.length;o+=1)r(o);ae()}},i(n){if(!s){for(let i=0;i<t.length;i+=1)T(l[i]);s=!0}},o(n){l=l.filter(Boolean);for(let i=0;i<l.length;i+=1)A(l[i]);s=!1},d(n){n&&_(e),Ke(l,n)}}}function Re(a){let e,s=a[21].data.url+"",t;return{c(){e=m("div"),t=H(s),this.h()},l(l){e=g(l,"DIV",{class:!0});var r=$(e);t=G(r,s),r.forEach(_),this.h()},h(){c(e,"class","url svelte-125ig35")},m(l,r){F(l,e,r),u(e,t)},p(l,r){r&4&&s!==(s=l[21].data.url+"")&&X(t,s)},d(l){l&&_(e)}}}function vt(a){let e;function s(r,n){return r[21].showFull?$t:kt}let t=s(a),l=t(a);return{c(){e=m("div"),l.c(),this.h()},l(r){e=g(r,"DIV",{class:!0});var n=$(e);l.l(n),n.forEach(_),this.h()},h(){c(e,"class","pre svelte-125ig35")},m(r,n){F(r,e,n),l.m(e,null)},p(r,n){t===(t=s(r))&&l?l.p(r,n):(l.d(1),l=t(r),l&&(l.c(),l.m(e,null)))},i:me,o:me,d(r){r&&_(e),l.d()}}}function bt(a){let e,s;return e=new We({props:{value:a[22],showFullLines:!0}}),{c(){ie(e.$$.fragment)},l(t){oe(e.$$.fragment,t)},m(t,l){fe(e,t,l),s=!0},p(t,l){const r={};l&4&&(r.value=t[22]),e.$set(r)},i(t){s||(T(e.$$.fragment,t),s=!0)},o(t){A(e.$$.fragment,t),s=!1},d(t){ue(e,t)}}}function kt(a){let e=a[21].message.substr(0,ee)+"",s,t,l,r=a[21].message.length>ee&&qe(a);return{c(){s=H(e),t=w(),r&&r.c(),l=$e()},l(n){s=G(n,e),t=S(n),r&&r.l(n),l=$e()},m(n,i){F(n,s,i),F(n,t,i),r&&r.m(n,i),F(n,l,i)},p(n,i){i&4&&e!==(e=n[21].message.substr(0,ee)+"")&&X(s,e),n[21].message.length>ee?r?r.p(n,i):(r=qe(n),r.c(),r.m(l.parentNode,l)):r&&(r.d(1),r=null)},d(n){n&&(_(s),_(t),_(l)),r&&r.d(n)}}}function $t(a){let e=a[21].message+"",s;return{c(){s=H(e)},l(t){s=G(t,e)},m(t,l){F(t,s,l)},p(t,l){l&4&&e!==(e=t[21].message+"")&&X(s,e)},d(t){t&&_(s)}}}function qe(a){let e,s=a[21].message.length-ee+"",t,l,r,n;function i(){return a[17](a[21],a[23],a[24])}return{c(){e=m("button"),t=H(s),l=H(" more characters"),this.h()},l(o){e=g(o,"BUTTON",{type:!0,class:!0});var f=$(e);t=G(f,s),l=G(f," more characters"),f.forEach(_),this.h()},h(){c(e,"type","button"),c(e,"class","svelte-125ig35")},m(o,f){F(o,e,f),u(e,t),u(e,l),r||(n=te(e,"click",i),r=!0)},p(o,f){a=o,f&4&&s!==(s=a[21].message.length-ee+"")&&X(t,s)},d(o){o&&_(e),r=!1,n()}}}function He(a){var P;let e,s,t,l=new Date(a[21].created_at).toLocaleDateString(void 0,{})+"",r,n,i=new Date(a[21].created_at).toLocaleTimeString(void 0,{})+"",o,f,h,b,L,J="Remove log from pinned panel",x,B,E,D,K,j,C,R,I,d,U;B=new ge({props:{icon:"trash",size:"18"}});function Y(){return a[16](a[21])}let y=((P=a[21].data)==null?void 0:P.url)&&Re(a);const N=[bt,vt],p=[];function O(v,k){return v[22]?0:1}return j=O(a),C=p[j]=N[j](a),{c(){e=m("li"),s=m("div"),t=m("time"),r=H(l),n=w(),o=H(i),h=w(),b=m("button"),L=m("span"),L.textContent=J,x=w(),ie(B.$$.fragment),E=w(),y&&y.c(),D=w(),K=m("div"),C.c(),R=w(),this.h()},l(v){e=g(v,"LI",{class:!0});var k=$(e);s=g(k,"DIV",{class:!0});var Q=$(s);t=g(Q,"TIME",{class:!0,datetime:!0});var q=$(t);r=G(q,l),n=S(q),o=G(q,i),q.forEach(_),h=S(Q),b=g(Q,"BUTTON",{type:!0,title:!0,class:!0});var M=$(b);L=g(M,"SPAN",{class:!0,"data-svelte-h":!0}),le(L)!=="svelte-flzfhp"&&(L.textContent=J),x=S(M),oe(B.$$.fragment,M),M.forEach(_),Q.forEach(_),E=S(k),y&&y.l(k),D=S(k),K=g(k,"DIV",{class:!0});var Z=$(K);C.l(Z),Z.forEach(_),R=S(k),k.forEach(_),this.h()},h(){c(t,"class","date svelte-125ig35"),c(t,"datetime",f=a[21].created_at),c(L,"class","label"),c(b,"type","button"),c(b,"title","Remove log from pinned panel"),c(b,"class","svelte-125ig35"),c(s,"class","info svelte-125ig35"),c(K,"class","message svelte-125ig35"),c(e,"class","svelte-125ig35")},m(v,k){F(v,e,k),u(e,s),u(s,t),u(t,r),u(t,n),u(t,o),u(s,h),u(s,b),u(b,L),u(b,x),fe(B,b,null),u(e,E),y&&y.m(e,null),u(e,D),u(e,K),p[j].m(K,null),u(e,R),I=!0,d||(U=te(b,"click",Y),d=!0)},p(v,k){var q;a=v,(!I||k&4)&&l!==(l=new Date(a[21].created_at).toLocaleDateString(void 0,{})+"")&&X(r,l),(!I||k&4)&&i!==(i=new Date(a[21].created_at).toLocaleTimeString(void 0,{})+"")&&X(o,i),(!I||k&4&&f!==(f=a[21].created_at))&&c(t,"datetime",f),(q=a[21].data)!=null&&q.url?y?y.p(a,k):(y=Re(a),y.c(),y.m(e,D)):y&&(y.d(1),y=null);let Q=j;j=O(a),j===Q?p[j].p(a,k):(re(),A(p[Q],1,1,()=>{p[Q]=null}),ae(),C=p[j],C?C.p(a,k):(C=p[j]=N[j](a),C.c()),T(C,1),C.m(K,null))},i(v){I||(T(B.$$.fragment,v),T(C),I=!0)},o(v){A(B.$$.fragment,v),A(C),I=!1},d(v){v&&_(e),ue(B),y&&y.d(),p[j].d(),d=!1,U()}}}function Et(a){let e,s,t,l="Clear pinned logs",r,n,i,o,f=a[2]&&Je(a);return{c(){e=m("div"),s=m("nav"),t=m("button"),t.textContent=l,r=w(),f&&f.c(),this.h()},l(h){e=g(h,"DIV",{class:!0});var b=$(e);s=g(b,"NAV",{class:!0});var L=$(s);t=g(L,"BUTTON",{type:!0,class:!0,"data-svelte-h":!0}),le(t)!=="svelte-eeid91"&&(t.textContent=l),L.forEach(_),r=S(b),f&&f.l(b),b.forEach(_),this.h()},h(){c(t,"type","button"),c(t,"class","button svelte-125ig35"),c(s,"class","asideNav svelte-125ig35"),c(e,"class","pins svelte-125ig35")},m(h,b){F(h,e,b),u(e,s),u(s,t),u(e,r),f&&f.m(e,null),n=!0,i||(o=te(t,"click",a[15]),i=!0)},p(h,b){h[2]?f?(f.p(h,b),b&4&&T(f,1)):(f=Je(h),f.c(),T(f,1),f.m(e,null)):f&&(re(),A(f,1,1,()=>{f=null}),ae())},i(h){n||(T(f),n=!0)},o(h){A(f),n=!1},d(h){h&&_(e),f&&f.d(),i=!1,o()}}}function Tt(a){let e,s,t,l,r,n,i="Filter:",o,f,h,b,L,J,x="Clear screen",B,E,D,K="Toggle pinned logs panel",j,C,R,I,d,U,Y,y,N=a[1]&&Ue(a);C=new ge({props:{icon:"pin"}});let p=a[4].logs.logs&&Be(a),O=!a[1]&&Me(),P=a[3]&&ze(a);return{c(){e=w(),s=m("div"),t=m("section"),l=m("nav"),r=m("form"),n=m("label"),n.textContent=i,o=w(),f=m("input"),h=w(),N&&N.c(),b=w(),L=m("div"),J=m("button"),J.textContent=x,B=w(),E=m("button"),D=m("span"),D.textContent=K,j=w(),ie(C.$$.fragment),R=w(),p&&p.c(),I=w(),O&&O.c(),d=w(),P&&P.c(),this.h()},l(v){xe("svelte-1xj5d21",Ie.head).forEach(_),e=S(v),s=g(v,"DIV",{class:!0});var Q=$(s);t=g(Q,"SECTION",{class:!0});var q=$(t);l=g(q,"NAV",{class:!0});var M=$(l);r=g(M,"FORM",{});var Z=$(r);n=g(Z,"LABEL",{for:!0,"data-svelte-h":!0}),le(n)!=="svelte-kf6j7o"&&(n.textContent=i),o=S(Z),f=g(Z,"INPUT",{type:!0,id:!0,class:!0}),h=S(Z),N&&N.l(Z),Z.forEach(_),b=S(M),L=g(M,"DIV",{class:!0});var ce=$(L);J=g(ce,"BUTTON",{type:!0,class:!0,"data-svelte-h":!0}),le(J)!=="svelte-1hlqgjb"&&(J.textContent=x),B=S(ce),E=g(ce,"BUTTON",{type:!0,title:!0,class:!0});var _e=$(E);D=g(_e,"SPAN",{class:!0,"data-svelte-h":!0}),le(D)!=="svelte-1o6petk"&&(D.textContent=K),j=S(_e),oe(C.$$.fragment,_e),_e.forEach(_),ce.forEach(_),M.forEach(_),R=S(q),p&&p.l(q),I=S(q),O&&O.l(q),q.forEach(_),d=S(Q),P&&P.l(Q),Q.forEach(_),this.h()},h(){Ie.title="Logs | platformOS",c(n,"for","filter"),c(f,"type","text"),c(f,"id","filter"),c(f,"class","svelte-125ig35"),c(J,"type","button"),c(J,"class","button"),c(D,"class","label"),c(E,"type","button"),c(E,"title","Toggle pinned logs panel"),c(E,"class","button"),c(L,"class","svelte-125ig35"),c(l,"class","svelte-125ig35"),c(t,"class","logs svelte-125ig35"),c(s,"class","container svelte-125ig35")},m(v,k){F(v,e,k),F(v,s,k),u(s,t),u(t,l),u(l,r),u(r,n),u(r,o),u(r,f),ye(f,a[1]),u(r,h),N&&N.m(r,null),u(l,b),u(l,L),u(L,J),u(L,B),u(L,E),u(E,D),u(E,j),fe(C,E,null),u(t,R),p&&p.m(t,null),u(t,I),O&&O.m(t,null),u(s,d),P&&P.m(s,null),a[18](s),U=!0,Y||(y=[te(f,"input",a[8]),te(J,"click",a[10]),te(E,"click",a[7])],Y=!0)},p(v,[k]){k&2&&f.value!==v[1]&&ye(f,v[1]),v[1]?N?(N.p(v,k),k&2&&T(N,1)):(N=Ue(v),N.c(),T(N,1),N.m(r,null)):N&&(re(),A(N,1,1,()=>{N=null}),ae()),v[4].logs.logs?p?(p.p(v,k),k&16&&T(p,1)):(p=Be(v),p.c(),T(p,1),p.m(t,I)):p&&(re(),A(p,1,1,()=>{p=null}),ae()),v[1]?O&&(O.d(1),O=null):O||(O=Me(),O.c(),O.m(t,null)),v[3]?P?(P.p(v,k),k&8&&T(P,1)):(P=ze(v),P.c(),T(P,1),P.m(s,null)):P&&(re(),A(P,1,1,()=>{P=null}),ae())},i(v){U||(T(N),T(C.$$.fragment,v),T(p),T(P),U=!0)},o(v){A(N),A(C.$$.fragment,v),A(p),A(P),U=!1},d(v){v&&(_(e),_(s)),N&&N.d(),ue(C),p&&p.d(),O&&O.d(),P&&P.d(),a[18](null),Y=!1,Ge(y)}}}let ee=262144;function Ct(a,e,s){let t;et(a,Te,d=>s(4,t=d));let l,r="",n=[],i;const o=d=>d.hidden===!0||d.error_type.toLowerCase().indexOf(r)===-1&&d.message.toLowerCase().indexOf(r)===-1;let f=!1;tt(()=>{{const d=document.querySelector(".logs");d&&Math.abs(d.scrollHeight-d.scrollTop-d.clientHeight)<10&&(f=!1)}}),lt(async()=>{var d;f||(await rt(),document.querySelector("footer").scrollIntoView(),(d=t.logs.logs)!=null&&d.length&&(f=!0))}),st(()=>{s(3,i=localStorage.pinnedPanel==="true"),s(2,n=localStorage.pinnedLogs?JSON.parse(localStorage.pinnedLogs):[])});const h=d=>{n.find(U=>U.id===d.id)?s(2,n=n.filter(U=>U.id!==d.id)):s(2,n=[...n,d]),localStorage.pinnedLogs=JSON.stringify(n)},b=()=>{i?(s(3,i=!1),localStorage.pinnedPanel=!1):(s(3,i=!0),localStorage.pinnedPanel=!0)};function L(){r=this.value,s(1,r)}const J=()=>s(1,r=""),x=()=>t.logs.logs.forEach((d,U)=>Ne(Te,t.logs.logs[U].hidden=!0,t)),B=(d,U,Y)=>Ne(Te,U[Y].showFull=!0,t),E=(d,U)=>navigator.clipboard.writeText(d.message).then(()=>{U.target.classList.add("confirmation"),setTimeout(()=>U.target.classList.remove("confirmation"),1e3)}),D=d=>h(d),K=(d,U)=>U.id===d.id,j=()=>{localStorage.pinnedLogs=[],s(2,n=[])},C=d=>h(d),R=(d,U,Y)=>s(2,U[Y].showFull=!0,n);function I(d){it[d?"unshift":"push"](()=>{l=d,s(0,l)})}return[l,r,n,i,t,o,h,b,L,J,x,B,E,D,K,j,C,R,I]}class Bt extends ot{constructor(e){super(),ft(this,e,Ct,Tt,Ze,{})}}export{Bt as component};

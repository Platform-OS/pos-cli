import{S as et,i as tt,s as lt,a as y,k as h,q as I,y as ue,$ as st,h as c,c as N,l as g,m,r as O,z as ce,n as _,b as j,F as f,V as Ne,A as _e,G as le,g as D,d as q,f as re,B as de,H as Ke,I as nt,a7 as rt,j as at,o as ot,a5 as it,K as ge,v as ae,W as We,E as ne,Z as ft,u as X,L as Ye,Y as ut,O as Ie,t as ct,J as Oe,w as _t,e as we}from"../chunks/index.bb836cd6.js";import{f as dt}from"../chunks/index.6d9f54a0.js";import{q as ht}from"../chunks/index.50c00146.js";import{s as Ee}from"../chunks/state.3970d786.js";import{t as Ze,J as Qe}from"../chunks/JSONTree.50c97b2f.js";import{I as me}from"../chunks/Icon.f1a318ba.js";const{document:Pe}=it;function Ce(r,e,n){const t=r.slice();t[21]=e[n],t[23]=e,t[24]=n;const l=t[21].message.length<262144&&Ze(t[21].message);return t[22]=l,t}function Ue(r,e,n){const t=r.slice();t[21]=e[n],t[25]=e,t[26]=n;const l=t[21].message.length<262144&&Ze(t[21].message);return t[22]=l,t}function Be(r){let e,n,t,l,a,s,o,i;return a=new me({props:{icon:"x",size:"12"}}),{c(){e=h("button"),n=h("span"),t=I("Clear filter"),l=y(),ue(a.$$.fragment),this.h()},l(u){e=g(u,"BUTTON",{class:!0});var w=m(e);n=g(w,"SPAN",{class:!0});var d=m(n);t=O(d,"Clear filter"),d.forEach(c),l=N(w),ce(a.$$.fragment,w),w.forEach(c),this.h()},h(){_(n,"class","label svelte-4wn8gf"),_(e,"class","clearFilter svelte-4wn8gf")},m(u,w){j(u,e,w),f(e,n),f(n,t),f(e,l),_e(a,e,null),s=!0,o||(i=le(e,"click",r[10]),o=!0)},p:ge,i(u){s||(D(a.$$.fragment,u),s=!0)},o(u){q(a.$$.fragment,u),s=!1},d(u){u&&c(e),de(a),o=!1,i()}}}function Ve(r){let e,n,t=r[4].logs.logs,l=[];for(let s=0;s<t.length;s+=1)l[s]=je(Ue(r,t,s));const a=s=>q(l[s],1,1,()=>{l[s]=null});return{c(){e=h("table");for(let s=0;s<l.length;s+=1)l[s].c();this.h()},l(s){e=g(s,"TABLE",{class:!0});var o=m(e);for(let i=0;i<l.length;i+=1)l[i].l(o);o.forEach(c),this.h()},h(){_(e,"class","svelte-4wn8gf")},m(s,o){j(s,e,o);for(let i=0;i<l.length;i+=1)l[i]&&l[i].m(e,null);n=!0},p(s,o){if(o&118){t=s[4].logs.logs;let i;for(i=0;i<t.length;i+=1){const u=Ue(s,t,i);l[i]?(l[i].p(u,o),D(l[i],1)):(l[i]=je(u),l[i].c(),D(l[i],1),l[i].m(e,null))}for(ae(),i=t.length;i<l.length;i+=1)a(i);re()}},i(s){if(!n){for(let o=0;o<t.length;o+=1)D(l[o]);n=!0}},o(s){l=l.filter(Boolean);for(let o=0;o<l.length;o+=1)q(l[o]);n=!1},d(s){s&&c(e),We(l,s)}}}function gt(r){let e;function n(a,s){return a[21].showFull?vt:pt}let t=n(r),l=t(r);return{c(){e=h("div"),l.c(),this.h()},l(a){e=g(a,"DIV",{class:!0});var s=m(e);l.l(s),s.forEach(c),this.h()},h(){_(e,"class","pre svelte-4wn8gf")},m(a,s){j(a,e,s),l.m(e,null)},p(a,s){t===(t=n(a))&&l?l.p(a,s):(l.d(1),l=t(a),l&&(l.c(),l.m(e,null)))},i:ge,o:ge,d(a){a&&c(e),l.d()}}}function mt(r){let e,n;return e=new Qe({props:{value:r[22],showFullLines:!0}}),{c(){ue(e.$$.fragment)},l(t){ce(e.$$.fragment,t)},m(t,l){_e(e,t,l),n=!0},p(t,l){const a={};l&16&&(a.value=t[22]),e.$set(a)},i(t){n||(D(e.$$.fragment,t),n=!0)},o(t){q(e.$$.fragment,t),n=!1},d(t){de(e,t)}}}function pt(r){let e=r[21].message.substr(0,ee)+"",n,t,l,a=r[21].message.length>ee&&Fe(r);return{c(){n=I(e),t=y(),a&&a.c(),l=we()},l(s){n=O(s,e),t=N(s),a&&a.l(s),l=we()},m(s,o){j(s,n,o),j(s,t,o),a&&a.m(s,o),j(s,l,o)},p(s,o){o&16&&e!==(e=s[21].message.substr(0,ee)+"")&&X(n,e),s[21].message.length>ee?a?a.p(s,o):(a=Fe(s),a.c(),a.m(l.parentNode,l)):a&&(a.d(1),a=null)},d(s){s&&c(n),s&&c(t),a&&a.d(s),s&&c(l)}}}function vt(r){let e=r[21].message+"",n;return{c(){n=I(e)},l(t){n=O(t,e)},m(t,l){j(t,n,l)},p(t,l){l&16&&e!==(e=t[21].message+"")&&X(n,e)},d(t){t&&c(n)}}}function Fe(r){let e,n,t=r[21].message.length-ee+"",l,a,s,o;function i(){return r[12](r[21],r[25],r[26])}return{c(){e=h("div"),n=h("button"),l=I(t),a=I(" more characters"),this.h()},l(u){e=g(u,"DIV",{class:!0});var w=m(e);n=g(w,"BUTTON",{type:!0,class:!0});var d=m(n);l=O(d,t),a=O(d," more characters"),d.forEach(c),w.forEach(c),this.h()},h(){_(n,"type","button"),_(n,"class","svelte-4wn8gf"),_(e,"class","longStringInfo svelte-4wn8gf")},m(u,w){j(u,e,w),f(e,n),f(n,l),f(n,a),s||(o=le(n,"click",i),s=!0)},p(u,w){r=u,w&16&&t!==(t=r[21].message.length-ee+"")&&X(l,t)},d(u){u&&c(e),s=!1,o()}}}function Ae(r){let e,n,t,l=r[21].data.url+"",a,s,o=r[21].data.user&&Re(r);return{c(){e=h("ul"),n=h("li"),t=I("Page: "),a=I(l),s=y(),o&&o.c(),this.h()},l(i){e=g(i,"UL",{class:!0});var u=m(e);n=g(u,"LI",{});var w=m(n);t=O(w,"Page: "),a=O(w,l),w.forEach(c),s=N(u),o&&o.l(u),u.forEach(c),this.h()},h(){_(e,"class","info svelte-4wn8gf")},m(i,u){j(i,e,u),f(e,n),f(n,t),f(n,a),f(e,s),o&&o.m(e,null)},p(i,u){u&16&&l!==(l=i[21].data.url+"")&&X(a,l),i[21].data.user?o?o.p(i,u):(o=Re(i),o.c(),o.m(e,null)):o&&(o.d(1),o=null)},d(i){i&&c(e),o&&o.d()}}}function Re(r){let e,n,t,l=r[21].data.user.id+"",a,s;return{c(){e=h("li"),n=I("User ID: "),t=h("a"),a=I(l),this.h()},l(o){e=g(o,"LI",{});var i=m(e);n=O(i,"User ID: "),t=g(i,"A",{href:!0,class:!0});var u=m(t);a=O(u,l),u.forEach(c),i.forEach(c),this.h()},h(){_(t,"href",s="/users/"+r[21].data.user.id),_(t,"class","svelte-4wn8gf")},m(o,i){j(o,e,i),f(e,n),f(e,t),f(t,a)},p(o,i){i&16&&l!==(l=o[21].data.user.id+"")&&X(a,l),i&16&&s!==(s="/users/"+o[21].data.user.id)&&_(t,"href",s)},d(o){o&&c(e)}}}function je(r){var $e;let e,n,t,l=new Date(r[21].created_at).toLocaleDateString(void 0,{})+"",a,s,o=new Date(r[21].created_at).toLocaleTimeString(void 0,{})+"",i,u,w,d,E=r[21].error_type+"",P,G,C,T,B,K,J,S,W,V,Q,v,F,$,L,p,A,U,b,k,Z,Y,M,x,se;const oe=[mt,gt],te=[];function ie(z,R){return z[22]?0:1}T=ie(r),B=te[T]=oe[T](r);let H=(($e=r[21].data)==null?void 0:$e.url)&&Ae(r);$=new me({props:{icon:"copy"}});function Xe(...z){return r[13](r[21],...z)}k=new me({props:{icon:"pin"}});function xe(){return r[14](r[21])}function Te(...z){return r[15](r[21],...z)}return{c(){e=h("tr"),n=h("td"),t=h("time"),a=I(l),s=y(),i=I(o),w=y(),d=h("td"),P=I(E),G=y(),C=h("td"),B.c(),K=y(),H&&H.c(),J=y(),S=h("td"),W=h("div"),V=h("button"),Q=h("span"),v=I("Copy message"),F=y(),ue($.$$.fragment),L=y(),p=h("button"),A=h("span"),U=I("Pin this log"),b=y(),ue(k.$$.fragment),Z=y(),this.h()},l(z){e=g(z,"TR",{class:!0});var R=m(e);n=g(R,"TD",{class:!0});var he=m(n);t=g(he,"TIME",{datetime:!0,class:!0});var fe=m(t);a=O(fe,l),s=N(fe),i=O(fe,o),fe.forEach(c),he.forEach(c),w=N(R),d=g(R,"TD",{class:!0});var Se=m(d);P=O(Se,E),Se.forEach(c),G=N(R),C=g(R,"TD",{class:!0});var pe=m(C);B.l(pe),K=N(pe),H&&H.l(pe),pe.forEach(c),J=N(R),S=g(R,"TD",{class:!0});var Le=m(S);W=g(Le,"DIV",{class:!0});var ve=m(W);V=g(ve,"BUTTON",{type:!0,class:!0,title:!0});var be=m(V);Q=g(be,"SPAN",{class:!0});var De=m(Q);v=O(De,"Copy message"),De.forEach(c),F=N(be),ce($.$$.fragment,be),be.forEach(c),L=N(ve),p=g(ve,"BUTTON",{type:!0,class:!0,title:!0});var ke=m(p);A=g(ke,"SPAN",{class:!0});var ye=m(A);U=O(ye,"Pin this log"),ye.forEach(c),b=N(ke),ce(k.$$.fragment,ke),ke.forEach(c),ve.forEach(c),Le.forEach(c),Z=N(R),R.forEach(c),this.h()},h(){_(t,"datetime",u=r[21].created_at),_(t,"class","svelte-4wn8gf"),_(n,"class","date svelte-4wn8gf"),_(d,"class","logType svelte-4wn8gf"),_(C,"class","message svelte-4wn8gf"),_(Q,"class","label"),_(V,"type","button"),_(V,"class","button svelte-4wn8gf"),_(V,"title","Copy message"),_(A,"class","label"),_(p,"type","button"),_(p,"class","button svelte-4wn8gf"),_(p,"title","Pin this log"),ne(p,"active",r[2].find(Te)),_(W,"class","svelte-4wn8gf"),_(S,"class","actions svelte-4wn8gf"),_(e,"class","svelte-4wn8gf"),ne(e,"hidden",r[1]&&r[5](r[21])||r[21].hidden),ne(e,"error",r[21].error_type.match(/error/i)),ne(e,"fresh",r[21].downloaded_at>r[4].logs.downloaded_at[0])},m(z,R){j(z,e,R),f(e,n),f(n,t),f(t,a),f(t,s),f(t,i),f(e,w),f(e,d),f(d,P),f(e,G),f(e,C),te[T].m(C,null),f(C,K),H&&H.m(C,null),f(e,J),f(e,S),f(S,W),f(W,V),f(V,Q),f(Q,v),f(V,F),_e($,V,null),f(W,L),f(W,p),f(p,A),f(A,U),f(p,b),_e(k,p,null),f(e,Z),M=!0,x||(se=[le(V,"click",Xe),le(p,"click",ft(xe))],x=!0)},p(z,R){var fe;r=z,(!M||R&16)&&l!==(l=new Date(r[21].created_at).toLocaleDateString(void 0,{})+"")&&X(a,l),(!M||R&16)&&o!==(o=new Date(r[21].created_at).toLocaleTimeString(void 0,{})+"")&&X(i,o),(!M||R&16&&u!==(u=r[21].created_at))&&_(t,"datetime",u),(!M||R&16)&&E!==(E=r[21].error_type+"")&&X(P,E);let he=T;T=ie(r),T===he?te[T].p(r,R):(ae(),q(te[he],1,1,()=>{te[he]=null}),re(),B=te[T],B?B.p(r,R):(B=te[T]=oe[T](r),B.c()),D(B,1),B.m(C,K)),(fe=r[21].data)!=null&&fe.url?H?H.p(r,R):(H=Ae(r),H.c(),H.m(C,null)):H&&(H.d(1),H=null),(!M||R&20)&&ne(p,"active",r[2].find(Te)),(!M||R&50)&&ne(e,"hidden",r[1]&&r[5](r[21])||r[21].hidden),(!M||R&16)&&ne(e,"error",r[21].error_type.match(/error/i)),(!M||R&16)&&ne(e,"fresh",r[21].downloaded_at>r[4].logs.downloaded_at[0])},i(z){M||(D(B),D($.$$.fragment,z),D(k.$$.fragment,z),z&&(Y||Ye(()=>{Y=ut(e,dt,{duration:200}),Y.start()})),M=!0)},o(z){q(B),q($.$$.fragment,z),q(k.$$.fragment,z),M=!1},d(z){z&&c(e),te[T].d(),H&&H.d(),de($),de(k),x=!1,Ke(se)}}}function qe(r){let e,n,t,l;return{c(){e=h("footer"),n=I("No newer logs to show"),t=h("br"),l=I("Checking every 7 seconds"),this.h()},l(a){e=g(a,"FOOTER",{class:!0});var s=m(e);n=O(s,"No newer logs to show"),t=g(s,"BR",{}),l=O(s,"Checking every 7 seconds"),s.forEach(c),this.h()},h(){_(e,"class","svelte-4wn8gf")},m(a,s){j(a,e,s),f(e,n),f(e,t),f(e,l)},d(a){a&&c(e)}}}function Je(r){let e,n,t,l,a,s,o,i,u,w,d=r[2]&&Me(r);return{c(){e=h("section"),n=h("div"),t=h("nav"),l=h("button"),a=I("Clear pinned logs"),s=y(),d&&d.c(),this.h()},l(E){e=g(E,"SECTION",{class:!0});var P=m(e);n=g(P,"DIV",{class:!0});var G=m(n);t=g(G,"NAV",{class:!0});var C=m(t);l=g(C,"BUTTON",{type:!0,class:!0});var T=m(l);a=O(T,"Clear pinned logs"),T.forEach(c),C.forEach(c),s=N(G),d&&d.l(G),G.forEach(c),P.forEach(c),this.h()},h(){_(l,"type","button"),_(l,"class","button svelte-4wn8gf"),_(t,"class","svelte-4wn8gf"),_(n,"class","svelte-4wn8gf"),_(e,"class","pins svelte-4wn8gf")},m(E,P){j(E,e,P),f(e,n),f(n,t),f(t,l),f(l,a),f(n,s),d&&d.m(n,null),i=!0,u||(w=le(l,"click",r[16]),u=!0)},p(E,P){E[2]?d?(d.p(E,P),P&4&&D(d,1)):(d=Me(E),d.c(),D(d,1),d.m(n,null)):d&&(ae(),q(d,1,1,()=>{d=null}),re())},i(E){i||(D(d),Ye(()=>{i&&(o||(o=Ie(e,r[8],{},!0)),o.run(1))}),i=!0)},o(E){q(d),o||(o=Ie(e,r[8],{},!1)),o.run(0),i=!1},d(E){E&&c(e),d&&d.d(),E&&o&&o.end(),u=!1,w()}}}function Me(r){let e,n,t=r[2],l=[];for(let s=0;s<t.length;s+=1)l[s]=Ge(Ce(r,t,s));const a=s=>q(l[s],1,1,()=>{l[s]=null});return{c(){e=h("ul");for(let s=0;s<l.length;s+=1)l[s].c()},l(s){e=g(s,"UL",{});var o=m(e);for(let i=0;i<l.length;i+=1)l[i].l(o);o.forEach(c)},m(s,o){j(s,e,o);for(let i=0;i<l.length;i+=1)l[i]&&l[i].m(e,null);n=!0},p(s,o){if(o&68){t=s[2];let i;for(i=0;i<t.length;i+=1){const u=Ce(s,t,i);l[i]?(l[i].p(u,o),D(l[i],1)):(l[i]=Ge(u),l[i].c(),D(l[i],1),l[i].m(e,null))}for(ae(),i=t.length;i<l.length;i+=1)a(i);re()}},i(s){if(!n){for(let o=0;o<t.length;o+=1)D(l[o]);n=!0}},o(s){l=l.filter(Boolean);for(let o=0;o<l.length;o+=1)q(l[o]);n=!1},d(s){s&&c(e),We(l,s)}}}function ze(r){let e,n=r[21].data.url+"",t;return{c(){e=h("div"),t=I(n),this.h()},l(l){e=g(l,"DIV",{class:!0});var a=m(e);t=O(a,n),a.forEach(c),this.h()},h(){_(e,"class","url svelte-4wn8gf")},m(l,a){j(l,e,a),f(e,t)},p(l,a){a&4&&n!==(n=l[21].data.url+"")&&X(t,n)},d(l){l&&c(e)}}}function bt(r){let e;function n(a,s){return a[21].showFull?Et:wt}let t=n(r),l=t(r);return{c(){e=h("div"),l.c(),this.h()},l(a){e=g(a,"DIV",{class:!0});var s=m(e);l.l(s),s.forEach(c),this.h()},h(){_(e,"class","pre svelte-4wn8gf")},m(a,s){j(a,e,s),l.m(e,null)},p(a,s){t===(t=n(a))&&l?l.p(a,s):(l.d(1),l=t(a),l&&(l.c(),l.m(e,null)))},i:ge,o:ge,d(a){a&&c(e),l.d()}}}function kt(r){let e,n;return e=new Qe({props:{value:r[22],showFullLines:!0}}),{c(){ue(e.$$.fragment)},l(t){ce(e.$$.fragment,t)},m(t,l){_e(e,t,l),n=!0},p(t,l){const a={};l&4&&(a.value=t[22]),e.$set(a)},i(t){n||(D(e.$$.fragment,t),n=!0)},o(t){q(e.$$.fragment,t),n=!1},d(t){de(e,t)}}}function wt(r){let e=r[21].message.substr(0,ee)+"",n,t,l,a=r[21].message.length>ee&&He(r);return{c(){n=I(e),t=y(),a&&a.c(),l=we()},l(s){n=O(s,e),t=N(s),a&&a.l(s),l=we()},m(s,o){j(s,n,o),j(s,t,o),a&&a.m(s,o),j(s,l,o)},p(s,o){o&4&&e!==(e=s[21].message.substr(0,ee)+"")&&X(n,e),s[21].message.length>ee?a?a.p(s,o):(a=He(s),a.c(),a.m(l.parentNode,l)):a&&(a.d(1),a=null)},d(s){s&&c(n),s&&c(t),a&&a.d(s),s&&c(l)}}}function Et(r){let e=r[21].message+"",n;return{c(){n=I(e)},l(t){n=O(t,e)},m(t,l){j(t,n,l)},p(t,l){l&4&&e!==(e=t[21].message+"")&&X(n,e)},d(t){t&&c(n)}}}function He(r){let e,n=r[21].message.length-ee+"",t,l,a,s;function o(){return r[18](r[21],r[23],r[24])}return{c(){e=h("button"),t=I(n),l=I(" more characters"),this.h()},l(i){e=g(i,"BUTTON",{type:!0,class:!0});var u=m(e);t=O(u,n),l=O(u," more characters"),u.forEach(c),this.h()},h(){_(e,"type","button"),_(e,"class","svelte-4wn8gf")},m(i,u){j(i,e,u),f(e,t),f(e,l),a||(s=le(e,"click",o),a=!0)},p(i,u){r=i,u&4&&n!==(n=r[21].message.length-ee+"")&&X(t,n)},d(i){i&&c(e),a=!1,s()}}}function Ge(r){var U;let e,n,t,l=new Date(r[21].created_at).toLocaleDateString(void 0,{})+"",a,s,o=new Date(r[21].created_at).toLocaleTimeString(void 0,{})+"",i,u,w,d,E,P,G,C,T,B,K,J,S,W,V,Q,v;C=new me({props:{icon:"trash",size:"18"}});function F(){return r[17](r[21])}let $=((U=r[21].data)==null?void 0:U.url)&&ze(r);const L=[kt,bt],p=[];function A(b,k){return b[22]?0:1}return J=A(r),S=p[J]=L[J](r),{c(){e=h("li"),n=h("div"),t=h("time"),a=I(l),s=y(),i=I(o),w=y(),d=h("button"),E=h("span"),P=I("Remove log from pinned panel"),G=y(),ue(C.$$.fragment),T=y(),$&&$.c(),B=y(),K=h("div"),S.c(),W=y(),this.h()},l(b){e=g(b,"LI",{class:!0});var k=m(e);n=g(k,"DIV",{class:!0});var Z=m(n);t=g(Z,"TIME",{class:!0,datetime:!0});var Y=m(t);a=O(Y,l),s=N(Y),i=O(Y,o),Y.forEach(c),w=N(Z),d=g(Z,"BUTTON",{type:!0,title:!0,class:!0});var M=m(d);E=g(M,"SPAN",{class:!0});var x=m(E);P=O(x,"Remove log from pinned panel"),x.forEach(c),G=N(M),ce(C.$$.fragment,M),M.forEach(c),Z.forEach(c),T=N(k),$&&$.l(k),B=N(k),K=g(k,"DIV",{class:!0});var se=m(K);S.l(se),se.forEach(c),W=N(k),k.forEach(c),this.h()},h(){_(t,"class","date svelte-4wn8gf"),_(t,"datetime",u=r[21].created_at),_(E,"class","label"),_(d,"type","button"),_(d,"title","Remove log from pinned panel"),_(d,"class","svelte-4wn8gf"),_(n,"class","info svelte-4wn8gf"),_(K,"class","message svelte-4wn8gf"),_(e,"class","svelte-4wn8gf")},m(b,k){j(b,e,k),f(e,n),f(n,t),f(t,a),f(t,s),f(t,i),f(n,w),f(n,d),f(d,E),f(E,P),f(d,G),_e(C,d,null),f(e,T),$&&$.m(e,null),f(e,B),f(e,K),p[J].m(K,null),f(e,W),V=!0,Q||(v=le(d,"click",F),Q=!0)},p(b,k){var Y;r=b,(!V||k&4)&&l!==(l=new Date(r[21].created_at).toLocaleDateString(void 0,{})+"")&&X(a,l),(!V||k&4)&&o!==(o=new Date(r[21].created_at).toLocaleTimeString(void 0,{})+"")&&X(i,o),(!V||k&4&&u!==(u=r[21].created_at))&&_(t,"datetime",u),(Y=r[21].data)!=null&&Y.url?$?$.p(r,k):($=ze(r),$.c(),$.m(e,B)):$&&($.d(1),$=null);let Z=J;J=A(r),J===Z?p[J].p(r,k):(ae(),q(p[Z],1,1,()=>{p[Z]=null}),re(),S=p[J],S?S.p(r,k):(S=p[J]=L[J](r),S.c()),D(S,1),S.m(K,null))},i(b){V||(D(C.$$.fragment,b),D(S),V=!0)},o(b){q(C.$$.fragment,b),q(S),V=!1},d(b){b&&c(e),de(C),$&&$.d(),p[J].d(),Q=!1,v()}}}function Tt(r){let e,n,t,l,a,s,o,i,u,w,d,E,P,G,C,T,B,K,J,S,W,V,Q,v,F,$,L=r[1]&&Be(r);S=new me({props:{icon:"pin"}});let p=r[4].logs.logs&&Ve(r),A=!r[1]&&qe(),U=r[3]&&Je(r);return{c(){e=y(),n=h("div"),t=h("section"),l=h("nav"),a=h("form"),s=h("label"),o=I("Filter:"),i=y(),u=h("input"),w=y(),L&&L.c(),d=y(),E=h("div"),P=h("button"),G=I("Clear screen"),C=y(),T=h("button"),B=h("span"),K=I("Toggle pinned logs panel"),J=y(),ue(S.$$.fragment),W=y(),p&&p.c(),V=y(),A&&A.c(),Q=y(),U&&U.c(),this.h()},l(b){st("svelte-1xj5d21",Pe.head).forEach(c),e=N(b),n=g(b,"DIV",{class:!0});var Z=m(n);t=g(Z,"SECTION",{class:!0});var Y=m(t);l=g(Y,"NAV",{class:!0});var M=m(l);a=g(M,"FORM",{});var x=m(a);s=g(x,"LABEL",{for:!0});var se=m(s);o=O(se,"Filter:"),se.forEach(c),i=N(x),u=g(x,"INPUT",{type:!0,id:!0,class:!0}),w=N(x),L&&L.l(x),x.forEach(c),d=N(M),E=g(M,"DIV",{class:!0});var oe=m(E);P=g(oe,"BUTTON",{type:!0,class:!0});var te=m(P);G=O(te,"Clear screen"),te.forEach(c),C=N(oe),T=g(oe,"BUTTON",{type:!0,title:!0,class:!0});var ie=m(T);B=g(ie,"SPAN",{class:!0});var H=m(B);K=O(H,"Toggle pinned logs panel"),H.forEach(c),J=N(ie),ce(S.$$.fragment,ie),ie.forEach(c),oe.forEach(c),M.forEach(c),W=N(Y),p&&p.l(Y),V=N(Y),A&&A.l(Y),Y.forEach(c),Q=N(Z),U&&U.l(Z),Z.forEach(c),this.h()},h(){Pe.title="Logs | platformOS",_(s,"for","filter"),_(u,"type","text"),_(u,"id","filter"),_(u,"class","svelte-4wn8gf"),_(P,"type","button"),_(P,"class","button"),_(B,"class","label"),_(T,"type","button"),_(T,"title","Toggle pinned logs panel"),_(T,"class","button"),_(E,"class","svelte-4wn8gf"),_(l,"class","svelte-4wn8gf"),_(t,"class","logs svelte-4wn8gf"),_(n,"class","container svelte-4wn8gf")},m(b,k){j(b,e,k),j(b,n,k),f(n,t),f(t,l),f(l,a),f(a,s),f(s,o),f(a,i),f(a,u),Ne(u,r[1]),f(a,w),L&&L.m(a,null),f(l,d),f(l,E),f(E,P),f(P,G),f(E,C),f(E,T),f(T,B),f(B,K),f(T,J),_e(S,T,null),f(t,W),p&&p.m(t,null),f(t,V),A&&A.m(t,null),f(n,Q),U&&U.m(n,null),r[19](n),v=!0,F||($=[le(u,"input",r[9]),le(P,"click",r[11]),le(T,"click",r[7])],F=!0)},p(b,[k]){k&2&&u.value!==b[1]&&Ne(u,b[1]),b[1]?L?(L.p(b,k),k&2&&D(L,1)):(L=Be(b),L.c(),D(L,1),L.m(a,null)):L&&(ae(),q(L,1,1,()=>{L=null}),re()),b[4].logs.logs?p?(p.p(b,k),k&16&&D(p,1)):(p=Ve(b),p.c(),D(p,1),p.m(t,V)):p&&(ae(),q(p,1,1,()=>{p=null}),re()),b[1]?A&&(A.d(1),A=null):A||(A=qe(),A.c(),A.m(t,null)),b[3]?U?(U.p(b,k),k&8&&D(U,1)):(U=Je(b),U.c(),D(U,1),U.m(n,null)):U&&(ae(),q(U,1,1,()=>{U=null}),re())},i(b){v||(D(L),D(S.$$.fragment,b),D(p),D(U),v=!0)},o(b){q(L),q(S.$$.fragment,b),q(p),q(U),v=!1},d(b){b&&c(e),b&&c(n),L&&L.d(),de(S),p&&p.d(),A&&A.d(),U&&U.d(),r[19](null),F=!1,Ke($)}}}let ee=262144;function $t(r,e,n){let t;nt(r,Ee,v=>n(4,t=v));let l,a="",s=[],o;const i=v=>v.hidden===!0||v.error_type.toLowerCase().indexOf(a)===-1&&v.message.toLowerCase().indexOf(a)===-1;let u=!1;rt(()=>{{const v=document.querySelector(".logs");Math.abs(v.scrollHeight-v.scrollTop-v.clientHeight)<10&&(u=!1)}}),at(async()=>{var v;u||(await ct(),document.querySelector("footer").scrollIntoView(),(v=t.logs.logs)!=null&&v.length&&(u=!0))}),ot(()=>{n(3,o=localStorage.pinnedPanel==="true"),n(2,s=localStorage.pinnedLogs?JSON.parse(localStorage.pinnedLogs):[])});const w=v=>{s.find(F=>F.id===v.id)?n(2,s=s.filter(F=>F.id!==v.id)):n(2,s=[...s,v]),localStorage.pinnedLogs=JSON.stringify(s)},d=()=>{o?(n(3,o=!1),localStorage.pinnedPanel=!1):(n(3,o=!0),localStorage.pinnedPanel=!0)},E=function(v,{delay:F=0,duration:$=150}){return{delay:F,duration:$,css:L=>`width: ${500*ht(L)}px;`}};function P(){a=this.value,n(1,a)}const G=()=>n(1,a=""),C=()=>t.logs.logs.forEach((v,F)=>Oe(Ee,t.logs.logs[F].hidden=!0,t)),T=(v,F,$)=>Oe(Ee,F[$].showFull=!0,t),B=(v,F)=>navigator.clipboard.writeText(v.message).then(()=>{F.target.classList.add("confirmation"),setTimeout(()=>F.target.classList.remove("confirmation"),1e3)}),K=v=>w(v),J=(v,F)=>F.id===v.id,S=()=>{localStorage.pinnedLogs=[],n(2,s=[])},W=v=>w(v),V=(v,F,$)=>n(2,F[$].showFull=!0,s);function Q(v){_t[v?"unshift":"push"](()=>{l=v,n(0,l)})}return[l,a,s,o,t,i,w,d,E,P,G,C,T,B,K,J,S,W,V,Q]}class Ot extends et{constructor(e){super(),tt(this,e,$t,Tt,lt,{})}}export{Ot as component};

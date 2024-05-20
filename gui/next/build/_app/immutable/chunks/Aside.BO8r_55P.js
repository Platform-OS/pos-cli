import{s as Y,H as N,l as Z,e as E,a as A,c as z,b as S,z as V,g as H,f as v,y as _,E as R,i as y,h as g,B as D,u as x,m as ee,o as te,r as se,k as le,R as ae,S as ie,C as T}from"./scheduler.BBTr9cO0.js";import{S as ne,i as re,c as X,b as j,m as F,t as b,g as G,a as W,d as J,h as $,e as K}from"./index.OwzA_Zvo.js";import{g as oe}from"./globals.D0QH3NT1.js";import{q as fe}from"./index.iVSWiVfi.js";import{s as L}from"./state.BlT1jSvJ.js";import{I as M}from"./Icon.CXB-GF7T.js";const{window:Q}=oe;function B(o){let e,t,l,a=o[1]&&O(o),s=o[0]&&P(o);return{c(){e=E("header"),a&&a.c(),t=A(),s&&s.c(),this.h()},l(i){e=z(i,"HEADER",{class:!0});var n=S(e);a&&a.l(n),t=H(n),s&&s.l(n),n.forEach(v),this.h()},h(){_(e,"class","svelte-1qb9e88")},m(i,n){y(i,e,n),a&&a.m(e,null),g(e,t),s&&s.m(e,null),l=!0},p(i,n){i[1]?a?a.p(i,n):(a=O(i),a.c(),a.m(e,t)):a&&(a.d(1),a=null),i[0]?s?(s.p(i,n),n&1&&b(s,1)):(s=P(i),s.c(),b(s,1),s.m(e,null)):s&&(G(),W(s,1,1,()=>{s=null}),J())},i(i){l||(b(s),l=!0)},o(i){W(s),l=!1},d(i){i&&v(e),a&&a.d(),s&&s.d()}}}function O(o){let e,t;return{c(){e=E("h2"),t=new ae(!1),this.h()},l(l){e=z(l,"H2",{class:!0});var a=S(e);t=ie(a,!1),a.forEach(v),this.h()},h(){t.a=null,_(e,"class","svelte-1qb9e88")},m(l,a){y(l,e,a),t.m(o[1],e)},p(l,a){a&2&&t.p(l[1])},d(l){l&&v(e)}}}function P(o){let e,t,l="Close details",a,s,i;return s=new M({props:{icon:"x"}}),{c(){e=E("a"),t=E("span"),t.textContent=l,a=A(),X(s.$$.fragment),this.h()},l(n){e=z(n,"A",{href:!0,class:!0});var f=S(e);t=z(f,"SPAN",{class:!0,"data-svelte-h":!0}),V(t)!=="svelte-1gxyewl"&&(t.textContent=l),a=H(f),j(s.$$.fragment,f),f.forEach(v),this.h()},h(){_(t,"class","label svelte-1qb9e88"),_(e,"href",o[0]),_(e,"class","close svelte-1qb9e88")},m(n,f){y(n,e,f),g(e,t),g(e,a),F(s,e,null),i=!0},p(n,f){(!i||f&1)&&_(e,"href",n[0])},i(n){i||(b(s.$$.fragment,n),i=!0)},o(n){W(s.$$.fragment,n),i=!1},d(n){n&&v(e),K(s)}}}function ue(o){let e,t,l,a="Drag to resize panel",s,i,n,f,w,q,p,h,k,I;N(o[10]),i=new M({props:{icon:"resizeHorizontal",size:"7"}});let u=(o[1]||o[0])&&B(o);const c=o[9].default,d=Z(c,o,o[8],null);return{c(){e=E("aside"),t=E("button"),l=E("span"),l.textContent=a,s=A(),X(i.$$.fragment),n=A(),f=E("div"),u&&u.c(),w=A(),d&&d.c(),this.h()},l(r){e=z(r,"ASIDE",{style:!0,class:!0});var m=S(e);t=z(m,"BUTTON",{class:!0});var C=S(t);l=z(C,"SPAN",{class:!0,"data-svelte-h":!0}),V(l)!=="svelte-ruxerc"&&(l.textContent=a),s=H(C),j(i.$$.fragment,C),C.forEach(v),n=H(m),f=z(m,"DIV",{class:!0});var U=S(f);u&&u.l(U),w=H(U),d&&d.l(U),U.forEach(v),m.forEach(v),this.h()},h(){_(l,"class","label svelte-1qb9e88"),_(t,"class","resizer svelte-1qb9e88"),R(t,"active",o[3]),_(f,"class","container svelte-1qb9e88"),_(e,"style",q=o[4].asideWidth?`--width: ${o[4].asideWidth}`:""),_(e,"class","svelte-1qb9e88")},m(r,m){y(r,e,m),g(e,t),g(t,l),g(t,s),F(i,t,null),g(e,n),g(e,f),u&&u.m(f,null),g(f,w),d&&d.m(f,null),h=!0,k||(I=[D(Q,"resize",o[10]),D(t,"mousedown",o[6]),D(t,"click",o[7])],k=!0)},p(r,[m]){(!h||m&8)&&R(t,"active",r[3]),r[1]||r[0]?u?(u.p(r,m),m&3&&b(u,1)):(u=B(r),u.c(),b(u,1),u.m(f,w)):u&&(G(),W(u,1,1,()=>{u=null}),J()),d&&d.p&&(!h||m&256)&&x(d,c,r,r[8],h?te(c,r[8],m,null):ee(r[8]),null),(!h||m&16&&q!==(q=r[4].asideWidth?`--width: ${r[4].asideWidth}`:""))&&_(e,"style",q)},i(r){h||(b(i.$$.fragment,r),b(u),b(d,r),r&&N(()=>{h&&(p||(p=$(e,o[5],{},!0)),p.run(1))}),h=!0)},o(r){W(i.$$.fragment,r),W(u),W(d,r),r&&(p||(p=$(e,o[5],{},!1)),p.run(0)),h=!1},d(r){r&&v(e),K(i),u&&u.d(),d&&d.d(r),r&&p&&p.end(),k=!1,se(I)}}}function ce(o,e,t){let l;le(o,L,c=>t(4,l=c));let{$$slots:a={},$$scope:s}=e,{closeUrl:i}=e,{title:n=""}=e,f,w=!1;const q=function(c,{delay:d=0,duration:r=300}){return{delay:d,duration:r,css:m=>{const C=fe(m);return`min-width: 0; width: calc(${l.asideWidth||"30vw"} * ${C});`}}},p=()=>{window.addEventListener("mousemove",k,!1),window.addEventListener("mouseup",h,!1),t(3,w=!0)},h=()=>{window.removeEventListener("mousemove",k,!1),window.removeEventListener("mouseup",h,!1),t(3,w=!1),localStorage.asideWidth=l.asideWidth},k=c=>{T(L,l.asideWidth=f-c.clientX-6+"px",l)},I=c=>{c.detail===2&&(T(L,l.asideWidth=!1,l),localStorage.removeItem("asideWidth"))};function u(){t(2,f=Q.outerWidth)}return o.$$set=c=>{"closeUrl"in c&&t(0,i=c.closeUrl),"title"in c&&t(1,n=c.title),"$$scope"in c&&t(8,s=c.$$scope)},[i,n,f,w,l,q,p,I,s,a,u]}class ge extends ne{constructor(e){super(),re(this,e,ce,ue,Y,{closeUrl:0,title:1})}}export{ge as A};
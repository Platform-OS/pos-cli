import{s as x,e as E,t as z,a as C,c as S,b as U,d as H,f as D,g as R,y as u,M,i as $,h,B as V,C as P,N as j,j as y,O as Z,r as ee,P as ae,H as F,z as ne}from"./scheduler.D91BpYsI.js";import{S as te,i as se,c as G,d as J,m as K,t as Q,a as W,f as X}from"./index.BlSdqSUK.js";import{I as Y}from"./Icon.ziKqNBVf.js";function ie(n){let l,t,b,d,w,c,g,f,L,s,I,r,_,N,T,m,k,p,o,B,A;return c=new Y({props:{icon:n[6]==="navigation"?"arrowLeft":"minus"}}),m=new Y({props:{icon:n[6]==="navigation"?"arrowRight":"minus"}}),{c(){l=E("div"),t=E("button"),b=E("span"),d=z(n[7]),w=C(),G(c.$$.fragment),L=C(),s=E("input"),I=C(),r=E("button"),_=E("span"),N=z(n[8]),T=C(),G(m.$$.fragment),this.h()},l(e){l=S(e,"DIV",{class:!0});var i=U(l);t=S(i,"BUTTON",{form:!0,class:!0,"aria-hidden":!0,"data-action":!0});var a=U(t);b=S(a,"SPAN",{class:!0});var O=U(b);d=H(O,n[7]),O.forEach(D),w=R(a),J(c.$$.fragment,a),a.forEach(D),L=R(i),s=S(i,"INPUT",{form:!0,type:!0,name:!0,id:!0,min:!0,max:!0,step:!0,style:!0,class:!0}),I=R(i),r=S(i,"BUTTON",{form:!0,class:!0,"aria-hidden":!0,"data-action":!0});var v=U(r);_=S(v,"SPAN",{class:!0});var q=U(_);N=H(q,n[8]),q.forEach(D),T=R(v),J(m.$$.fragment,v),v.forEach(D),i.forEach(D),this.h()},h(){var e;u(b,"class","label"),u(t,"form",n[1]),u(t,"class","button svelte-142ypws"),t.disabled=g=n[0]<=n[3],u(t,"aria-hidden",f=n[0]<=n[3]),u(t,"data-action","numberDecrease"),u(s,"form",n[1]),u(s,"type","number"),u(s,"name",n[2]),u(s,"id",n[2]),u(s,"min",n[3]),u(s,"max",n[4]),u(s,"step",n[5]),s.autofocus=n[9],M(s,"--max",(((e=n[4])==null?void 0:e.toString().length)||1)+"ch"),u(s,"class","svelte-142ypws"),u(_,"class","label"),u(r,"form",n[1]),u(r,"class","button svelte-142ypws"),r.disabled=k=n[0]>=n[4],u(r,"aria-hidden",p=n[0]>=n[4]),u(r,"data-action","numberIncrease"),u(l,"class","number svelte-142ypws")},m(e,i){$(e,l,i),h(l,t),h(t,b),h(b,d),h(t,w),K(c,t,null),h(l,L),h(l,s),V(s,n[0]),h(l,I),h(l,r),h(r,_),h(_,N),h(r,T),K(m,r,null),n[17](r),o=!0,n[9]&&s.focus(),B||(A=[P(t,"click",j(n[12])),P(s,"input",n[13]),P(s,"input",j(n[14])),P(s,"focusin",n[15]),P(s,"focusout",n[16]),P(r,"click",j(n[18]))],B=!0)},p(e,[i]){var v;(!o||i&128)&&y(d,e[7]);const a={};i&64&&(a.icon=e[6]==="navigation"?"arrowLeft":"minus"),c.$set(a),(!o||i&2)&&u(t,"form",e[1]),(!o||i&9&&g!==(g=e[0]<=e[3]))&&(t.disabled=g),(!o||i&9&&f!==(f=e[0]<=e[3]))&&u(t,"aria-hidden",f),(!o||i&2)&&u(s,"form",e[1]),(!o||i&4)&&u(s,"name",e[2]),(!o||i&4)&&u(s,"id",e[2]),(!o||i&8)&&u(s,"min",e[3]),(!o||i&16)&&u(s,"max",e[4]),(!o||i&32)&&u(s,"step",e[5]),(!o||i&512)&&(s.autofocus=e[9]),(!o||i&16)&&M(s,"--max",(((v=e[4])==null?void 0:v.toString().length)||1)+"ch"),i&1&&Z(s.value)!==e[0]&&V(s,e[0]),(!o||i&256)&&y(N,e[8]);const O={};i&64&&(O.icon=e[6]==="navigation"?"arrowRight":"minus"),m.$set(O),(!o||i&2)&&u(r,"form",e[1]),(!o||i&17&&k!==(k=e[0]>=e[4]))&&(r.disabled=k),(!o||i&17&&p!==(p=e[0]>=e[4]))&&u(r,"aria-hidden",p)},i(e){o||(Q(c.$$.fragment,e),Q(m.$$.fragment,e),o=!0)},o(e){W(c.$$.fragment,e),W(m.$$.fragment,e),o=!1},d(e){e&&D(l),X(c),X(m),n[17](null),B=!1,ee(A)}}}function ue(n,l,t){let{form:b}=l,{name:d}=l,{min:w=1}=l,{max:c}=l,{step:g=1}=l,{value:f=""}=l,{style:L}=l,{decreaseLabel:s=`Decrease ${d} value`}=l,{increaseLabel:I=`Increase ${d} value`}=l,r=!1,_;const N=ae();let T;function m(a){clearTimeout(T),T=setTimeout(()=>{a.submitter=_,N("input",a)},150)}const k=async a=>{t(0,f=parseInt(f)-1),await F(),m(a)};function p(){f=Z(this.value),t(0,f)}const o=a=>m(a),B=()=>t(9,r=!0),A=()=>t(9,r=!1);function e(a){ne[a?"unshift":"push"](()=>{_=a,t(10,_)})}const i=async a=>{t(0,f=parseInt(f)+1),await F(),m(a)};return n.$$set=a=>{"form"in a&&t(1,b=a.form),"name"in a&&t(2,d=a.name),"min"in a&&t(3,w=a.min),"max"in a&&t(4,c=a.max),"step"in a&&t(5,g=a.step),"value"in a&&t(0,f=a.value),"style"in a&&t(6,L=a.style),"decreaseLabel"in a&&t(7,s=a.decreaseLabel),"increaseLabel"in a&&t(8,I=a.increaseLabel)},[f,b,d,w,c,g,L,s,I,r,_,m,k,p,o,B,A,e,i]}class fe extends te{constructor(l){super(),se(this,l,ue,ie,x,{form:1,name:2,min:3,max:4,step:5,value:0,style:6,decreaseLabel:7,increaseLabel:8})}}export{fe as N};
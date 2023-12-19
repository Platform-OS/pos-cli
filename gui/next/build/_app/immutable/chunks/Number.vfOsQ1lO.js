import{s as y,f as S,l as C,a as A,g as k,h as P,m as H,d as I,c as B,j as u,k as K,i as x,v as _,K as W,x as O,R as z,n as F,V as p,y as $,H as ee,W as ae}from"./scheduler.C43H4T0F.js";import{S as ne,i as te,b as G,d as J,m as M,a as Q,t as X,e as Y}from"./index.JUyE3YTa.js";import{I as Z}from"./Icon.HnzAYZiZ.js";function se(a){let l,t,b,d,w,f,g,o,L,n,N,r,c,E,T,h,s,R,m,V,j;return f=new Z({props:{icon:a[6]==="navigation"?"arrowLeft":"minus"}}),h=new Z({props:{icon:a[6]==="navigation"?"arrowRight":"minus"}}),{c(){l=S("div"),t=S("button"),b=S("span"),d=C(a[7]),w=A(),G(f.$$.fragment),L=A(),n=S("input"),N=A(),r=S("button"),c=S("span"),E=C(a[8]),T=A(),G(h.$$.fragment),this.h()},l(e){l=k(e,"DIV",{class:!0});var i=P(l);t=k(i,"BUTTON",{class:!0,"aria-hidden":!0});var v=P(t);b=k(v,"SPAN",{class:!0});var D=P(b);d=H(D,a[7]),D.forEach(I),w=B(v),J(f.$$.fragment,v),v.forEach(I),L=B(i),n=k(i,"INPUT",{form:!0,type:!0,name:!0,id:!0,min:!0,max:!0,step:!0,style:!0,class:!0}),N=B(i),r=k(i,"BUTTON",{class:!0,"aria-hidden":!0});var U=P(r);c=k(U,"SPAN",{class:!0});var q=P(c);E=H(q,a[8]),q.forEach(I),T=B(U),J(h.$$.fragment,U),U.forEach(I),i.forEach(I),this.h()},h(){u(b,"class","label"),u(t,"class","button svelte-1g961xw"),t.disabled=g=a[0]<=a[3],u(t,"aria-hidden",o=a[0]<=a[3]),u(n,"form",a[1]),u(n,"type","number"),u(n,"name",a[2]),u(n,"id",a[2]),u(n,"min",a[3]),u(n,"max",a[4]),u(n,"step",a[5]),K(n,"--max",(a[4]?.toString().length||1)+"ch"),u(n,"class","svelte-1g961xw"),u(c,"class","label"),u(r,"class","button svelte-1g961xw"),r.disabled=s=a[0]>=a[4],u(r,"aria-hidden",R=a[0]>=a[4]),u(l,"class","number svelte-1g961xw")},m(e,i){x(e,l,i),_(l,t),_(t,b),_(b,d),_(t,w),M(f,t,null),_(l,L),_(l,n),W(n,a[0]),_(l,N),_(l,r),_(r,c),_(c,E),_(r,T),M(h,r,null),m=!0,V||(j=[O(t,"click",z(a[11])),O(n,"input",a[12]),O(n,"input",a[10]),O(r,"click",z(a[13]))],V=!0)},p(e,[i]){(!m||i&128)&&F(d,e[7]);const v={};i&64&&(v.icon=e[6]==="navigation"?"arrowLeft":"minus"),f.$set(v),(!m||i&9&&g!==(g=e[0]<=e[3]))&&(t.disabled=g),(!m||i&9&&o!==(o=e[0]<=e[3]))&&u(t,"aria-hidden",o),(!m||i&2)&&u(n,"form",e[1]),(!m||i&4)&&u(n,"name",e[2]),(!m||i&4)&&u(n,"id",e[2]),(!m||i&8)&&u(n,"min",e[3]),(!m||i&16)&&u(n,"max",e[4]),(!m||i&32)&&u(n,"step",e[5]),(!m||i&16)&&K(n,"--max",(e[4]?.toString().length||1)+"ch"),i&1&&p(n.value)!==e[0]&&W(n,e[0]),(!m||i&256)&&F(E,e[8]);const D={};i&64&&(D.icon=e[6]==="navigation"?"arrowRight":"minus"),h.$set(D),(!m||i&17&&s!==(s=e[0]>=e[4]))&&(r.disabled=s),(!m||i&17&&R!==(R=e[0]>=e[4]))&&u(r,"aria-hidden",R)},i(e){m||(Q(f.$$.fragment,e),Q(h.$$.fragment,e),m=!0)},o(e){X(f.$$.fragment,e),X(h.$$.fragment,e),m=!1},d(e){e&&I(l),Y(f),Y(h),V=!1,$(j)}}}function ie(a,l,t){let{form:b}=l,{name:d}=l,{min:w=1}=l,{max:f}=l,{step:g=1}=l,{value:o=""}=l,{style:L}=l,{decreaseLabel:n=`Decrease ${d} value`}=l,{increaseLabel:N=`Increase ${d} value`}=l;const r=ee();function c(s){ae.call(this,a,s)}const E=()=>{t(0,o=o-1),r("input")};function T(){o=p(this.value),t(0,o)}const h=()=>{t(0,o=o+1),r("input")};return a.$$set=s=>{"form"in s&&t(1,b=s.form),"name"in s&&t(2,d=s.name),"min"in s&&t(3,w=s.min),"max"in s&&t(4,f=s.max),"step"in s&&t(5,g=s.step),"value"in s&&t(0,o=s.value),"style"in s&&t(6,L=s.style),"decreaseLabel"in s&&t(7,n=s.decreaseLabel),"increaseLabel"in s&&t(8,N=s.increaseLabel)},[o,b,d,w,f,g,L,n,N,r,c,E,T,h]}class me extends ne{constructor(l){super(),te(this,l,ie,se,y,{form:1,name:2,min:3,max:4,step:5,value:0,style:6,decreaseLabel:7,increaseLabel:8})}}export{me as N};

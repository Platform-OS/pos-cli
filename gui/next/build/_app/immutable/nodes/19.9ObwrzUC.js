import{s as De,k as ke,v as ve,i as be,f as p,e as d,t as f,a as Re,c as i,b as h,z as g,d as m,g as Te,y as H,E as Z,h as a,j as k,C as ge}from"../chunks/scheduler.CatAnzbk.js";import{S as $e,i as Ee,c as Pe,b as Se,m as Fe,t as Ne,a as ye,e as Le}from"../chunks/index.N6gnbVk9.js";import{p as Ae}from"../chunks/stores.8bRjBDA2.js";import{n as Ie}from"../chunks/network.pAy51ByW.js";import{s as ae}from"../chunks/state.5gKcL4gY.js";import{A as Ue}from"../chunks/Aside.Lf2QZhoZ.js";const Ce={100:"Continue",101:"Switching Protocols",102:"Processing",103:"Early Hints",200:"OK",201:"Created",202:"Accepted",203:"Non-Authoritative Information",204:"No Content",205:"Reset Content",206:"Partial Content",207:"Multi-Status",208:"Already Reported",226:"IM Used",300:"Multiple Choices",301:"Moved Permanently",302:"Found",303:"See Other",304:"Not Modified",305:"Use Proxy",306:"Switch Proxy",307:"Temporary Redirect",308:"Permanent Redirect",400:"Bad Request",401:"Unauthorized",402:"Payment Required",403:"Forbidden",404:"Not Found",405:"Method Not Allowed",406:"Not Acceptable",407:"Proxy Authentication Required",408:"Request Timeout",409:"Conflict",410:"Gone",411:"Length Required",412:"Precondition Failed",413:"Payload Too Large",414:"URI Too Long",415:"Unsupported Media Type",416:"Range Not Satisfiable",417:"Expectation Failed",418:"I'm a teapot",421:"Misdirected Request",422:"Unprocessable Content",423:"Locked",424:"Failed Dependency",425:"Too Early",426:"Upgrade Required",428:"Precondition Required",429:"Too Many Requests",431:"Request Header Fields Too Large",451:"Unavailable For Legal Reasons",500:"Internal Server Error",501:"Not Implemented",502:"Bad Gateway",503:"Service Unavailable",504:"Gateway Timeout",505:"HTTP Version Not Supported",506:"Variant Also Negotiates",507:"Insufficient Storage",508:"Loop Detected",510:"Not Extended",511:"Network Authentication Required"};function qe(n){let e,s,t="Time",r,_=new Date(n[1].network._timestamp/1e3).toLocaleString()+"",c,w,q="Request path",C,v,F=n[1].network.http_request_path+"",B,O,b,re="Request method",N,y=n[1].network.http_request_method+"",V,D,le="Status",u,L=n[1].network.lb_status_code+"",x,ee,A=Ce[n[1].network.lb_status_code]+"",K,R,de="Client IP",I,U=n[1].network.client+"",J,T,ie="Client user agent",M,z=n[1].network.user_agent+"",Q,$,_e="Execution duration",E,j=parseFloat(n[1].network.request_processing_time)+parseFloat(n[1].network.target_processing_time)+"",W,te,P,ue="Response size",S,G=parseInt(n[1].network.sent_bytes)+"",X,oe;return{c(){e=d("dl"),s=d("dt"),s.textContent=t,r=d("dd"),c=f(_),w=d("dt"),w.textContent=q,C=d("dd"),v=d("a"),B=f(F),b=d("dt"),b.textContent=re,N=d("dd"),V=f(y),D=d("dt"),D.textContent=le,u=d("dd"),x=f(L),ee=Re(),K=f(A),R=d("dt"),R.textContent=de,I=d("dd"),J=f(U),T=d("dt"),T.textContent=ie,M=d("dd"),Q=f(z),$=d("dt"),$.textContent=_e,E=d("dd"),W=f(j),te=f("s"),P=d("dt"),P.textContent=ue,S=d("dd"),X=f(G),oe=f(" bytes"),this.h()},l(l){e=i(l,"DL",{class:!0});var o=h(e);s=i(o,"DT",{"data-svelte-h":!0}),g(s)!=="svelte-k4tc9n"&&(s.textContent=t),r=i(o,"DD",{});var pe=h(r);c=m(pe,_),pe.forEach(p),w=i(o,"DT",{"data-svelte-h":!0}),g(w)!=="svelte-1j5pznm"&&(w.textContent=q),C=i(o,"DD",{});var ce=h(C);v=i(ce,"A",{href:!0,class:!0});var fe=h(v);B=m(fe,F),fe.forEach(p),ce.forEach(p),b=i(o,"DT",{"data-svelte-h":!0}),g(b)!=="svelte-1wn7isk"&&(b.textContent=re),N=i(o,"DD",{});var me=h(N);V=m(me,y),me.forEach(p),D=i(o,"DT",{"data-svelte-h":!0}),g(D)!=="svelte-1e9eis"&&(D.textContent=le),u=i(o,"DD",{class:!0});var Y=h(u);x=m(Y,L),ee=Te(Y),K=m(Y,A),Y.forEach(p),R=i(o,"DT",{"data-svelte-h":!0}),g(R)!=="svelte-1rrvc96"&&(R.textContent=de),I=i(o,"DD",{});var he=h(I);J=m(he,U),he.forEach(p),T=i(o,"DT",{"data-svelte-h":!0}),g(T)!=="svelte-on2p8j"&&(T.textContent=ie),M=i(o,"DD",{});var we=h(M);Q=m(we,z),we.forEach(p),$=i(o,"DT",{"data-svelte-h":!0}),g($)!=="svelte-1abn46o"&&($.textContent=_e),E=i(o,"DD",{});var se=h(E);W=m(se,j),te=m(se,"s"),se.forEach(p),P=i(o,"DT",{"data-svelte-h":!0}),g(P)!=="svelte-jqr426"&&(P.textContent=ue),S=i(o,"DD",{});var ne=h(S);X=m(ne,G),oe=m(ne," bytes"),ne.forEach(p),o.forEach(p),this.h()},h(){H(v,"href",O=n[1].network.http_request_url),H(v,"class","svelte-1vnx1x6"),H(u,"class","svelte-1vnx1x6"),Z(u,"success",n[1].network.lb_status_code>=200&&n[1].network.lb_status_code<300),Z(u,"error",n[1].network.http_request_protocol.lb_status_code>=400&&n[1].network.http_request_protocol.lb_status_code<600),H(e,"class","definitions svelte-1vnx1x6")},m(l,o){be(l,e,o),a(e,s),a(e,r),a(r,c),a(e,w),a(e,C),a(C,v),a(v,B),a(e,b),a(e,N),a(N,V),a(e,D),a(e,u),a(u,x),a(u,ee),a(u,K),a(e,R),a(e,I),a(I,J),a(e,T),a(e,M),a(M,Q),a(e,$),a(e,E),a(E,W),a(E,te),a(e,P),a(e,S),a(S,X),a(S,oe)},p(l,o){o&2&&_!==(_=new Date(l[1].network._timestamp/1e3).toLocaleString()+"")&&k(c,_),o&2&&F!==(F=l[1].network.http_request_path+"")&&k(B,F),o&2&&O!==(O=l[1].network.http_request_url)&&H(v,"href",O),o&2&&y!==(y=l[1].network.http_request_method+"")&&k(V,y),o&2&&L!==(L=l[1].network.lb_status_code+"")&&k(x,L),o&2&&A!==(A=Ce[l[1].network.lb_status_code]+"")&&k(K,A),o&2&&Z(u,"success",l[1].network.lb_status_code>=200&&l[1].network.lb_status_code<300),o&2&&Z(u,"error",l[1].network.http_request_protocol.lb_status_code>=400&&l[1].network.http_request_protocol.lb_status_code<600),o&2&&U!==(U=l[1].network.client+"")&&k(J,U),o&2&&z!==(z=l[1].network.user_agent+"")&&k(Q,z),o&2&&j!==(j=parseFloat(l[1].network.request_processing_time)+parseFloat(l[1].network.target_processing_time)+"")&&k(W,j),o&2&&G!==(G=parseInt(l[1].network.sent_bytes)+"")&&k(X,G)},d(l){l&&p(e)}}}function Me(n){let e,s=n[1].network._timestamp&&qe(n);return{c(){s&&s.c(),e=ve()},l(t){s&&s.l(t),e=ve()},m(t,r){s&&s.m(t,r),be(t,e,r)},p(t,r){t[1].network._timestamp?s?s.p(t,r):(s=qe(t),s.c(),s.m(e.parentNode,e)):s&&(s.d(1),s=null)},d(t){t&&p(e),s&&s.d(t)}}}function ze(n){let e,s;return e=new Ue({props:{title:n[1].network.lb_status_code?`<span class="log-detail-method">${n[1].network.http_request_method}</span> ${n[1].network.http_request_path}`:"Loading…",closeUrl:"/network?"+n[0].url.searchParams.toString(),$$slots:{default:[Me]},$$scope:{ctx:n}}}),{c(){Pe(e.$$.fragment)},l(t){Se(e.$$.fragment,t)},m(t,r){Fe(e,t,r),s=!0},p(t,[r]){const _={};r&2&&(_.title=t[1].network.lb_status_code?`<span class="log-detail-method">${t[1].network.http_request_method}</span> ${t[1].network.http_request_path}`:"Loading…"),r&1&&(_.closeUrl="/network?"+t[0].url.searchParams.toString()),r&10&&(_.$$scope={dirty:r,ctx:t}),e.$set(_)},i(t){s||(Ne(e.$$.fragment,t),s=!0)},o(t){ye(e.$$.fragment,t),s=!1},d(t){Le(e,t)}}}function je(n,e,s){let t,r;ke(n,Ae,c=>s(0,t=c)),ke(n,ae,c=>s(1,r=c));const _=async()=>{var w;const c=(w=r.networks.hits)==null?void 0:w.find(q=>q._timestamp==t.params.id);if(c)ge(ae,r.network=c,r);else{const q={size:1,sql:`select * from requests where _timestamp = ${t.params.id}`};await Ie.get(q).then(C=>{ge(ae,r.network=C.hits[0],r)})}};return n.$$.update=()=>{n.$$.dirty&1&&t.params.id&&_()},[t,r]}class Ke extends $e{constructor(e){super(),Ee(this,e,je,ze,De,{})}}export{Ke as component};
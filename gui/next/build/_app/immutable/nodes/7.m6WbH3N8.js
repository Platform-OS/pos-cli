import{s as Rl,e as f,a as O,c as h,b as g,g as D,z as ie,f as _,y as o,i as U,h as n,B as Ee,N as Ul,D as Qt,r as Wt,P as Vl,t as M,d as y,j as Y,G as Ce,p as jl,E as be,A as oe,$ as Zl,F as kl,k as wl,K as Kl,n as zl,a0 as Jl,l as Gl,u as Yl,m as Ql,o as Wl,Z as Tl,a1 as Xl,C as Nl}from"../chunks/scheduler.BBTr9cO0.js";import{S as Hl,i as Bl,c as Ie,b as Oe,m as De,t as V,g as Nt,d as Ct,a as K,e as Le}from"../chunks/index.OwzA_Zvo.js";import{e as Qe}from"../chunks/each.nCJCOoRq.js";import{o as xl,b as es,a as ts}from"../chunks/entry.BXDWtXDC.js";import{p as ls}from"../chunks/stores.gFY2p-4Q.js";import{n as ss}from"../chunks/network.hGAcGvnf.js";import{s as Yt}from"../chunks/state.BlT1jSvJ.js";import{T as as,c as rs}from"../chunks/Toggle.CE815WXG.js";import{I as We}from"../chunks/Icon.CXB-GF7T.js";import{g as ns}from"../chunks/globals.D0QH3NT1.js";const{window:os}=ns;function Cl(t,l,s){const e=t.slice();return e[9]=l[s],e[11]=s,e}function Il(t){let l,s,e=t[9].name+"",a,i,r,u,E,P,p,k,c,b,C,T,w=t[9].name+"",d,N,v,m,q,S,j,ue;return m=new We({props:{icon:"x"}}),{c(){l=f("li"),s=f("a"),a=M(e),r=O(),u=f("form"),E=f("input"),P=O(),p=f("input"),c=O(),b=f("button"),C=f("span"),T=M("Delete '"),d=M(w),N=M("' preset"),v=O(),Ie(m.$$.fragment),q=O(),this.h()},l(A){l=h(A,"LI",{class:!0});var R=g(l);s=h(R,"A",{href:!0,class:!0});var Q=g(s);a=y(Q,e),Q.forEach(_),r=D(R),u=h(R,"FORM",{class:!0});var x=g(u);E=h(x,"INPUT",{type:!0,name:!0}),P=D(x),p=h(x,"INPUT",{type:!0,name:!0}),c=D(x),b=h(x,"BUTTON",{type:!0,class:!0});var G=g(b);C=h(G,"SPAN",{class:!0});var W=g(C);T=y(W,"Delete '"),d=y(W,w),N=y(W,"' preset"),W.forEach(_),v=D(G),Oe(m.$$.fragment,G),G.forEach(_),x.forEach(_),q=D(R),R.forEach(_),this.h()},h(){o(s,"href",i="/network?"+t[9].url),o(s,"class","svelte-778p5v"),o(E,"type","hidden"),o(E,"name","id"),E.value=t[11],o(p,"type","hidden"),o(p,"name","name"),p.value=k=t[9].name,o(C,"class","label"),o(b,"type","submit"),o(b,"class","svelte-778p5v"),o(u,"class","svelte-778p5v"),o(l,"class","svelte-778p5v")},m(A,R){U(A,l,R),n(l,s),n(s,a),n(l,r),n(l,u),n(u,E),n(u,P),n(u,p),n(u,c),n(u,b),n(b,C),n(C,T),n(C,d),n(C,N),n(b,v),De(m,b,null),n(l,q),S=!0,j||(ue=Ee(u,"submit",Ul(t[5])),j=!0)},p(A,R){(!S||R&4)&&e!==(e=A[9].name+"")&&Y(a,e),(!S||R&4&&i!==(i="/network?"+A[9].url))&&o(s,"href",i),(!S||R&4&&k!==(k=A[9].name))&&(p.value=k),(!S||R&4)&&w!==(w=A[9].name+"")&&Y(d,w)},i(A){S||(V(m.$$.fragment,A),S=!0)},o(A){K(m.$$.fragment,A),S=!1},d(A){A&&_(l),Le(m),j=!1,ue()}}}function Ol(t){let l,s="You can save your current filters selection to get back to them quickly in the future.";return{c(){l=f("div"),l.textContent=s,this.h()},l(e){l=h(e,"DIV",{class:!0,"data-svelte-h":!0}),ie(l)!=="svelte-14bf7on"&&(l.textContent=s),this.h()},h(){o(l,"class","message svelte-778p5v")},m(e,a){U(e,l,a)},d(e){e&&_(l)}}}function is(t){let l,s,e,a,i,r,u="Save currently selected filters as new preset",E,P,p,k,c,b,C,T;P=new We({props:{icon:"plus"}});let w=Qe(t[2]),d=[];for(let m=0;m<w.length;m+=1)d[m]=Il(Cl(t,w,m));const N=m=>K(d[m],1,1,()=>{d[m]=null});let v=!t[2].length&&Ol();return{c(){l=f("div"),s=f("form"),e=f("input"),a=O(),i=f("button"),r=f("span"),r.textContent=u,E=O(),Ie(P.$$.fragment),p=O(),k=f("ul");for(let m=0;m<d.length;m+=1)d[m].c();c=O(),v&&v.c(),this.h()},l(m){l=h(m,"DIV",{});var q=g(l);s=h(q,"FORM",{class:!0});var S=g(s);e=h(S,"INPUT",{type:!0,placeholder:!0,class:!0}),a=D(S),i=h(S,"BUTTON",{type:!0,class:!0});var j=g(i);r=h(j,"SPAN",{class:!0,"data-svelte-h":!0}),ie(r)!=="svelte-2dhljl"&&(r.textContent=u),E=D(j),Oe(P.$$.fragment,j),j.forEach(_),S.forEach(_),p=D(q),k=h(q,"UL",{class:!0});var ue=g(k);for(let A=0;A<d.length;A+=1)d[A].l(ue);ue.forEach(_),c=D(q),v&&v.l(q),q.forEach(_),this.h()},h(){o(e,"type","text"),e.required=!0,o(e,"placeholder","Save current view"),o(e,"class","svelte-778p5v"),o(r,"class","label svelte-778p5v"),o(i,"type","submit"),o(i,"class","svelte-778p5v"),o(s,"class","create svelte-778p5v"),o(k,"class","svelte-778p5v")},m(m,q){U(m,l,q),n(l,s),n(s,e),t[6](e),n(s,a),n(s,i),n(i,r),n(i,E),De(P,i,null),n(l,p),n(l,k);for(let S=0;S<d.length;S+=1)d[S]&&d[S].m(k,null);n(l,c),v&&v.m(l,null),t[7](l),b=!0,C||(T=[Ee(os,"keydown",t[3]),Ee(s,"submit",Ul(t[4]))],C=!0)},p(m,[q]){if(q&36){w=Qe(m[2]);let S;for(S=0;S<w.length;S+=1){const j=Cl(m,w,S);d[S]?(d[S].p(j,q),V(d[S],1)):(d[S]=Il(j),d[S].c(),V(d[S],1),d[S].m(k,null))}for(Nt(),S=w.length;S<d.length;S+=1)N(S);Ct()}m[2].length?v&&(v.d(1),v=null):v||(v=Ol(),v.c(),v.m(l,null))},i(m){if(!b){V(P.$$.fragment,m);for(let q=0;q<w.length;q+=1)V(d[q]);b=!0}},o(m){K(P.$$.fragment,m),d=d.filter(Boolean);for(let q=0;q<d.length;q+=1)K(d[q]);b=!1},d(m){m&&_(l),t[6](null),Le(P),Qt(d,m),v&&v.d(),t[7](null),C=!1,Wt(T)}}}function us(t,l,s){let e,a,i=localStorage.posNetworkLogsPresets&&JSON.parse(localStorage.posNetworkLogsPresets)||[{url:"order_by=target_processing_time&order=DESC",name:"Slowest requests"},{url:"aggregate=http_request_path&order_by=median_target_processing_time&order=DESC",name:"Aggregated slowest requests"},{url:"order_by=_timestamp&order=DESC&lb_status_codes=400,401,402,403,404,405,406,407,408,409,410,411,412,413,414,415,416,417,418,419,420,420,421,422,423,424,425,426,427,428,429,431,451",name:"Responded with 4∗∗ error"},{url:"order_by=_timestamp&order=DESC&lb_status_codes=500,501,502,503,504,505,506,507,508,510,511",name:"Responded with 5∗∗ error"}];const r=Vl();function u(c){var b,C,T,w,d,N,v,m,q,S;c.key==="Escape"?r("close"):c.key==="ArrowDown"?e.contains(document.activeElement)?(c.preventDefault(),document.activeElement.matches("input")?(b=e.querySelector("a"))==null||b.focus():(d=(w=(T=(C=document.activeElement)==null?void 0:C.closest("li"))==null?void 0:T.nextElementSibling)==null?void 0:w.querySelector("a"))==null||d.focus()):e.querySelector("li a").focus():c.key==="ArrowUp"?e.contains(document.activeElement)?(c.preventDefault(),(N=document.activeElement)!=null&&N.matches("li:first-child a")?a.focus():(S=(q=(m=(v=document.activeElement)==null?void 0:v.closest("li"))==null?void 0:m.previousElementSibling)==null?void 0:q.querySelector("a"))==null||S.focus()):e.querySelector("li:last-child a").focus():c.key==="Delete"&&e.contains(document.activeElement)&&document.activeElement.matches("a")&&document.activeElement.closest("li").querySelector("form").requestSubmit()}xl(()=>{r("close")});function E(c){let b=new URLSearchParams(document.location.search);b.delete("start_time"),s(2,i=[...i,{url:b.toString(),name:a.value}]),localStorage.posNetworkLogsPresets=JSON.stringify(i),s(1,a.value="",a)}function P(c){const b=new FormData(c.target),C=b.get("id"),T=b.get("name");window.confirm(`Are you sure that you want to delete '${T}' preset?`)&&(i.splice(C,1),s(2,i),localStorage.posNetworkLogsPresets=JSON.stringify(i))}function p(c){Ce[c?"unshift":"push"](()=>{a=c,s(1,a)})}function k(c){Ce[c?"unshift":"push"](()=>{e=c,s(0,e)})}return[e,a,i,u,E,P,p,k]}class _s extends Hl{constructor(l){super(),Bl(this,l,us,is,Rl,{})}}function Dl(t,l,s){const e=t.slice();return e[33]=l[s],e}function Ll(t,l,s){const e=t.slice();return e[36]=l[s],e}function ql(t){let l,s;return l=new _s({}),l.$on("close",t[13]),{c(){Ie(l.$$.fragment)},l(e){Oe(l.$$.fragment,e)},m(e,a){De(l,e,a),s=!0},p:zl,i(e){s||(V(l.$$.fragment,e),s=!0)},o(e){K(l.$$.fragment,e),s=!1},d(e){Le(l,e)}}}function cs(t){let l,s;return l=new We({props:{icon:"sortAZ"}}),{c(){Ie(l.$$.fragment)},l(e){Oe(l.$$.fragment,e)},m(e,a){De(l,e,a),s=!0},i(e){s||(V(l.$$.fragment,e),s=!0)},o(e){K(l.$$.fragment,e),s=!1},d(e){Le(l,e)}}}function fs(t){let l,s;return l=new We({props:{icon:"sortZA"}}),{c(){Ie(l.$$.fragment)},l(e){Oe(l.$$.fragment,e)},m(e,a){De(l,e,a),s=!0},i(e){s||(V(l.$$.fragment,e),s=!0)},o(e){K(l.$$.fragment,e),s=!1},d(e){Le(l,e)}}}function Al(t){let l,s=Qe(t[10].networks.aggs.filters),e=[];for(let a=0;a<s.length;a+=1)e[a]=Ml(Ll(t,s,a));return{c(){l=f("ul");for(let a=0;a<e.length;a+=1)e[a].c();this.h()},l(a){l=h(a,"UL",{class:!0});var i=g(l);for(let r=0;r<e.length;r+=1)e[r].l(i);i.forEach(_),this.h()},h(){o(l,"class","separated svelte-lmet59")},m(a,i){U(a,l,i);for(let r=0;r<e.length;r+=1)e[r]&&e[r].m(l,null)},p(a,i){if(i[0]&1058){s=Qe(a[10].networks.aggs.filters);let r;for(r=0;r<s.length;r+=1){const u=Ll(a,s,r);e[r]?e[r].p(u,i):(e[r]=Ml(u),e[r].c(),e[r].m(l,null))}for(;r<e.length;r+=1)e[r].d(1);e.length=s.length}},d(a){a&&_(l),Qt(e,a)}}}function Ml(t){let l,s,e,a,i=!1,r,u=t[36].lb_status_code+"",E,P,p,k=t[36].count+"",c,b,C,T,w;return C=Jl(t[26][0]),{c(){l=f("li"),s=f("label"),e=f("input"),r=O(),E=M(u),P=O(),p=f("small"),c=M(k),b=O(),this.h()},l(d){l=h(d,"LI",{class:!0});var N=g(l);s=h(N,"LABEL",{class:!0});var v=g(s);e=h(v,"INPUT",{form:!0,type:!0}),r=D(v),E=y(v,u),v.forEach(_),P=D(N),p=h(N,"SMALL",{class:!0});var m=g(p);c=y(m,k),m.forEach(_),b=D(N),N.forEach(_),this.h()},h(){o(e,"form","none"),o(e,"type","checkbox"),e.__value=a=t[36].lb_status_code.toString(),oe(e,e.__value),o(s,"class","svelte-lmet59"),o(p,"class","svelte-lmet59"),o(l,"class","svelte-lmet59"),C.p(e)},m(d,N){U(d,l,N),n(l,s),n(s,e),e.checked=~(t[5]||[]).indexOf(e.__value),n(s,r),n(s,E),n(l,P),n(l,p),n(p,c),n(l,b),T||(w=[Ee(e,"change",t[25]),Ee(e,"change",t[27])],T=!0)},p(d,N){N[0]&1024&&a!==(a=d[36].lb_status_code.toString())&&(e.__value=a,oe(e,e.__value),i=!0),(i||N[0]&1056)&&(e.checked=~(d[5]||[]).indexOf(e.__value)),N[0]&1024&&u!==(u=d[36].lb_status_code+"")&&Y(E,u),N[0]&1024&&k!==(k=d[36].count+"")&&Y(c,k)},d(d){d&&_(l),C.r(),T=!1,Wt(w)}}}function hs(t){let l,s="Time",e,a,i="Status";return{c(){l=f("th"),l.textContent=s,e=O(),a=f("th"),a.textContent=i,this.h()},l(r){l=h(r,"TH",{class:!0,"data-svelte-h":!0}),ie(l)!=="svelte-17osfxn"&&(l.textContent=s),e=D(r),a=h(r,"TH",{class:!0,"data-svelte-h":!0}),ie(a)!=="svelte-bi34jg"&&(a.textContent=i),this.h()},h(){o(l,"class","svelte-lmet59"),o(a,"class","svelte-lmet59")},m(r,u){U(r,l,u),U(r,e,u),U(r,a,u)},d(r){r&&(_(l),_(e),_(a))}}}function ms(t){let l,s="Count";return{c(){l=f("th"),l.textContent=s,this.h()},l(e){l=h(e,"TH",{class:!0,"data-svelte-h":!0}),ie(l)!=="svelte-1i23ozd"&&(l.textContent=s),this.h()},h(){o(l,"class","svelte-lmet59")},m(e,a){U(e,l,a)},d(e){e&&_(l)}}}function yl(t){let l,s=Qe(t[10].networks.aggs.results),e=[];for(let a=0;a<s.length;a+=1)e[a]=$l(Dl(t,s,a));return{c(){l=f("tbody");for(let a=0;a<e.length;a+=1)e[a].c()},l(a){l=h(a,"TBODY",{});var i=g(l);for(let r=0;r<e.length;r+=1)e[r].l(i);i.forEach(_)},m(a,i){U(a,l,i);for(let r=0;r<e.length;r+=1)e[r]&&e[r].m(l,null)},p(a,i){if(i[0]&1536){s=Qe(a[10].networks.aggs.results);let r;for(r=0;r<s.length;r+=1){const u=Dl(a,s,r);e[r]?e[r].p(u,i):(e[r]=$l(u),e[r].c(),e[r].m(l,null))}for(;r<e.length;r+=1)e[r].d(1);e.length=s.length}},d(a){a&&_(l),Qt(e,a)}}}function ds(t){let l,s,e=new Date(t[33]._timestamp/1e3).toLocaleString()+"",a,i,r,u,E,P=t[33].lb_status_code+"",p,k;return{c(){l=f("td"),s=f("a"),a=M(e),r=O(),u=f("td"),E=f("a"),p=M(P),this.h()},l(c){l=h(c,"TD",{class:!0});var b=g(l);s=h(b,"A",{href:!0,class:!0});var C=g(s);a=y(C,e),C.forEach(_),b.forEach(_),r=D(c),u=h(c,"TD",{class:!0});var T=g(u);E=h(T,"A",{href:!0,class:!0});var w=g(E);p=y(w,P),w.forEach(_),T.forEach(_),this.h()},h(){o(s,"href",i="/network/"+t[33]._timestamp+"?"+t[9].url.searchParams.toString()),o(s,"class","svelte-lmet59"),o(l,"class","time svelte-lmet59"),o(E,"href",k="/network/"+t[33]._timestamp+"?"+t[9].url.searchParams.toString()),o(E,"class","svelte-lmet59"),o(u,"class","status svelte-lmet59"),be(u,"success",t[33].lb_status_code>=200&&t[33].lb_status_code<300),be(u,"info",t[33].lb_status_code>=300&&t[33].lb_status_code<400),be(u,"error",t[33].lb_status_code>=400&&t[33].lb_status_code<600)},m(c,b){U(c,l,b),n(l,s),n(s,a),U(c,r,b),U(c,u,b),n(u,E),n(E,p)},p(c,b){b[0]&1024&&e!==(e=new Date(c[33]._timestamp/1e3).toLocaleString()+"")&&Y(a,e),b[0]&1536&&i!==(i="/network/"+c[33]._timestamp+"?"+c[9].url.searchParams.toString())&&o(s,"href",i),b[0]&1024&&P!==(P=c[33].lb_status_code+"")&&Y(p,P),b[0]&1536&&k!==(k="/network/"+c[33]._timestamp+"?"+c[9].url.searchParams.toString())&&o(E,"href",k),b[0]&1024&&be(u,"success",c[33].lb_status_code>=200&&c[33].lb_status_code<300),b[0]&1024&&be(u,"info",c[33].lb_status_code>=300&&c[33].lb_status_code<400),b[0]&1024&&be(u,"error",c[33].lb_status_code>=400&&c[33].lb_status_code<600)},d(c){c&&(_(l),_(r),_(u))}}}function gs(t){let l,s,e=t[33].count+"",a;return{c(){l=f("td"),s=f("div"),a=M(e),this.h()},l(i){l=h(i,"TD",{class:!0});var r=g(l);s=h(r,"DIV",{class:!0});var u=g(s);a=y(u,e),u.forEach(_),r.forEach(_),this.h()},h(){o(s,"class","svelte-lmet59"),o(l,"class","count svelte-lmet59")},m(i,r){U(i,l,r),n(l,s),n(s,a)},p(i,r){r[0]&1024&&e!==(e=i[33].count+"")&&Y(a,e)},d(i){i&&_(l)}}}function ps(t){let l,s,e=t[33].http_request_method+"",a,i,r=t[33].http_request_path+"",u;return{c(){l=f("div"),s=f("span"),a=M(e),i=O(),u=M(r),this.h()},l(E){l=h(E,"DIV",{class:!0});var P=g(l);s=h(P,"SPAN",{class:!0});var p=g(s);a=y(p,e),p.forEach(_),i=D(P),u=y(P,r),P.forEach(_),this.h()},h(){o(s,"class","method svelte-lmet59"),o(l,"class","svelte-lmet59")},m(E,P){U(E,l,P),n(l,s),n(s,a),n(l,i),n(l,u)},p(E,P){P[0]&1024&&e!==(e=E[33].http_request_method+"")&&Y(a,e),P[0]&1024&&r!==(r=E[33].http_request_path+"")&&Y(u,r)},d(E){E&&_(l)}}}function vs(t){let l,s,e,a=t[33].http_request_method+"",i,r,u=t[33].http_request_path+"",E,P;return{c(){l=f("a"),s=f("div"),e=f("span"),i=M(a),r=O(),E=M(u),this.h()},l(p){l=h(p,"A",{href:!0,class:!0});var k=g(l);s=h(k,"DIV",{class:!0});var c=g(s);e=h(c,"SPAN",{class:!0});var b=g(e);i=y(b,a),b.forEach(_),r=D(c),E=y(c,u),c.forEach(_),k.forEach(_),this.h()},h(){o(e,"class","method svelte-lmet59"),o(s,"class","svelte-lmet59"),o(l,"href",P="/network/"+t[33]._timestamp+"?"+t[9].url.searchParams.toString()),o(l,"class","svelte-lmet59")},m(p,k){U(p,l,k),n(l,s),n(s,e),n(e,i),n(s,r),n(s,E)},p(p,k){k[0]&1024&&a!==(a=p[33].http_request_method+"")&&Y(i,a),k[0]&1024&&u!==(u=p[33].http_request_path+"")&&Y(E,u),k[0]&1536&&P!==(P="/network/"+p[33]._timestamp+"?"+p[9].url.searchParams.toString())&&o(l,"href",P)},d(p){p&&_(l)}}}function bs(t){let l,s=Math.round((parseFloat(t[33].median_target_processing_time)+Number.EPSILON)*1e3)/1e3+"",e,a,i;return{c(){l=f("div"),e=M(s),a=M("s"),this.h()},l(r){l=h(r,"DIV",{title:!0,class:!0});var u=g(l);e=y(u,s),a=y(u,"s"),u.forEach(_),this.h()},h(){o(l,"title",i="Median: "+Math.round((parseFloat(t[33].median_target_processing_time)+Number.EPSILON)*1e3)/1e3+"s  \rMean: "+Math.round((parseFloat(t[33].avg_target_processing_time)+Number.EPSILON)*1e3)/1e3+"s  \rMin: "+Math.round((parseFloat(t[33].min_target_processing_time)+Number.EPSILON)*1e3)/1e3+"s  \rMax: "+Math.round((parseFloat(t[33].max_target_processing_time)+Number.EPSILON)*1e3)/1e3+"s"),o(l,"class","svelte-lmet59")},m(r,u){U(r,l,u),n(l,e),n(l,a)},p(r,u){u[0]&1024&&s!==(s=Math.round((parseFloat(r[33].median_target_processing_time)+Number.EPSILON)*1e3)/1e3+"")&&Y(e,s),u[0]&1024&&i!==(i="Median: "+Math.round((parseFloat(r[33].median_target_processing_time)+Number.EPSILON)*1e3)/1e3+"s  \rMean: "+Math.round((parseFloat(r[33].avg_target_processing_time)+Number.EPSILON)*1e3)/1e3+"s  \rMin: "+Math.round((parseFloat(r[33].min_target_processing_time)+Number.EPSILON)*1e3)/1e3+"s  \rMax: "+Math.round((parseFloat(r[33].max_target_processing_time)+Number.EPSILON)*1e3)/1e3+"s")&&o(l,"title",i)},d(r){r&&_(l)}}}function Es(t){let l,s=Math.round((parseFloat(t[33].target_processing_time)+Number.EPSILON)*1e3)/1e3+"",e,a,i;return{c(){l=f("a"),e=M(s),a=M("s"),this.h()},l(r){l=h(r,"A",{href:!0,class:!0});var u=g(l);e=y(u,s),a=y(u,"s"),u.forEach(_),this.h()},h(){o(l,"href",i="/network/"+t[33]._timestamp+"?"+t[9].url.searchParams.toString()),o(l,"class","svelte-lmet59")},m(r,u){U(r,l,u),n(l,e),n(l,a)},p(r,u){u[0]&1024&&s!==(s=Math.round((parseFloat(r[33].target_processing_time)+Number.EPSILON)*1e3)/1e3+"")&&Y(e,s),u[0]&1536&&i!==(i="/network/"+r[33]._timestamp+"?"+r[9].url.searchParams.toString())&&o(l,"href",i)},d(r){r&&_(l)}}}function $l(t){let l,s,e,a,i,r,u,E,P;function p(v,m){return m[0]&512&&(s=null),s==null&&(s=!!v[9].url.searchParams.get("aggregate")),s?gs:ds}let k=p(t,[-1,-1]),c=k(t);function b(v,m){return m[0]&512&&(i=null),i==null&&(i=!v[9].url.searchParams.get("aggregate")),i?vs:ps}let C=b(t,[-1,-1]),T=C(t);function w(v,m){return m[0]&512&&(E=null),E==null&&(E=!v[9].url.searchParams.get("aggregate")),E?Es:bs}let d=w(t,[-1,-1]),N=d(t);return{c(){l=f("tr"),c.c(),e=O(),a=f("td"),T.c(),r=O(),u=f("td"),N.c(),P=O(),this.h()},l(v){l=h(v,"TR",{class:!0});var m=g(l);c.l(m),e=D(m),a=h(m,"TD",{class:!0});var q=g(a);T.l(q),q.forEach(_),r=D(m),u=h(m,"TD",{class:!0});var S=g(u);N.l(S),S.forEach(_),P=D(m),m.forEach(_),this.h()},h(){o(a,"class","request svelte-lmet59"),o(u,"class","duration svelte-lmet59"),o(l,"class","svelte-lmet59"),be(l,"active",t[33]._timestamp&&t[9].params.id==t[33]._timestamp)},m(v,m){U(v,l,m),c.m(l,null),n(l,e),n(l,a),T.m(a,null),n(l,r),n(l,u),N.m(u,null),n(l,P)},p(v,m){k===(k=p(v,m))&&c?c.p(v,m):(c.d(1),c=k(v),c&&(c.c(),c.m(l,e))),C===(C=b(v,m))&&T?T.p(v,m):(T.d(1),T=C(v),T&&(T.c(),T.m(a,null))),d===(d=w(v,m))&&N?N.p(v,m):(N.d(1),N=d(v),N&&(N.c(),N.m(u,null))),m[0]&1536&&be(l,"active",v[33]._timestamp&&v[9].params.id==v[33]._timestamp)},d(v){v&&_(l),c.d(),T.d(),N.d()}}}function Fl(t){let l;const s=t[15].default,e=Gl(s,t,t[14],null);return{c(){e&&e.c()},l(a){e&&e.l(a)},m(a,i){e&&e.m(a,i),l=!0},p(a,i){e&&e.p&&(!l||i[0]&16384)&&Yl(e,s,a,a[14],l?Wl(s,a[14],i,null):Ql(a[14]),null)},i(a){l||(V(e,a),l=!0)},o(a){K(e,a),l=!1},d(a){e&&e.d(a)}}}function Ps(t){var rl,nl,ol,il,ul;let l,s,e,a,i,r,u="Filters",E,P,p,k,c="Choose filters preset",b,C,T,w,d,N="Reset",v,m,q,S,j,ue,A,R,Q,x,G,W,lt='<label for="order_by" class="svelte-lmet59">Sorting</label>',Xe,ee,Z,X,Ve,I,je,te,It,st,at,le,Ot,rt,nt,se,Dt,ot,it,ae,Lt,ut,_t,re,qt,ct,ft,At,_e,me,Mt,ht,de,yt,mt,$t,we,dt,ce,fe,Ft,qe,Ae,Xt='<label for="start_time" class="svelte-lmet59">Time limit</label>',Rt,ne,gt,Ut,ge,Me,xt="Status Code",Ht,pe,Bt,Vt,Ze,Ke,Pe,ze,he,pt,vt,Te,xe=t[9].url.searchParams.get("aggregate")=="http_request_path"?"Aggregated ":"",bt,jt,et=t[9].url.searchParams.get("aggregate")=="http_request_path"?"s":"",Et,Zt,ye,el="Processing Time",Kt,zt,$,Jt,tl;document.title=l="Logs"+((rl=t[10].online)!=null&&rl.MPKIT_URL?": "+t[10].online.MPKIT_URL.replace("https://",""):""),C=new We({props:{icon:"controlls"}}),m=new We({props:{icon:"disable"}});let H=t[7]&&ql(t);Q=new as({props:{name:"aggregate",options:[{value:"http_request_path",label:"Aggregate requests"}],checked:t[9].url.searchParams.get("aggregate")}}),Q.$on("change",t[19]);const ll=[fs,cs],$e=[];function sl(F,L){return L[0]&512&&(dt=null),dt==null&&(dt=F[9].url.searchParams.get("order")==="DESC"||!F[9].url.searchParams.get("order")),dt?0:1}ce=sl(t,[-1,-1]),fe=$e[ce]=ll[ce](t);let z=((ol=(nl=t[10].networks)==null?void 0:nl.aggs)==null?void 0:ol.filters)&&Al(t);function al(F,L){return L[0]&512&&(pt=null),pt==null&&(pt=!!F[9].url.searchParams.get("aggregate")),pt?ms:hs}let Pt=al(t,[-1,-1]),Se=Pt(t),J=((ul=(il=t[10].networks)==null?void 0:il.aggs)==null?void 0:ul.results)&&yl(t),B=t[9].params.id&&Fl(t);return{c(){s=O(),e=f("div"),a=f("nav"),i=f("header"),r=f("h2"),r.textContent=u,E=O(),P=f("nav"),p=f("button"),k=f("span"),k.textContent=c,b=O(),Ie(C.$$.fragment),T=O(),w=f("a"),d=f("span"),d.textContent=N,v=O(),Ie(m.$$.fragment),q=O(),S=f("dialog"),H&&H.c(),ue=O(),A=f("form"),R=f("fieldset"),Ie(Q.$$.fragment),x=O(),G=f("fieldset"),W=f("h3"),W.innerHTML=lt,Xe=O(),ee=f("div"),Z=f("select"),X=f("option"),Ve=M("Count"),te=f("option"),It=M("Request path"),le=f("option"),Ot=M("Processing time"),se=f("option"),Dt=M("Time"),ae=f("option"),Lt=M("Request path"),re=f("option"),qt=M("Processing Time"),At=O(),_e=f("select"),me=f("option"),Mt=M("DESC [Z→A]"),de=f("option"),yt=M("ASC [A→Z]"),$t=O(),we=f("label"),fe.c(),Ft=O(),qe=f("fieldset"),Ae=f("h3"),Ae.innerHTML=Xt,Rt=O(),ne=f("input"),Ut=O(),ge=f("fieldset"),Me=f("h3"),Me.textContent=xt,Ht=O(),pe=f("input"),Bt=O(),z&&z.c(),Vt=O(),Ze=f("section"),Ke=f("article"),Pe=f("table"),ze=f("thead"),he=f("tr"),Se.c(),vt=O(),Te=f("th"),bt=M(xe),jt=M("Request"),Et=M(et),Zt=O(),ye=f("th"),ye.textContent=el,Kt=O(),J&&J.c(),zt=O(),B&&B.c(),this.h()},l(F){jl("svelte-dfdkqr",document.head).forEach(_),s=D(F),e=h(F,"DIV",{class:!0});var ke=g(e);a=h(ke,"NAV",{class:!0});var ve=g(a);i=h(ve,"HEADER",{class:!0});var Fe=g(i);r=h(Fe,"H2",{class:!0,"data-svelte-h":!0}),ie(r)!=="svelte-1ydm89n"&&(r.textContent=u),E=D(Fe),P=h(Fe,"NAV",{class:!0});var Re=g(P);p=h(Re,"BUTTON",{type:!0,title:!0,class:!0});var Ue=g(p);k=h(Ue,"SPAN",{class:!0,"data-svelte-h":!0}),ie(k)!=="svelte-p09m9k"&&(k.textContent=c),b=D(Ue),Oe(C.$$.fragment,Ue),Ue.forEach(_),T=D(Re),w=h(Re,"A",{href:!0,title:!0,class:!0});var He=g(w);d=h(He,"SPAN",{class:!0,"data-svelte-h":!0}),ie(d)!=="svelte-1c96jh2"&&(d.textContent=N),v=D(He),Oe(m.$$.fragment,He),He.forEach(_),Re.forEach(_),Fe.forEach(_),q=D(ve),S=h(ve,"DIALOG",{class:!0});var tt=g(S);H&&H.l(tt),tt.forEach(_),ue=D(ve),A=h(ve,"FORM",{action:!0,id:!0,class:!0});var Ne=g(A);R=h(Ne,"FIELDSET",{class:!0});var _l=g(R);Oe(Q.$$.fragment,_l),_l.forEach(_),x=D(Ne),G=h(Ne,"FIELDSET",{class:!0});var St=g(G);W=h(St,"H3",{class:!0,"data-svelte-h":!0}),ie(W)!=="svelte-e2rbyt"&&(W.innerHTML=lt),Xe=D(St),ee=h(St,"DIV",{class:!0});var Je=g(ee);Z=h(Je,"SELECT",{name:!0,id:!0,class:!0});var Be=g(Z);X=h(Be,"OPTION",{});var cl=g(X);Ve=y(cl,"Count"),cl.forEach(_),te=h(Be,"OPTION",{});var fl=g(te);It=y(fl,"Request path"),fl.forEach(_),le=h(Be,"OPTION",{});var hl=g(le);Ot=y(hl,"Processing time"),hl.forEach(_),se=h(Be,"OPTION",{});var ml=g(se);Dt=y(ml,"Time"),ml.forEach(_),ae=h(Be,"OPTION",{});var dl=g(ae);Lt=y(dl,"Request path"),dl.forEach(_),re=h(Be,"OPTION",{});var gl=g(re);qt=y(gl,"Processing Time"),gl.forEach(_),Be.forEach(_),At=D(Je),_e=h(Je,"SELECT",{name:!0,id:!0,class:!0});var Gt=g(_e);me=h(Gt,"OPTION",{});var pl=g(me);Mt=y(pl,"DESC [Z→A]"),pl.forEach(_),de=h(Gt,"OPTION",{});var vl=g(de);yt=y(vl,"ASC [A→Z]"),vl.forEach(_),Gt.forEach(_),$t=D(Je),we=h(Je,"LABEL",{for:!0,class:!0});var bl=g(we);fe.l(bl),bl.forEach(_),Je.forEach(_),St.forEach(_),Ft=D(Ne),qe=h(Ne,"FIELDSET",{});var kt=g(qe);Ae=h(kt,"H3",{class:!0,"data-svelte-h":!0}),ie(Ae)!=="svelte-kjwpiv"&&(Ae.innerHTML=Xt),Rt=D(kt),ne=h(kt,"INPUT",{type:!0,name:!0,id:!0,min:!0,max:!0,class:!0}),kt.forEach(_),Ut=D(Ne),ge=h(Ne,"FIELDSET",{});var Ge=g(ge);Me=h(Ge,"H3",{class:!0,"data-svelte-h":!0}),ie(Me)!=="svelte-tzgpg7"&&(Me.textContent=xt),Ht=D(Ge),pe=h(Ge,"INPUT",{type:!0,name:!0,class:!0}),Bt=D(Ge),z&&z.l(Ge),Ge.forEach(_),Ne.forEach(_),ve.forEach(_),Vt=D(ke),Ze=h(ke,"SECTION",{class:!0});var El=g(Ze);Ke=h(El,"ARTICLE",{class:!0});var Pl=g(Ke);Pe=h(Pl,"TABLE",{class:!0});var wt=g(Pe);ze=h(wt,"THEAD",{class:!0});var Sl=g(ze);he=h(Sl,"TR",{class:!0});var Ye=g(he);Se.l(Ye),vt=D(Ye),Te=h(Ye,"TH",{class:!0});var Tt=g(Te);bt=y(Tt,xe),jt=y(Tt,"Request"),Et=y(Tt,et),Tt.forEach(_),Zt=D(Ye),ye=h(Ye,"TH",{class:!0,"data-svelte-h":!0}),ie(ye)!=="svelte-1h8jpo9"&&(ye.textContent=el),Ye.forEach(_),Sl.forEach(_),Kt=D(wt),J&&J.l(wt),wt.forEach(_),Pl.forEach(_),El.forEach(_),zt=D(ke),B&&B.l(ke),ke.forEach(_),this.h()},h(){o(r,"class","svelte-lmet59"),o(k,"class","label svelte-lmet59"),o(p,"type","button"),o(p,"title","Saved filters presets"),o(p,"class","svelte-lmet59"),be(p,"active",t[7]),o(d,"class","label svelte-lmet59"),o(w,"href","/network"),o(w,"title","Reset filters"),o(w,"class","reset svelte-lmet59"),o(P,"class","svelte-lmet59"),o(i,"class","svelte-lmet59"),o(S,"class","presets content-context svelte-lmet59"),o(R,"class","toggle svelte-lmet59"),o(W,"class","svelte-lmet59"),X.selected=I=t[9].url.searchParams.get("order_by")==="count",X.__value="count",oe(X,X.__value),X.hidden=je=!t[9].url.searchParams.get("aggregate")&&!t[4],te.selected=st=t[9].url.searchParams.get("order_by")==="http_request_path",te.__value="http_request_path",oe(te,te.__value),te.hidden=at=!t[9].url.searchParams.get("aggregate")&&!t[4],le.selected=rt=t[9].url.searchParams.get("order_by")==="median_target_processing_time",le.__value="median_target_processing_time",oe(le,le.__value),le.hidden=nt=!t[9].url.searchParams.get("aggregate")&&!t[4],se.selected=ot=t[9].url.searchParams.get("order_by")==="_timestamp"||!t[9].url.searchParams.get("order_by")&&!t[9].url.searchParams.get("aggregate"),se.__value="_timestamp",oe(se,se.__value),se.hidden=it=t[9].url.searchParams.get("aggregate")||t[4],ae.selected=ut=t[9].url.searchParams.get("order_by")==="http_request_path",ae.__value="http_request_path",oe(ae,ae.__value),ae.hidden=_t=t[9].url.searchParams.get("aggregate")||t[4],re.selected=ct=t[9].url.searchParams.get("order_by")==="target_processing_time",re.__value="target_processing_time",oe(re,re.__value),re.hidden=ft=t[9].url.searchParams.get("aggregate")||t[4],o(Z,"name","order_by"),o(Z,"id","order_by"),o(Z,"class","svelte-lmet59"),me.__value="DESC",oe(me,me.__value),me.selected=ht=t[9].url.searchParams.get("order")==="DESC",de.__value="ASC",oe(de,de.__value),de.selected=mt=t[9].url.searchParams.get("order")==="ASC",o(_e,"name","order"),o(_e,"id","order"),o(_e,"class","svelte-lmet59"),o(we,"for","order"),o(we,"class","button svelte-lmet59"),o(ee,"class","svelte-lmet59"),o(G,"class","sort svelte-lmet59"),o(Ae,"class","svelte-lmet59"),o(ne,"type","date"),o(ne,"name","start_time"),o(ne,"id","start_time"),o(ne,"min",t[12].toISOString().split("T")[0]),o(ne,"max",t[11].toISOString().split("T")[0]),ne.value=gt=t[9].url.searchParams.get("start_time")||t[11].toISOString().split("T")[0],o(ne,"class","svelte-lmet59"),o(Me,"class","svelte-lmet59"),o(pe,"type","text"),o(pe,"name","lb_status_codes"),o(pe,"class","svelte-lmet59"),o(A,"action",""),o(A,"id","filters"),o(A,"class","svelte-lmet59"),o(a,"class","filters svelte-lmet59"),o(Te,"class","svelte-lmet59"),o(ye,"class","duration svelte-lmet59"),o(he,"class","svelte-lmet59"),o(ze,"class","svelte-lmet59"),o(Pe,"class","svelte-lmet59"),o(Ke,"class","content svelte-lmet59"),o(Ze,"class","container svelte-lmet59"),o(e,"class","page svelte-lmet59")},m(F,L){U(F,s,L),U(F,e,L),n(e,a),n(a,i),n(i,r),n(i,E),n(i,P),n(P,p),n(p,k),n(p,b),De(C,p,null),t[16](p),n(P,T),n(P,w),n(w,d),n(w,v),De(m,w,null),n(a,q),n(a,S),H&&H.m(S,null),t[18](S),n(a,ue),n(a,A),n(A,R),De(Q,R,null),n(A,x),n(A,G),n(G,W),n(G,Xe),n(G,ee),n(ee,Z),n(Z,X),n(X,Ve),n(Z,te),n(te,It),n(Z,le),n(le,Ot),n(Z,se),n(se,Dt),n(Z,ae),n(ae,Lt),n(Z,re),n(re,qt),t[20](Z),n(ee,At),n(ee,_e),n(_e,me),n(me,Mt),n(_e,de),n(de,yt),t[22](_e),n(ee,$t),n(ee,we),$e[ce].m(we,null),n(A,Ft),n(A,qe),n(qe,Ae),n(qe,Rt),n(qe,ne),n(A,Ut),n(A,ge),n(ge,Me),n(ge,Ht),n(ge,pe),oe(pe,t[5]),n(ge,Bt),z&&z.m(ge,null),t[28](A),n(e,Vt),n(e,Ze),n(Ze,Ke),n(Ke,Pe),n(Pe,ze),n(ze,he),Se.m(he,null),n(he,vt),n(he,Te),n(Te,bt),n(Te,jt),n(Te,Et),n(he,Zt),n(he,ye),n(Pe,Kt),J&&J.m(Pe,null),n(e,zt),B&&B.m(e,null),t[29](e),$=!0,Jt||(tl=[Ee(p,"click",t[13]),Zl(j=rs.call(null,S,t[17])),Ee(Z,"change",t[21]),Ee(_e,"change",t[23]),Ee(ne,"input",function(){kl(t[1].requestSubmit())&&t[1].requestSubmit().apply(this,arguments)}),Ee(pe,"input",t[24])],Jt=!0)},p(F,L){var Fe,Re,Ue,He,tt;t=F,(!$||L[0]&1024)&&l!==(l="Logs"+((Fe=t[10].online)!=null&&Fe.MPKIT_URL?": "+t[10].online.MPKIT_URL.replace("https://",""):""))&&(document.title=l),(!$||L[0]&128)&&be(p,"active",t[7]),t[7]?H?(H.p(t,L),L[0]&128&&V(H,1)):(H=ql(t),H.c(),V(H,1),H.m(S,null)):H&&(Nt(),K(H,1,1,()=>{H=null}),Ct()),j&&kl(j.update)&&L[0]&384&&j.update.call(null,t[17]);const ke={};L[0]&512&&(ke.checked=t[9].url.searchParams.get("aggregate")),Q.$set(ke),(!$||L[0]&512&&I!==(I=t[9].url.searchParams.get("order_by")==="count"))&&(X.selected=I),(!$||L[0]&528&&je!==(je=!t[9].url.searchParams.get("aggregate")&&!t[4]))&&(X.hidden=je),(!$||L[0]&512&&st!==(st=t[9].url.searchParams.get("order_by")==="http_request_path"))&&(te.selected=st),(!$||L[0]&528&&at!==(at=!t[9].url.searchParams.get("aggregate")&&!t[4]))&&(te.hidden=at),(!$||L[0]&512&&rt!==(rt=t[9].url.searchParams.get("order_by")==="median_target_processing_time"))&&(le.selected=rt),(!$||L[0]&528&&nt!==(nt=!t[9].url.searchParams.get("aggregate")&&!t[4]))&&(le.hidden=nt),(!$||L[0]&512&&ot!==(ot=t[9].url.searchParams.get("order_by")==="_timestamp"||!t[9].url.searchParams.get("order_by")&&!t[9].url.searchParams.get("aggregate")))&&(se.selected=ot),(!$||L[0]&528&&it!==(it=t[9].url.searchParams.get("aggregate")||t[4]))&&(se.hidden=it),(!$||L[0]&512&&ut!==(ut=t[9].url.searchParams.get("order_by")==="http_request_path"))&&(ae.selected=ut),(!$||L[0]&528&&_t!==(_t=t[9].url.searchParams.get("aggregate")||t[4]))&&(ae.hidden=_t),(!$||L[0]&512&&ct!==(ct=t[9].url.searchParams.get("order_by")==="target_processing_time"))&&(re.selected=ct),(!$||L[0]&528&&ft!==(ft=t[9].url.searchParams.get("aggregate")||t[4]))&&(re.hidden=ft),(!$||L[0]&512&&ht!==(ht=t[9].url.searchParams.get("order")==="DESC"))&&(me.selected=ht),(!$||L[0]&512&&mt!==(mt=t[9].url.searchParams.get("order")==="ASC"))&&(de.selected=mt);let ve=ce;ce=sl(t,L),ce!==ve&&(Nt(),K($e[ve],1,1,()=>{$e[ve]=null}),Ct(),fe=$e[ce],fe||(fe=$e[ce]=ll[ce](t),fe.c()),V(fe,1),fe.m(we,null)),(!$||L[0]&512&&gt!==(gt=t[9].url.searchParams.get("start_time")||t[11].toISOString().split("T")[0]))&&(ne.value=gt),L[0]&32&&pe.value!==t[5]&&oe(pe,t[5]),(Ue=(Re=t[10].networks)==null?void 0:Re.aggs)!=null&&Ue.filters?z?z.p(t,L):(z=Al(t),z.c(),z.m(ge,null)):z&&(z.d(1),z=null),Pt!==(Pt=al(t,L))&&(Se.d(1),Se=Pt(t),Se&&(Se.c(),Se.m(he,vt))),(!$||L[0]&512)&&xe!==(xe=t[9].url.searchParams.get("aggregate")=="http_request_path"?"Aggregated ":"")&&Y(bt,xe),(!$||L[0]&512)&&et!==(et=t[9].url.searchParams.get("aggregate")=="http_request_path"?"s":"")&&Y(Et,et),(tt=(He=t[10].networks)==null?void 0:He.aggs)!=null&&tt.results?J?J.p(t,L):(J=yl(t),J.c(),J.m(Pe,null)):J&&(J.d(1),J=null),t[9].params.id?B?(B.p(t,L),L[0]&512&&V(B,1)):(B=Fl(t),B.c(),V(B,1),B.m(e,null)):B&&(Nt(),K(B,1,1,()=>{B=null}),Ct())},i(F){$||(V(C.$$.fragment,F),V(m.$$.fragment,F),V(H),V(Q.$$.fragment,F),V(fe),V(B),$=!0)},o(F){K(C.$$.fragment,F),K(m.$$.fragment,F),K(H),K(Q.$$.fragment,F),K(fe),K(B),$=!1},d(F){F&&(_(s),_(e)),Le(C),t[16](null),Le(m),H&&H.d(),t[18](null),Le(Q),t[20](null),t[22](null),$e[ce].d(),z&&z.d(),t[28](null),Se.d(),J&&J.d(),B&&B.d(),t[29](null),Jt=!1,Wt(tl)}}}function Ss(t,l,s){var Ve;let e,a;wl(t,ls,I=>s(9,e=I)),wl(t,Yt,I=>s(10,a=I));let{$$slots:i={},$$scope:r}=l,u,E;const P=new Date,p=1e3*60*60*24,k=new Date(P-p*3);let c,b,C=!!e.url.searchParams.get("aggregated"),T=((Ve=e.url.searchParams.get("lb_status_codes"))==null?void 0:Ve.split(","))||[],w=!1,d=!1,N;function v(I){a.networks.aggs&&Nl(Yt,a.networks.aggs.results=[],a),ss.get(I).then(je=>{Nl(Yt,a.networks=je,a)})}Kl(()=>{v(Object.fromEntries(e.url.searchParams))});let m=e.url.searchParams.toString();es(()=>{m=e.url.searchParams.toString()}),ts(()=>{var I;m!==e.url.searchParams.toString()&&(v(Object.fromEntries(e.url.searchParams)),m=e.url.searchParams.toString(),s(5,T=((I=e.url.searchParams.get("lb_status_codes"))==null?void 0:I.split(","))||[]))});function q(I){w.open?(w.close(),s(7,d=!1)):(w.show(),s(7,d=!0))}const S=[[]];function j(I){Ce[I?"unshift":"push"](()=>{N=I,s(8,N)})}const ue=I=>d&&I.target!==N&&q();function A(I){Ce[I?"unshift":"push"](()=>{w=I,s(6,w)})}const R=async I=>{s(4,C=!!I.target.checked),await Tl(),s(2,c.value=I.target.checked?"count":"_timestamp",c),console.log(c.value),s(3,b.value="DESC",b),await Tl(),E.requestSubmit()};function Q(I){Ce[I?"unshift":"push"](()=>{c=I,s(2,c)})}const x=()=>E.requestSubmit();function G(I){Ce[I?"unshift":"push"](()=>{b=I,s(3,b)})}const W=()=>E.requestSubmit();function lt(){T=this.value,s(5,T)}function Xe(){T=Xl(S[0],this.__value,this.checked),s(5,T)}const ee=()=>{E.requestSubmit()};function Z(I){Ce[I?"unshift":"push"](()=>{E=I,s(1,E)})}function X(I){Ce[I?"unshift":"push"](()=>{u=I,s(0,u)})}return t.$$set=I=>{"$$scope"in I&&s(14,r=I.$$scope)},[u,E,c,b,C,T,w,d,N,e,a,P,k,q,r,i,j,ue,A,R,Q,x,G,W,lt,Xe,S,ee,Z,X]}class As extends Hl{constructor(l){super(),Bl(this,l,Ss,Ps,Rl,{},null,[-1,-1])}}export{As as component};

"use strict";(self.webpackChunk_platformos_gui=self.webpackChunk_platformos_gui||[]).push([[574,480],{7480:(E,g,c)=>{c.r(g),c.d(g,{C:()=>v,c:()=>C});var r=c(5421),O=Object.defineProperty,h=(m,l)=>O(m,"name",{value:l,configurable:!0});function i(m,l){for(var o=0;o<l.length;o++){const t=l[o];if(typeof t!="string"&&!Array.isArray(t)){for(const n in t)if(n!=="default"&&!(n in m)){const e=Object.getOwnPropertyDescriptor(t,n);e&&Object.defineProperty(m,n,e.get?e:{enumerable:!0,get:()=>t[n]})}}}return Object.freeze(Object.defineProperty(m,Symbol.toStringTag,{value:"Module"}))}h(i,"_mergeNamespaces");var d=(0,r.r)();const v=(0,r.g)(d),C=i({__proto__:null,default:v},[d])},1574:(E,g,c)=>{c.r(g);var r=c(7480),O=c(5421),h=Object.defineProperty,i=(o,t)=>h(o,"name",{value:t,configurable:!0});r.C.defineOption("info",!1,(o,t,n)=>{if(n&&n!==r.C.Init){const e=o.state.info.onMouseOver;r.C.off(o.getWrapperElement(),"mouseover",e),clearTimeout(o.state.info.hoverTimeout),delete o.state.info}if(t){const e=o.state.info=d(t);e.onMouseOver=C.bind(null,o),r.C.on(o.getWrapperElement(),"mouseover",e.onMouseOver)}});function d(o){return{options:o instanceof Function?{render:o}:o===!0?{}:o}}i(d,"createState");function v(o){const{options:t}=o.state.info;return(t==null?void 0:t.hoverTime)||500}i(v,"getHoverTime");function C(o,t){const n=o.state.info,e=t.target||t.srcElement;if(!(e instanceof HTMLElement)||e.nodeName!=="SPAN"||n.hoverTimeout!==void 0)return;const s=e.getBoundingClientRect(),u=i(function(){clearTimeout(n.hoverTimeout),n.hoverTimeout=setTimeout(f,p)},"onMouseMove"),a=i(function(){r.C.off(document,"mousemove",u),r.C.off(o.getWrapperElement(),"mouseout",a),clearTimeout(n.hoverTimeout),n.hoverTimeout=void 0},"onMouseOut"),f=i(function(){r.C.off(document,"mousemove",u),r.C.off(o.getWrapperElement(),"mouseout",a),n.hoverTimeout=void 0,m(o,s)},"onHover"),p=v(o);n.hoverTimeout=setTimeout(f,p),r.C.on(document,"mousemove",u),r.C.on(o.getWrapperElement(),"mouseout",a)}i(C,"onMouseOver");function m(o,t){const n=o.coordsChar({left:(t.left+t.right)/2,top:(t.top+t.bottom)/2},"window"),e=o.state.info,{options:s}=e,u=s.render||o.getHelper(n,"info");if(u){const a=o.getTokenAt(n,!0);if(a){const f=u(a,s,o,n);f&&l(o,t,f)}}}i(m,"onMouseHover");function l(o,t,n){const e=document.createElement("div");e.className="CodeMirror-info",e.append(n),document.body.append(e);const s=e.getBoundingClientRect(),u=window.getComputedStyle(e),a=s.right-s.left+parseFloat(u.marginLeft)+parseFloat(u.marginRight),f=s.bottom-s.top+parseFloat(u.marginTop)+parseFloat(u.marginBottom);let p=t.bottom;f>window.innerHeight-t.bottom-15&&t.top>window.innerHeight-t.bottom&&(p=t.top-f),p<0&&(p=t.bottom);let _=Math.max(0,window.innerWidth-a-15);_>t.left&&(_=t.left),e.style.opacity="1",e.style.top=p+"px",e.style.left=_+"px";let M;const y=i(function(){clearTimeout(M)},"onMouseOverPopup"),T=i(function(){clearTimeout(M),M=setTimeout(b,200)},"onMouseOut"),b=i(function(){r.C.off(e,"mouseover",y),r.C.off(e,"mouseout",T),r.C.off(o.getWrapperElement(),"mouseout",T),e.style.opacity?(e.style.opacity="0",setTimeout(()=>{e.parentNode&&e.remove()},600)):e.parentNode&&e.remove()},"hidePopup");r.C.on(e,"mouseover",y),r.C.on(e,"mouseout",T),r.C.on(o.getWrapperElement(),"mouseout",T)}i(l,"showPopup")}}]);

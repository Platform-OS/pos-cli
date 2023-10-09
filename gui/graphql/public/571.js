"use strict";(self.webpackChunk_platformos_gui=self.webpackChunk_platformos_gui||[]).push([[571],{5708:($,z,I)=>{I.d(z,{r:()=>_});var V=I(5421),J=Object.defineProperty,k=(W,U)=>J(W,"name",{value:U,configurable:!0}),Q={exports:{}},P;function _(){return P||(P=1,function(W,U){(function(A){A((0,V.r)())})(function(A){var B=/MSIE \d/.test(navigator.userAgent)&&(document.documentMode==null||document.documentMode<8),F=A.Pos,T={"(":")>",")":"(<","[":"]>","]":"[<","{":"}>","}":"{<","<":">>",">":"<<"};function S(m){return m&&m.bracketRegex||/[(){}[\]]/}k(S,"bracketRegex");function g(m,L,v){var R=m.getLineHandle(L.line),x=L.ch-1,y=v&&v.afterCursor;y==null&&(y=/(^| )cm-fat-cursor($| )/.test(m.getWrapperElement().className));var a=S(v),i=!y&&x>=0&&a.test(R.text.charAt(x))&&T[R.text.charAt(x)]||a.test(R.text.charAt(x+1))&&T[R.text.charAt(++x)];if(!i)return null;var s=i.charAt(1)==">"?1:-1;if(v&&v.strict&&s>0!=(x==L.ch))return null;var h=m.getTokenTypeAt(F(L.line,x+1)),f=p(m,F(L.line,x+(s>0?1:0)),s,h,v);return f==null?null:{from:F(L.line,x),to:f&&f.pos,match:f&&f.ch==i.charAt(0),forward:s>0}}k(g,"findMatchingBracket");function p(m,L,v,R,x){for(var y=x&&x.maxScanLineLength||1e4,a=x&&x.maxScanLines||1e3,i=[],s=S(x),h=v>0?Math.min(L.line+a,m.lastLine()+1):Math.max(m.firstLine()-1,L.line-a),f=L.line;f!=h;f+=v){var d=m.getLine(f);if(d){var e=v>0?0:d.length-1,t=v>0?d.length:-1;if(!(d.length>y))for(f==L.line&&(e=L.ch-(v<0?1:0));e!=t;e+=v){var n=d.charAt(e);if(s.test(n)&&(R===void 0||(m.getTokenTypeAt(F(f,e+1))||"")==(R||""))){var r=T[n];if(r&&r.charAt(1)==">"==v>0)i.push(n);else if(i.length)i.pop();else return{pos:F(f,e),ch:n}}}}}return f-v==(v>0?m.lastLine():m.firstLine())?!1:null}k(p,"scanForBracket");function K(m,L,v){for(var R=m.state.matchBrackets.maxHighlightLineLength||1e3,x=v&&v.highlightNonMatching,y=[],a=m.listSelections(),i=0;i<a.length;i++){var s=a[i].empty()&&g(m,a[i].head,v);if(s&&(s.match||x!==!1)&&m.getLine(s.from.line).length<=R){var h=s.match?"CodeMirror-matchingbracket":"CodeMirror-nonmatchingbracket";y.push(m.markText(s.from,F(s.from.line,s.from.ch+1),{className:h})),s.to&&m.getLine(s.to.line).length<=R&&y.push(m.markText(s.to,F(s.to.line,s.to.ch+1),{className:h}))}}if(y.length){B&&m.state.focused&&m.focus();var f=k(function(){m.operation(function(){for(var d=0;d<y.length;d++)y[d].clear()})},"clear");if(L)setTimeout(f,800);else return f}}k(K,"matchBrackets");function O(m){m.operation(function(){m.state.matchBrackets.currentlyHighlighted&&(m.state.matchBrackets.currentlyHighlighted(),m.state.matchBrackets.currentlyHighlighted=null),m.state.matchBrackets.currentlyHighlighted=K(m,!1,m.state.matchBrackets)})}k(O,"doMatchBrackets");function D(m){m.state.matchBrackets&&m.state.matchBrackets.currentlyHighlighted&&(m.state.matchBrackets.currentlyHighlighted(),m.state.matchBrackets.currentlyHighlighted=null)}k(D,"clearHighlighted"),A.defineOption("matchBrackets",!1,function(m,L,v){v&&v!=A.Init&&(m.off("cursorActivity",O),m.off("focus",O),m.off("blur",D),D(m)),L&&(m.state.matchBrackets=typeof L=="object"?L:{},m.on("cursorActivity",O),m.on("focus",O),m.on("blur",D))}),A.defineExtension("matchBrackets",function(){K(this,!0)}),A.defineExtension("findMatchingBracket",function(m,L,v){return(v||typeof L=="boolean")&&(v?(v.strict=L,L=v):L=L?{strict:!0}:null),g(this,m,L)}),A.defineExtension("scanForBracket",function(m,L,v,R){return p(this,m,L,v,R)})})}()),Q.exports}k(_,"requireMatchbrackets")},4124:($,z,I)=>{I.d(z,{r:()=>_});var V=I(5421),J=Object.defineProperty,k=(W,U)=>J(W,"name",{value:U,configurable:!0}),Q={exports:{}},P;function _(){return P||(P=1,function(W,U){(function(A){A((0,V.r)())})(function(A){var B=A.Pos;function F(a){var i=a.flags;return i!=null?i:(a.ignoreCase?"i":"")+(a.global?"g":"")+(a.multiline?"m":"")}k(F,"regexpFlags");function T(a,i){for(var s=F(a),h=s,f=0;f<i.length;f++)h.indexOf(i.charAt(f))==-1&&(h+=i.charAt(f));return s==h?a:new RegExp(a.source,h)}k(T,"ensureFlags");function S(a){return/\\s|\\n|\n|\\W|\\D|\[\^/.test(a.source)}k(S,"maybeMultiline");function g(a,i,s){i=T(i,"g");for(var h=s.line,f=s.ch,d=a.lastLine();h<=d;h++,f=0){i.lastIndex=f;var e=a.getLine(h),t=i.exec(e);if(t)return{from:B(h,t.index),to:B(h,t.index+t[0].length),match:t}}}k(g,"searchRegexpForward");function p(a,i,s){if(!S(i))return g(a,i,s);i=T(i,"gm");for(var h,f=1,d=s.line,e=a.lastLine();d<=e;){for(var t=0;t<f&&!(d>e);t++){var n=a.getLine(d++);h=h==null?n:h+`
`+n}f=f*2,i.lastIndex=s.ch;var r=i.exec(h);if(r){var o=h.slice(0,r.index).split(`
`),l=r[0].split(`
`),c=s.line+o.length-1,u=o[o.length-1].length;return{from:B(c,u),to:B(c+l.length-1,l.length==1?u+l[0].length:l[l.length-1].length),match:r}}}}k(p,"searchRegexpForwardMultiline");function K(a,i,s){for(var h,f=0;f<=a.length;){i.lastIndex=f;var d=i.exec(a);if(!d)break;var e=d.index+d[0].length;if(e>a.length-s)break;(!h||e>h.index+h[0].length)&&(h=d),f=d.index+1}return h}k(K,"lastMatchIn");function O(a,i,s){i=T(i,"g");for(var h=s.line,f=s.ch,d=a.firstLine();h>=d;h--,f=-1){var e=a.getLine(h),t=K(e,i,f<0?0:e.length-f);if(t)return{from:B(h,t.index),to:B(h,t.index+t[0].length),match:t}}}k(O,"searchRegexpBackward");function D(a,i,s){if(!S(i))return O(a,i,s);i=T(i,"gm");for(var h,f=1,d=a.getLine(s.line).length-s.ch,e=s.line,t=a.firstLine();e>=t;){for(var n=0;n<f&&e>=t;n++){var r=a.getLine(e--);h=h==null?r:r+`
`+h}f*=2;var o=K(h,i,d);if(o){var l=h.slice(0,o.index).split(`
`),c=o[0].split(`
`),u=e+l.length,C=l[l.length-1].length;return{from:B(u,C),to:B(u+c.length-1,c.length==1?C+c[0].length:c[c.length-1].length),match:o}}}}k(D,"searchRegexpBackwardMultiline");var m,L;String.prototype.normalize?(m=k(function(a){return a.normalize("NFD").toLowerCase()},"doFold"),L=k(function(a){return a.normalize("NFD")},"noFold")):(m=k(function(a){return a.toLowerCase()},"doFold"),L=k(function(a){return a},"noFold"));function v(a,i,s,h){if(a.length==i.length)return s;for(var f=0,d=s+Math.max(0,a.length-i.length);;){if(f==d)return f;var e=f+d>>1,t=h(a.slice(0,e)).length;if(t==s)return e;t>s?d=e:f=e+1}}k(v,"adjustPos");function R(a,i,s,h){if(!i.length)return null;var f=h?m:L,d=f(i).split(/\r|\n\r?/);e:for(var e=s.line,t=s.ch,n=a.lastLine()+1-d.length;e<=n;e++,t=0){var r=a.getLine(e).slice(t),o=f(r);if(d.length==1){var l=o.indexOf(d[0]);if(l==-1)continue e;var s=v(r,o,l,f)+t;return{from:B(e,v(r,o,l,f)+t),to:B(e,v(r,o,l+d[0].length,f)+t)}}else{var c=o.length-d[0].length;if(o.slice(c)!=d[0])continue e;for(var u=1;u<d.length-1;u++)if(f(a.getLine(e+u))!=d[u])continue e;var C=a.getLine(e+d.length-1),b=f(C),M=d[d.length-1];if(b.slice(0,M.length)!=M)continue e;return{from:B(e,v(r,o,c,f)+t),to:B(e+d.length-1,v(C,b,M.length,f))}}}}k(R,"searchStringForward");function x(a,i,s,h){if(!i.length)return null;var f=h?m:L,d=f(i).split(/\r|\n\r?/);e:for(var e=s.line,t=s.ch,n=a.firstLine()-1+d.length;e>=n;e--,t=-1){var r=a.getLine(e);t>-1&&(r=r.slice(0,t));var o=f(r);if(d.length==1){var l=o.lastIndexOf(d[0]);if(l==-1)continue e;return{from:B(e,v(r,o,l,f)),to:B(e,v(r,o,l+d[0].length,f))}}else{var c=d[d.length-1];if(o.slice(0,c.length)!=c)continue e;for(var u=1,s=e-d.length+1;u<d.length-1;u++)if(f(a.getLine(s+u))!=d[u])continue e;var C=a.getLine(e+1-d.length),b=f(C);if(b.slice(b.length-d[0].length)!=d[0])continue e;return{from:B(e+1-d.length,v(C,b,C.length-d[0].length,f)),to:B(e,v(r,o,c.length,f))}}}}k(x,"searchStringBackward");function y(a,i,s,h){this.atOccurrence=!1,this.afterEmptyMatch=!1,this.doc=a,s=s?a.clipPos(s):B(0,0),this.pos={from:s,to:s};var f;typeof h=="object"?f=h.caseFold:(f=h,h=null),typeof i=="string"?(f==null&&(f=!1),this.matches=function(d,e){return(d?x:R)(a,i,e,f)}):(i=T(i,"gm"),!h||h.multiline!==!1?this.matches=function(d,e){return(d?D:p)(a,i,e)}:this.matches=function(d,e){return(d?O:g)(a,i,e)})}k(y,"SearchCursor"),y.prototype={findNext:function(){return this.find(!1)},findPrevious:function(){return this.find(!0)},find:function(a){var i=this.doc.clipPos(a?this.pos.from:this.pos.to);if(this.afterEmptyMatch&&this.atOccurrence&&(i=B(i.line,i.ch),a?(i.ch--,i.ch<0&&(i.line--,i.ch=(this.doc.getLine(i.line)||"").length)):(i.ch++,i.ch>(this.doc.getLine(i.line)||"").length&&(i.ch=0,i.line++)),A.cmpPos(i,this.doc.clipPos(i))!=0))return this.atOccurrence=!1;var s=this.matches(a,i);if(this.afterEmptyMatch=s&&A.cmpPos(s.from,s.to)==0,s)return this.pos=s,this.atOccurrence=!0,this.pos.match||!0;var h=B(a?this.doc.firstLine():this.doc.lastLine()+1,0);return this.pos={from:h,to:h},this.atOccurrence=!1},from:function(){if(this.atOccurrence)return this.pos.from},to:function(){if(this.atOccurrence)return this.pos.to},replace:function(a,i){if(this.atOccurrence){var s=A.splitLines(a);this.doc.replaceRange(s,this.pos.from,this.pos.to,i),this.pos.to=B(this.pos.from.line+s.length-1,s[s.length-1].length+(s.length==1?this.pos.from.ch:0))}}},A.defineExtension("getSearchCursor",function(a,i,s){return new y(this.doc,a,i,s)}),A.defineDocExtension("getSearchCursor",function(a,i,s){return new y(this,a,i,s)}),A.defineExtension("selectMatches",function(a,i){for(var s=[],h=this.getSearchCursor(a,this.getCursor("from"),i);h.findNext()&&!(A.cmpPos(h.to(),this.getCursor("to"))>0);)s.push({anchor:h.from(),head:h.to()});s.length&&this.setSelections(s,0)})})}()),Q.exports}k(_,"requireSearchcursor")},3571:($,z,I)=>{I.r(z),I.d(z,{s:()=>B});var V=I(5421),J=I(4124),k=I(5708),Q=Object.defineProperty,P=(F,T)=>Q(F,"name",{value:T,configurable:!0});function _(F,T){for(var S=0;S<T.length;S++){const g=T[S];if(typeof g!="string"&&!Array.isArray(g)){for(const p in g)if(p!=="default"&&!(p in F)){const K=Object.getOwnPropertyDescriptor(g,p);K&&Object.defineProperty(F,p,K.get?K:{enumerable:!0,get:()=>g[p]})}}}return Object.freeze(Object.defineProperty(F,Symbol.toStringTag,{value:"Module"}))}P(_,"_mergeNamespaces");var W={exports:{}};(function(F,T){(function(S){S((0,V.r)(),(0,J.r)(),(0,k.r)())})(function(S){var g=S.commands,p=S.Pos;function K(e,t,n){if(n<0&&t.ch==0)return e.clipPos(p(t.line-1));var r=e.getLine(t.line);if(n>0&&t.ch>=r.length)return e.clipPos(p(t.line+1,0));for(var o="start",l,c=t.ch,u=c,C=n<0?0:r.length,b=0;u!=C;u+=n,b++){var M=r.charAt(n<0?u-1:u),w=M!="_"&&S.isWordChar(M)?"w":"o";if(w=="w"&&M.toUpperCase()==M&&(w="W"),o=="start")w!="o"?(o="in",l=w):c=u+n;else if(o=="in"&&l!=w){if(l=="w"&&w=="W"&&n<0&&u--,l=="W"&&w=="w"&&n>0)if(u==c+1){l="w";continue}else u--;break}}return p(t.line,u)}P(K,"findPosSubword");function O(e,t){e.extendSelectionsBy(function(n){return e.display.shift||e.doc.extend||n.empty()?K(e.doc,n.head,t):t<0?n.from():n.to()})}P(O,"moveSubword"),g.goSubwordLeft=function(e){O(e,-1)},g.goSubwordRight=function(e){O(e,1)},g.scrollLineUp=function(e){var t=e.getScrollInfo();if(!e.somethingSelected()){var n=e.lineAtHeight(t.top+t.clientHeight,"local");e.getCursor().line>=n&&e.execCommand("goLineUp")}e.scrollTo(null,t.top-e.defaultTextHeight())},g.scrollLineDown=function(e){var t=e.getScrollInfo();if(!e.somethingSelected()){var n=e.lineAtHeight(t.top,"local")+1;e.getCursor().line<=n&&e.execCommand("goLineDown")}e.scrollTo(null,t.top+e.defaultTextHeight())},g.splitSelectionByLine=function(e){for(var t=e.listSelections(),n=[],r=0;r<t.length;r++)for(var o=t[r].from(),l=t[r].to(),c=o.line;c<=l.line;++c)l.line>o.line&&c==l.line&&l.ch==0||n.push({anchor:c==o.line?o:p(c,0),head:c==l.line?l:p(c)});e.setSelections(n,0)},g.singleSelectionTop=function(e){var t=e.listSelections()[0];e.setSelection(t.anchor,t.head,{scroll:!1})},g.selectLine=function(e){for(var t=e.listSelections(),n=[],r=0;r<t.length;r++){var o=t[r];n.push({anchor:p(o.from().line,0),head:p(o.to().line+1,0)})}e.setSelections(n)};function D(e,t){if(e.isReadOnly())return S.Pass;e.operation(function(){for(var n=e.listSelections().length,r=[],o=-1,l=0;l<n;l++){var c=e.listSelections()[l].head;if(!(c.line<=o)){var u=p(c.line+(t?0:1),0);e.replaceRange(`
`,u,null,"+insertLine"),e.indentLine(u.line,null,!0),r.push({head:u,anchor:u}),o=c.line+1}}e.setSelections(r)}),e.execCommand("indentAuto")}P(D,"insertLine"),g.insertLineAfter=function(e){return D(e,!1)},g.insertLineBefore=function(e){return D(e,!0)};function m(e,t){for(var n=t.ch,r=n,o=e.getLine(t.line);n&&S.isWordChar(o.charAt(n-1));)--n;for(;r<o.length&&S.isWordChar(o.charAt(r));)++r;return{from:p(t.line,n),to:p(t.line,r),word:o.slice(n,r)}}P(m,"wordAt"),g.selectNextOccurrence=function(e){var t=e.getCursor("from"),n=e.getCursor("to"),r=e.state.sublimeFindFullWord==e.doc.sel;if(S.cmpPos(t,n)==0){var o=m(e,t);if(!o.word)return;e.setSelection(o.from,o.to),r=!0}else{var l=e.getRange(t,n),c=r?new RegExp("\\b"+l+"\\b"):l,u=e.getSearchCursor(c,n),C=u.findNext();if(C||(u=e.getSearchCursor(c,p(e.firstLine(),0)),C=u.findNext()),!C||v(e.listSelections(),u.from(),u.to()))return;e.addSelection(u.from(),u.to())}r&&(e.state.sublimeFindFullWord=e.doc.sel)},g.skipAndSelectNextOccurrence=function(e){var t=e.getCursor("anchor"),n=e.getCursor("head");g.selectNextOccurrence(e),S.cmpPos(t,n)!=0&&e.doc.setSelections(e.doc.listSelections().filter(function(r){return r.anchor!=t||r.head!=n}))};function L(e,t){for(var n=e.listSelections(),r=[],o=0;o<n.length;o++){var l=n[o],c=e.findPosV(l.anchor,t,"line",l.anchor.goalColumn),u=e.findPosV(l.head,t,"line",l.head.goalColumn);c.goalColumn=l.anchor.goalColumn!=null?l.anchor.goalColumn:e.cursorCoords(l.anchor,"div").left,u.goalColumn=l.head.goalColumn!=null?l.head.goalColumn:e.cursorCoords(l.head,"div").left;var C={anchor:c,head:u};r.push(l),r.push(C)}e.setSelections(r)}P(L,"addCursorToSelection"),g.addCursorToPrevLine=function(e){L(e,-1)},g.addCursorToNextLine=function(e){L(e,1)};function v(e,t,n){for(var r=0;r<e.length;r++)if(S.cmpPos(e[r].from(),t)==0&&S.cmpPos(e[r].to(),n)==0)return!0;return!1}P(v,"isSelectedRange");var R="(){}[]";function x(e){for(var t=e.listSelections(),n=[],r=0;r<t.length;r++){var o=t[r],l=o.head,c=e.scanForBracket(l,-1);if(!c)return!1;for(;;){var u=e.scanForBracket(l,1);if(!u)return!1;if(u.ch==R.charAt(R.indexOf(c.ch)+1)){var C=p(c.pos.line,c.pos.ch+1);if(S.cmpPos(C,o.from())==0&&S.cmpPos(u.pos,o.to())==0){if(c=e.scanForBracket(c.pos,-1),!c)return!1}else{n.push({anchor:C,head:u.pos});break}}l=p(u.pos.line,u.pos.ch+1)}}return e.setSelections(n),!0}P(x,"selectBetweenBrackets"),g.selectScope=function(e){x(e)||e.execCommand("selectAll")},g.selectBetweenBrackets=function(e){if(!x(e))return S.Pass};function y(e){return e?/\bpunctuation\b/.test(e)?e:void 0:null}P(y,"puncType"),g.goToBracket=function(e){e.extendSelectionsBy(function(t){var n=e.scanForBracket(t.head,1,y(e.getTokenTypeAt(t.head)));if(n&&S.cmpPos(n.pos,t.head)!=0)return n.pos;var r=e.scanForBracket(t.head,-1,y(e.getTokenTypeAt(p(t.head.line,t.head.ch+1))));return r&&p(r.pos.line,r.pos.ch+1)||t.head})},g.swapLineUp=function(e){if(e.isReadOnly())return S.Pass;for(var t=e.listSelections(),n=[],r=e.firstLine()-1,o=[],l=0;l<t.length;l++){var c=t[l],u=c.from().line-1,C=c.to().line;o.push({anchor:p(c.anchor.line-1,c.anchor.ch),head:p(c.head.line-1,c.head.ch)}),c.to().ch==0&&!c.empty()&&--C,u>r?n.push(u,C):n.length&&(n[n.length-1]=C),r=C}e.operation(function(){for(var b=0;b<n.length;b+=2){var M=n[b],w=n[b+1],Y=e.getLine(M);e.replaceRange("",p(M,0),p(M+1,0),"+swapLine"),w>e.lastLine()?e.replaceRange(`
`+Y,p(e.lastLine()),null,"+swapLine"):e.replaceRange(Y+`
`,p(w,0),null,"+swapLine")}e.setSelections(o),e.scrollIntoView()})},g.swapLineDown=function(e){if(e.isReadOnly())return S.Pass;for(var t=e.listSelections(),n=[],r=e.lastLine()+1,o=t.length-1;o>=0;o--){var l=t[o],c=l.to().line+1,u=l.from().line;l.to().ch==0&&!l.empty()&&c--,c<r?n.push(c,u):n.length&&(n[n.length-1]=u),r=u}e.operation(function(){for(var C=n.length-2;C>=0;C-=2){var b=n[C],M=n[C+1],w=e.getLine(b);b==e.lastLine()?e.replaceRange("",p(b-1),p(b),"+swapLine"):e.replaceRange("",p(b,0),p(b+1,0),"+swapLine"),e.replaceRange(w+`
`,p(M,0),null,"+swapLine")}e.scrollIntoView()})},g.toggleCommentIndented=function(e){e.toggleComment({indent:!0})},g.joinLines=function(e){for(var t=e.listSelections(),n=[],r=0;r<t.length;r++){for(var o=t[r],l=o.from(),c=l.line,u=o.to().line;r<t.length-1&&t[r+1].from().line==u;)u=t[++r].to().line;n.push({start:c,end:u,anchor:!o.empty()&&l})}e.operation(function(){for(var C=0,b=[],M=0;M<n.length;M++){for(var w=n[M],Y=w.anchor&&p(w.anchor.line-C,w.anchor.ch),G,N=w.start;N<=w.end;N++){var E=N-C;N==w.end&&(G=p(E,e.getLine(E).length+1)),E<e.lastLine()&&(e.replaceRange(" ",p(E),p(E+1,/^\s*/.exec(e.getLine(E+1))[0].length)),++C)}b.push({anchor:Y||G,head:G})}e.setSelections(b,0)})},g.duplicateLine=function(e){e.operation(function(){for(var t=e.listSelections().length,n=0;n<t;n++){var r=e.listSelections()[n];r.empty()?e.replaceRange(e.getLine(r.head.line)+`
`,p(r.head.line,0)):e.replaceRange(e.getRange(r.from(),r.to()),r.from())}e.scrollIntoView()})};function a(e,t,n){if(e.isReadOnly())return S.Pass;for(var r=e.listSelections(),o=[],l,c=0;c<r.length;c++){var u=r[c];if(!u.empty()){for(var C=u.from().line,b=u.to().line;c<r.length-1&&r[c+1].from().line==b;)b=r[++c].to().line;r[c].to().ch||b--,o.push(C,b)}}o.length?l=!0:o.push(e.firstLine(),e.lastLine()),e.operation(function(){for(var M=[],w=0;w<o.length;w+=2){var Y=o[w],G=o[w+1],N=p(Y,0),E=p(G),X=e.getRange(N,E,!1);t?X.sort(function(H,j){return H<j?-n:H==j?0:n}):X.sort(function(H,j){var q=H.toUpperCase(),Z=j.toUpperCase();return q!=Z&&(H=q,j=Z),H<j?-n:H==j?0:n}),e.replaceRange(X,N,E),l&&M.push({anchor:N,head:p(G+1,0)})}l&&e.setSelections(M,0)})}P(a,"sortLines"),g.sortLines=function(e){a(e,!0,1)},g.reverseSortLines=function(e){a(e,!0,-1)},g.sortLinesInsensitive=function(e){a(e,!1,1)},g.reverseSortLinesInsensitive=function(e){a(e,!1,-1)},g.nextBookmark=function(e){var t=e.state.sublimeBookmarks;if(t)for(;t.length;){var n=t.shift(),r=n.find();if(r)return t.push(n),e.setSelection(r.from,r.to)}},g.prevBookmark=function(e){var t=e.state.sublimeBookmarks;if(t)for(;t.length;){t.unshift(t.pop());var n=t[t.length-1].find();if(!n)t.pop();else return e.setSelection(n.from,n.to)}},g.toggleBookmark=function(e){for(var t=e.listSelections(),n=e.state.sublimeBookmarks||(e.state.sublimeBookmarks=[]),r=0;r<t.length;r++){for(var o=t[r].from(),l=t[r].to(),c=t[r].empty()?e.findMarksAt(o):e.findMarks(o,l),u=0;u<c.length;u++)if(c[u].sublimeBookmark){c[u].clear();for(var C=0;C<n.length;C++)n[C]==c[u]&&n.splice(C--,1);break}u==c.length&&n.push(e.markText(o,l,{sublimeBookmark:!0,clearWhenEmpty:!1}))}},g.clearBookmarks=function(e){var t=e.state.sublimeBookmarks;if(t)for(var n=0;n<t.length;n++)t[n].clear();t.length=0},g.selectBookmarks=function(e){var t=e.state.sublimeBookmarks,n=[];if(t)for(var r=0;r<t.length;r++){var o=t[r].find();o?n.push({anchor:o.from,head:o.to}):t.splice(r--,0)}n.length&&e.setSelections(n,0)};function i(e,t){e.operation(function(){for(var n=e.listSelections(),r=[],o=[],l=0;l<n.length;l++){var c=n[l];c.empty()?(r.push(l),o.push("")):o.push(t(e.getRange(c.from(),c.to())))}e.replaceSelections(o,"around","case");for(var l=r.length-1,u;l>=0;l--){var c=n[r[l]];if(!(u&&S.cmpPos(c.head,u)>0)){var C=m(e,c.head);u=C.from,e.replaceRange(t(C.word),C.from,C.to)}}})}P(i,"modifyWordOrSelection"),g.smartBackspace=function(e){if(e.somethingSelected())return S.Pass;e.operation(function(){for(var t=e.listSelections(),n=e.getOption("indentUnit"),r=t.length-1;r>=0;r--){var o=t[r].head,l=e.getRange({line:o.line,ch:0},o),c=S.countColumn(l,null,e.getOption("tabSize")),u=e.findPosH(o,-1,"char",!1);if(l&&!/\S/.test(l)&&c%n==0){var C=new p(o.line,S.findColumn(l,c-n,n));C.ch!=o.ch&&(u=C)}e.replaceRange("",u,o,"+delete")}})},g.delLineRight=function(e){e.operation(function(){for(var t=e.listSelections(),n=t.length-1;n>=0;n--)e.replaceRange("",t[n].anchor,p(t[n].to().line),"+delete");e.scrollIntoView()})},g.upcaseAtCursor=function(e){i(e,function(t){return t.toUpperCase()})},g.downcaseAtCursor=function(e){i(e,function(t){return t.toLowerCase()})},g.setSublimeMark=function(e){e.state.sublimeMark&&e.state.sublimeMark.clear(),e.state.sublimeMark=e.setBookmark(e.getCursor())},g.selectToSublimeMark=function(e){var t=e.state.sublimeMark&&e.state.sublimeMark.find();t&&e.setSelection(e.getCursor(),t)},g.deleteToSublimeMark=function(e){var t=e.state.sublimeMark&&e.state.sublimeMark.find();if(t){var n=e.getCursor(),r=t;if(S.cmpPos(n,r)>0){var o=r;r=n,n=o}e.state.sublimeKilled=e.getRange(n,r),e.replaceRange("",n,r)}},g.swapWithSublimeMark=function(e){var t=e.state.sublimeMark&&e.state.sublimeMark.find();t&&(e.state.sublimeMark.clear(),e.state.sublimeMark=e.setBookmark(e.getCursor()),e.setCursor(t))},g.sublimeYank=function(e){e.state.sublimeKilled!=null&&e.replaceSelection(e.state.sublimeKilled,null,"paste")},g.showInCenter=function(e){var t=e.cursorCoords(null,"local");e.scrollTo(null,(t.top+t.bottom)/2-e.getScrollInfo().clientHeight/2)};function s(e){var t=e.getCursor("from"),n=e.getCursor("to");if(S.cmpPos(t,n)==0){var r=m(e,t);if(!r.word)return;t=r.from,n=r.to}return{from:t,to:n,query:e.getRange(t,n),word:r}}P(s,"getTarget");function h(e,t){var n=s(e);if(n){var r=n.query,o=e.getSearchCursor(r,t?n.to:n.from);(t?o.findNext():o.findPrevious())?e.setSelection(o.from(),o.to()):(o=e.getSearchCursor(r,t?p(e.firstLine(),0):e.clipPos(p(e.lastLine()))),(t?o.findNext():o.findPrevious())?e.setSelection(o.from(),o.to()):n.word&&e.setSelection(n.from,n.to))}}P(h,"findAndGoTo"),g.findUnder=function(e){h(e,!0)},g.findUnderPrevious=function(e){h(e,!1)},g.findAllUnder=function(e){var t=s(e);if(t){for(var n=e.getSearchCursor(t.query),r=[],o=-1;n.findNext();)r.push({anchor:n.from(),head:n.to()}),n.from().line<=t.from.line&&n.from().ch<=t.from.ch&&o++;e.setSelections(r,o)}};var f=S.keyMap;f.macSublime={"Cmd-Left":"goLineStartSmart","Shift-Tab":"indentLess","Shift-Ctrl-K":"deleteLine","Alt-Q":"wrapLines","Ctrl-Left":"goSubwordLeft","Ctrl-Right":"goSubwordRight","Ctrl-Alt-Up":"scrollLineUp","Ctrl-Alt-Down":"scrollLineDown","Cmd-L":"selectLine","Shift-Cmd-L":"splitSelectionByLine",Esc:"singleSelectionTop","Cmd-Enter":"insertLineAfter","Shift-Cmd-Enter":"insertLineBefore","Cmd-D":"selectNextOccurrence","Shift-Cmd-Space":"selectScope","Shift-Cmd-M":"selectBetweenBrackets","Cmd-M":"goToBracket","Cmd-Ctrl-Up":"swapLineUp","Cmd-Ctrl-Down":"swapLineDown","Cmd-/":"toggleCommentIndented","Cmd-J":"joinLines","Shift-Cmd-D":"duplicateLine",F5:"sortLines","Shift-F5":"reverseSortLines","Cmd-F5":"sortLinesInsensitive","Shift-Cmd-F5":"reverseSortLinesInsensitive",F2:"nextBookmark","Shift-F2":"prevBookmark","Cmd-F2":"toggleBookmark","Shift-Cmd-F2":"clearBookmarks","Alt-F2":"selectBookmarks",Backspace:"smartBackspace","Cmd-K Cmd-D":"skipAndSelectNextOccurrence","Cmd-K Cmd-K":"delLineRight","Cmd-K Cmd-U":"upcaseAtCursor","Cmd-K Cmd-L":"downcaseAtCursor","Cmd-K Cmd-Space":"setSublimeMark","Cmd-K Cmd-A":"selectToSublimeMark","Cmd-K Cmd-W":"deleteToSublimeMark","Cmd-K Cmd-X":"swapWithSublimeMark","Cmd-K Cmd-Y":"sublimeYank","Cmd-K Cmd-C":"showInCenter","Cmd-K Cmd-G":"clearBookmarks","Cmd-K Cmd-Backspace":"delLineLeft","Cmd-K Cmd-1":"foldAll","Cmd-K Cmd-0":"unfoldAll","Cmd-K Cmd-J":"unfoldAll","Ctrl-Shift-Up":"addCursorToPrevLine","Ctrl-Shift-Down":"addCursorToNextLine","Cmd-F3":"findUnder","Shift-Cmd-F3":"findUnderPrevious","Alt-F3":"findAllUnder","Shift-Cmd-[":"fold","Shift-Cmd-]":"unfold","Cmd-I":"findIncremental","Shift-Cmd-I":"findIncrementalReverse","Cmd-H":"replace",F3:"findNext","Shift-F3":"findPrev",fallthrough:"macDefault"},S.normalizeKeyMap(f.macSublime),f.pcSublime={"Shift-Tab":"indentLess","Shift-Ctrl-K":"deleteLine","Alt-Q":"wrapLines","Ctrl-T":"transposeChars","Alt-Left":"goSubwordLeft","Alt-Right":"goSubwordRight","Ctrl-Up":"scrollLineUp","Ctrl-Down":"scrollLineDown","Ctrl-L":"selectLine","Shift-Ctrl-L":"splitSelectionByLine",Esc:"singleSelectionTop","Ctrl-Enter":"insertLineAfter","Shift-Ctrl-Enter":"insertLineBefore","Ctrl-D":"selectNextOccurrence","Shift-Ctrl-Space":"selectScope","Shift-Ctrl-M":"selectBetweenBrackets","Ctrl-M":"goToBracket","Shift-Ctrl-Up":"swapLineUp","Shift-Ctrl-Down":"swapLineDown","Ctrl-/":"toggleCommentIndented","Ctrl-J":"joinLines","Shift-Ctrl-D":"duplicateLine",F9:"sortLines","Shift-F9":"reverseSortLines","Ctrl-F9":"sortLinesInsensitive","Shift-Ctrl-F9":"reverseSortLinesInsensitive",F2:"nextBookmark","Shift-F2":"prevBookmark","Ctrl-F2":"toggleBookmark","Shift-Ctrl-F2":"clearBookmarks","Alt-F2":"selectBookmarks",Backspace:"smartBackspace","Ctrl-K Ctrl-D":"skipAndSelectNextOccurrence","Ctrl-K Ctrl-K":"delLineRight","Ctrl-K Ctrl-U":"upcaseAtCursor","Ctrl-K Ctrl-L":"downcaseAtCursor","Ctrl-K Ctrl-Space":"setSublimeMark","Ctrl-K Ctrl-A":"selectToSublimeMark","Ctrl-K Ctrl-W":"deleteToSublimeMark","Ctrl-K Ctrl-X":"swapWithSublimeMark","Ctrl-K Ctrl-Y":"sublimeYank","Ctrl-K Ctrl-C":"showInCenter","Ctrl-K Ctrl-G":"clearBookmarks","Ctrl-K Ctrl-Backspace":"delLineLeft","Ctrl-K Ctrl-1":"foldAll","Ctrl-K Ctrl-0":"unfoldAll","Ctrl-K Ctrl-J":"unfoldAll","Ctrl-Alt-Up":"addCursorToPrevLine","Ctrl-Alt-Down":"addCursorToNextLine","Ctrl-F3":"findUnder","Shift-Ctrl-F3":"findUnderPrevious","Alt-F3":"findAllUnder","Shift-Ctrl-[":"fold","Shift-Ctrl-]":"unfold","Ctrl-I":"findIncremental","Shift-Ctrl-I":"findIncrementalReverse","Ctrl-H":"replace",F3:"findNext","Shift-F3":"findPrev",fallthrough:"pcDefault"},S.normalizeKeyMap(f.pcSublime);var d=f.default==f.macDefault;f.sublime=d?f.macSublime:f.pcSublime})})();var U=W.exports;const A=(0,V.g)(U),B=_({__proto__:null,default:A},[U])}}]);

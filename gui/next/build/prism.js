/* PrismJS 1.29.0
https://prismjs.com/download.html#themes=prism-tomorrow&languages=markup+liquid+markup-templating&plugins=line-numbers+normalize-whitespace */
var _self='undefined'!=typeof window?window:'undefined'!=typeof WorkerGlobalScope&&self instanceof WorkerGlobalScope?self:{},Prism=function(e){
  var n=/(?:^|\s)lang(?:uage)?-([\w-]+)(?=\s|$)/i,t=0,r={},a={manual:e.Prism&&e.Prism.manual,disableWorkerMessageHandler:e.Prism&&e.Prism.disableWorkerMessageHandler,util:{encode:function e(n){
    return n instanceof i?new i(n.type,e(n.content),n.alias):Array.isArray(n)?n.map(e):n.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\u00a0/g,' ');
  },type:function(e){
    return Object.prototype.toString.call(e).slice(8,-1);
  },objId:function(e){
    return e.__id||Object.defineProperty(e,'__id',{value:++t}),e.__id;
  },clone:function e(n,t){
    var r,i;switch(t=t||{},a.util.type(n)){
      case'Object':if(i=a.util.objId(n),t[i])return t[i];for(var l in r={},t[i]=r,n)n.hasOwnProperty(l)&&(r[l]=e(n[l],t));return r;case'Array':return i=a.util.objId(n),t[i]?t[i]:(r=[],t[i]=r,n.forEach((function(n,a){
        r[a]=e(n,t);
      })),r);default:return n;
    }
  },getLanguage:function(e){
    for(;e;){
      var t=n.exec(e.className);if(t)return t[1].toLowerCase();e=e.parentElement;
    }return'none';
  },setLanguage:function(e,t){
    e.className=e.className.replace(RegExp(n,'gi'),''),e.classList.add('language-'+t);
  },currentScript:function(){
    if('undefined'==typeof document)return null;if('currentScript'in document)return document.currentScript;try{
      throw new Error;
    }catch(r){
      var e=(/at [^(\r\n]*\((.*):[^:]+:[^:]+\)$/i.exec(r.stack)||[])[1];if(e){
        var n=document.getElementsByTagName('script');for(var t in n)if(n[t].src==e)return n[t];
      }return null;
    }
  },isActive:function(e,n,t){
    for(var r='no-'+n;e;){
      var a=e.classList;if(a.contains(n))return!0;if(a.contains(r))return!1;e=e.parentElement;
    }return!!t;
  }},languages:{plain:r,plaintext:r,text:r,txt:r,extend:function(e,n){
    var t=a.util.clone(a.languages[e]);for(var r in n)t[r]=n[r];return t;
  },insertBefore:function(e,n,t,r){
    var i=(r=r||a.languages)[e],l={};for(var o in i)if(i.hasOwnProperty(o)){
      if(o==n)for(var s in t)t.hasOwnProperty(s)&&(l[s]=t[s]);t.hasOwnProperty(o)||(l[o]=i[o]);
    }var u=r[e];return r[e]=l,a.languages.DFS(a.languages,(function(n,t){
      t===u&&n!=e&&(this[n]=l);
    })),l;
  },DFS:function e(n,t,r,i){
    i=i||{};var l=a.util.objId;for(var o in n)if(n.hasOwnProperty(o)){
      t.call(n,o,n[o],r||o);var s=n[o],u=a.util.type(s);'Object'!==u||i[l(s)]?'Array'!==u||i[l(s)]||(i[l(s)]=!0,e(s,t,o,i)):(i[l(s)]=!0,e(s,t,null,i));
    }
  }},plugins:{},highlightAll:function(e,n){
    a.highlightAllUnder(document,e,n);
  },highlightAllUnder:function(e,n,t){
    var r={callback:t,container:e,selector:'code[class*="language-"], [class*="language-"] code, code[class*="lang-"], [class*="lang-"] code'};a.hooks.run('before-highlightall',r),r.elements=Array.prototype.slice.apply(r.container.querySelectorAll(r.selector)),a.hooks.run('before-all-elements-highlight',r);for(var i,l=0;i=r.elements[l++];)a.highlightElement(i,!0===n,r.callback);
  },highlightElement:function(n,t,r){
    var i=a.util.getLanguage(n),l=a.languages[i];a.util.setLanguage(n,i);var o=n.parentElement;o&&'pre'===o.nodeName.toLowerCase()&&a.util.setLanguage(o,i);var s={element:n,language:i,grammar:l,code:n.textContent};function u(e){
      s.highlightedCode=e,a.hooks.run('before-insert',s),s.element.innerHTML=s.highlightedCode,a.hooks.run('after-highlight',s),a.hooks.run('complete',s),r&&r.call(s.element);
    }if(a.hooks.run('before-sanity-check',s),(o=s.element.parentElement)&&'pre'===o.nodeName.toLowerCase()&&!o.hasAttribute('tabindex')&&o.setAttribute('tabindex','0'),!s.code)return a.hooks.run('complete',s),void(r&&r.call(s.element));if(a.hooks.run('before-highlight',s),s.grammar)if(t&&e.Worker){
      var c=new Worker(a.filename);c.onmessage=function(e){
        u(e.data);
      },c.postMessage(JSON.stringify({language:s.language,code:s.code,immediateClose:!0}));
    }else u(a.highlight(s.code,s.grammar,s.language));else u(a.util.encode(s.code));
  },highlight:function(e,n,t){
    var r={code:e,grammar:n,language:t};if(a.hooks.run('before-tokenize',r),!r.grammar)throw new Error('The language "'+r.language+'" has no grammar.');return r.tokens=a.tokenize(r.code,r.grammar),a.hooks.run('after-tokenize',r),i.stringify(a.util.encode(r.tokens),r.language);
  },tokenize:function(e,n){
    var t=n.rest;if(t){
      for(var r in t)n[r]=t[r];delete n.rest;
    }var a=new s;return u(a,a.head,e),o(e,a,n,a.head,0),function(e){
      for(var n=[],t=e.head.next;t!==e.tail;)n.push(t.value),t=t.next;return n;
    }(a);
  },hooks:{all:{},add:function(e,n){
    var t=a.hooks.all;t[e]=t[e]||[],t[e].push(n);
  },run:function(e,n){
    var t=a.hooks.all[e];if(t&&t.length)for(var r,i=0;r=t[i++];)r(n);
  }},Token:i};function i(e,n,t,r){
    this.type=e,this.content=n,this.alias=t,this.length=0|(r||'').length;
  }function l(e,n,t,r){
    e.lastIndex=n;var a=e.exec(t);if(a&&r&&a[1]){
      var i=a[1].length;a.index+=i,a[0]=a[0].slice(i);
    }return a;
  }function o(e,n,t,r,s,g){
    for(var f in t)if(t.hasOwnProperty(f)&&t[f]){
      var h=t[f];h=Array.isArray(h)?h:[h];for(var d=0;d<h.length;++d){
        if(g&&g.cause==f+','+d)return;var v=h[d],p=v.inside,m=!!v.lookbehind,y=!!v.greedy,k=v.alias;if(y&&!v.pattern.global){
          var x=v.pattern.toString().match(/[imsuy]*$/)[0];v.pattern=RegExp(v.pattern.source,x+'g');
        }for(var b=v.pattern||v,w=r.next,A=s;w!==n.tail&&!(g&&A>=g.reach);A+=w.value.length,w=w.next){
          var E=w.value;if(n.length>e.length)return;if(!(E instanceof i)){
            var P,L=1;if(y){
              if(!(P=l(b,A,e,m))||P.index>=e.length)break;var S=P.index,O=P.index+P[0].length,j=A;for(j+=w.value.length;S>=j;)j+=(w=w.next).value.length;if(A=j-=w.value.length,w.value instanceof i)continue;for(var C=w;C!==n.tail&&(j<O||'string'==typeof C.value);C=C.next)L++,j+=C.value.length;L--,E=e.slice(A,j),P.index-=A;
            }else if(!(P=l(b,0,E,m)))continue;S=P.index;var N=P[0],_=E.slice(0,S),M=E.slice(S+N.length),W=A+E.length;g&&W>g.reach&&(g.reach=W);var z=w.prev;if(_&&(z=u(n,z,_),A+=_.length),c(n,z,L),w=u(n,z,new i(f,p?a.tokenize(N,p):N,k,N)),M&&u(n,w,M),L>1){
              var I={cause:f+','+d,reach:W};o(e,n,t,w.prev,A,I),g&&I.reach>g.reach&&(g.reach=I.reach);
            }
          }
        }
      }
    }
  }function s(){
    var e={value:null,prev:null,next:null},n={value:null,prev:e,next:null};e.next=n,this.head=e,this.tail=n,this.length=0;
  }function u(e,n,t){
    var r=n.next,a={value:t,prev:n,next:r};return n.next=a,r.prev=a,e.length++,a;
  }function c(e,n,t){
    for(var r=n.next,a=0;a<t&&r!==e.tail;a++)r=r.next;n.next=r,r.prev=n,e.length-=a;
  }if(e.Prism=a,i.stringify=function e(n,t){
    if('string'==typeof n)return n;if(Array.isArray(n)){
      var r='';return n.forEach((function(n){
        r+=e(n,t);
      })),r;
    }var i={type:n.type,content:e(n.content,t),tag:'span',classes:['token',n.type],attributes:{},language:t},l=n.alias;l&&(Array.isArray(l)?Array.prototype.push.apply(i.classes,l):i.classes.push(l)),a.hooks.run('wrap',i);var o='';for(var s in i.attributes)o+=' '+s+'="'+(i.attributes[s]||'').replace(/"/g,'&quot;')+'"';return'<'+i.tag+' class="'+i.classes.join(' ')+'"'+o+'>'+i.content+'</'+i.tag+'>';
  },!e.document)return e.addEventListener?(a.disableWorkerMessageHandler||e.addEventListener('message',(function(n){
    var t=JSON.parse(n.data),r=t.language,i=t.code,l=t.immediateClose;e.postMessage(a.highlight(i,a.languages[r],r)),l&&e.close();
  }),!1),a):a;var g=a.util.currentScript();function f(){
    a.manual||a.highlightAll();
  }if(g&&(a.filename=g.src,g.hasAttribute('data-manual')&&(a.manual=!0)),!a.manual){
    var h=document.readyState;'loading'===h||'interactive'===h&&g&&g.defer?document.addEventListener('DOMContentLoaded',f):window.requestAnimationFrame?window.requestAnimationFrame(f):window.setTimeout(f,16);
  }return a;
}(_self);'undefined'!=typeof module&&module.exports&&(module.exports=Prism),'undefined'!=typeof global&&(global.Prism=Prism);
Prism.languages.markup={comment:{pattern:/<!--(?:(?!<!--)[\s\S])*?-->/,greedy:!0},prolog:{pattern:/<\?[\s\S]+?\?>/,greedy:!0},doctype:{pattern:/<!DOCTYPE(?:[^>"'[\]]|"[^"]*"|'[^']*')+(?:\[(?:[^<"'\]]|"[^"]*"|'[^']*'|<(?!!--)|<!--(?:[^-]|-(?!->))*-->)*\]\s*)?>/i,greedy:!0,inside:{'internal-subset':{pattern:/(^[^\[]*\[)[\s\S]+(?=\]>$)/,lookbehind:!0,greedy:!0,inside:null},string:{pattern:/"[^"]*"|'[^']*'/,greedy:!0},punctuation:/^<!|>$|[[\]]/,'doctype-tag':/^DOCTYPE/i,name:/[^\s<>'"]+/}},cdata:{pattern:/<!\[CDATA\[[\s\S]*?\]\]>/i,greedy:!0},tag:{pattern:/<\/?(?!\d)[^\s>\/=$<%]+(?:\s(?:\s*[^\s>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))|(?=[\s/>])))+)?\s*\/?>/,greedy:!0,inside:{tag:{pattern:/^<\/?[^\s>\/]+/,inside:{punctuation:/^<\/?/,namespace:/^[^\s>\/:]+:/}},'special-attr':[],'attr-value':{pattern:/=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+)/,inside:{punctuation:[{pattern:/^=/,alias:'attr-equals'},{pattern:/^(\s*)["']|["']$/,lookbehind:!0}]}},punctuation:/\/?>/,'attr-name':{pattern:/[^\s>\/]+/,inside:{namespace:/^[^\s>\/:]+:/}}}},entity:[{pattern:/&[\da-z]{1,8};/i,alias:'named-entity'},/&#x?[\da-f]{1,8};/i]},Prism.languages.markup.tag.inside['attr-value'].inside.entity=Prism.languages.markup.entity,Prism.languages.markup.doctype.inside['internal-subset'].inside=Prism.languages.markup,Prism.hooks.add('wrap',(function(a){
  'entity'===a.type&&(a.attributes.title=a.content.replace(/&amp;/,'&'));
})),Object.defineProperty(Prism.languages.markup.tag,'addInlined',{value:function(a,e){
  var s={};s['language-'+e]={pattern:/(^<!\[CDATA\[)[\s\S]+?(?=\]\]>$)/i,lookbehind:!0,inside:Prism.languages[e]},s.cdata=/^<!\[CDATA\[|\]\]>$/i;var t={'included-cdata':{pattern:/<!\[CDATA\[[\s\S]*?\]\]>/i,inside:s}};t['language-'+e]={pattern:/[\s\S]+/,inside:Prism.languages[e]};var n={};n[a]={pattern:RegExp('(<__[^>]*>)(?:<!\\[CDATA\\[(?:[^\\]]|\\](?!\\]>))*\\]\\]>|(?!<!\\[CDATA\\[)[^])*?(?=</__>)'.replace(/__/g,(function(){
    return a;
  })),'i'),lookbehind:!0,greedy:!0,inside:t},Prism.languages.insertBefore('markup','cdata',n);
}}),Object.defineProperty(Prism.languages.markup.tag,'addAttribute',{value:function(a,e){
  Prism.languages.markup.tag.inside['special-attr'].push({pattern:RegExp("(^|[\"'\\s])(?:"+a+")\\s*=\\s*(?:\"[^\"]*\"|'[^']*'|[^\\s'\">=]+(?=[\\s>]))",'i'),lookbehind:!0,inside:{'attr-name':/^[^\s=]+/,'attr-value':{pattern:/=[\s\S]+/,inside:{value:{pattern:/(^=\s*(["']|(?!["'])))\S[\s\S]*(?=\2$)/,lookbehind:!0,alias:[e,'language-'+e],inside:Prism.languages[e]},punctuation:[{pattern:/^=/,alias:'attr-equals'},/"|'/]}}}});
}}),Prism.languages.html=Prism.languages.markup,Prism.languages.mathml=Prism.languages.markup,Prism.languages.svg=Prism.languages.markup,Prism.languages.xml=Prism.languages.extend('markup',{}),Prism.languages.ssml=Prism.languages.xml,Prism.languages.atom=Prism.languages.xml,Prism.languages.rss=Prism.languages.xml;
!function(e){
  function n(e,n){
    return'___'+e.toUpperCase()+n+'___';
  }Object.defineProperties(e.languages['markup-templating']={},{buildPlaceholders:{value:function(t,a,r,o){
    if(t.language===a){
      var c=t.tokenStack=[];t.code=t.code.replace(r,(function(e){
        if('function'==typeof o&&!o(e))return e;for(var r,i=c.length;-1!==t.code.indexOf(r=n(a,i));)++i;return c[i]=e,r;
      })),t.grammar=e.languages.markup;
    }
  }},tokenizePlaceholders:{value:function(t,a){
    if(t.language===a&&t.tokenStack){
      t.grammar=e.languages[a];var r=0,o=Object.keys(t.tokenStack);!function c(i){
        for(var u=0;u<i.length&&!(r>=o.length);u++){
          var g=i[u];if('string'==typeof g||g.content&&'string'==typeof g.content){
            var l=o[r],s=t.tokenStack[l],f='string'==typeof g?g:g.content,p=n(a,l),k=f.indexOf(p);if(k>-1){
              ++r;var m=f.substring(0,k),d=new e.Token(a,e.tokenize(s,t.grammar),'language-'+a,s),h=f.substring(k+p.length),v=[];m&&v.push.apply(v,c([m])),v.push(d),h&&v.push.apply(v,c([h])),'string'==typeof g?i.splice.apply(i,[u,1].concat(v)):g.content=v;
            }
          }else g.content&&c(g.content);
        }return i;
      }(t.tokens);
    }
  }}});
}(Prism);
Prism.languages.liquid={comment:{pattern:/(^\{%\s*comment\s*%\})[\s\S]+(?=\{%\s*endcomment\s*%\}$)/,lookbehind:!0},delimiter:{pattern:/^\{(?:\{\{|[%\{])-?|-?(?:\}\}|[%\}])\}$/,alias:'punctuation'},string:{pattern:/"[^"]*"|'[^']*'/,greedy:!0},keyword:/\b(?:as|assign|break|(?:end)?(?:capture|case|comment|for|form|if|paginate|raw|style|tablerow|unless)|continue|cycle|decrement|echo|else|elsif|in|include|increment|limit|liquid|offset|range|render|reversed|section|when|with)\b/,object:/\b(?:address|all_country_option_tags|article|block|blog|cart|checkout|collection|color|country|country_option_tags|currency|current_page|current_tags|customer|customer_address|date|discount_allocation|discount_application|external_video|filter|filter_value|font|forloop|fulfillment|generic_file|gift_card|group|handle|image|line_item|link|linklist|localization|location|measurement|media|metafield|model|model_source|order|page|page_description|page_image|page_title|part|policy|product|product_option|recommendations|request|robots|routes|rule|script|search|selling_plan|selling_plan_allocation|selling_plan_group|shipping_method|shop|shop_locale|sitemap|store_availability|tax_line|template|theme|transaction|unit_price_measurement|user_agent|variant|video|video_source)\b/,function:[{pattern:/(\|\s*)\w+/,lookbehind:!0,alias:'filter'},{pattern:/(\.\s*)(?:first|last|size)/,lookbehind:!0}],boolean:/\b(?:false|nil|true)\b/,range:{pattern:/\.\./,alias:'operator'},number:/\b\d+(?:\.\d+)?\b/,operator:/[!=]=|<>|[<>]=?|[|?:=-]|\b(?:and|contains(?=\s)|or)\b/,punctuation:/[.,\[\]()]/,empty:{pattern:/\bempty\b/,alias:'keyword'}},Prism.hooks.add('before-tokenize',(function(e){
  var t=!1;Prism.languages['markup-templating'].buildPlaceholders(e,'liquid',/\{%\s*comment\s*%\}[\s\S]*?\{%\s*endcomment\s*%\}|\{(?:%[\s\S]*?%|\{\{[\s\S]*?\}\}|\{[\s\S]*?\})\}/g,(function(e){
    var n=/^\{%-?\s*(\w+)/.exec(e);if(n){
      var i=n[1];if('raw'===i&&!t)return t=!0,!0;if('endraw'===i)return t=!1,!0;
    }return!t;
  }));
})),Prism.hooks.add('after-tokenize',(function(e){
  Prism.languages['markup-templating'].tokenizePlaceholders(e,'liquid');
}));
!function(){
  if('undefined'!=typeof Prism&&'undefined'!=typeof document){
    var e='line-numbers',n=/\n(?!$)/g,t=Prism.plugins.lineNumbers={getLine:function(n,t){
        if('PRE'===n.tagName&&n.classList.contains(e)){
          var i=n.querySelector('.line-numbers-rows');if(i){
            var r=parseInt(n.getAttribute('data-start'),10)||1,s=r+(i.children.length-1);t<r&&(t=r),t>s&&(t=s);var l=t-r;return i.children[l];
          }
        }
      },resize:function(e){
        r([e]);
      },assumeViewportIndependence:!0},i=void 0;window.addEventListener('resize',(function(){
      t.assumeViewportIndependence&&i===window.innerWidth||(i=window.innerWidth,r(Array.prototype.slice.call(document.querySelectorAll('pre.line-numbers'))));
    })),Prism.hooks.add('complete',(function(t){
      if(t.code){
        var i=t.element,s=i.parentNode;if(s&&/pre/i.test(s.nodeName)&&!i.querySelector('.line-numbers-rows')&&Prism.util.isActive(i,e)){
          i.classList.remove(e),s.classList.add(e);var l,o=t.code.match(n),a=o?o.length+1:1,u=new Array(a+1).join('<span></span>');(l=document.createElement('span')).setAttribute('aria-hidden','true'),l.className='line-numbers-rows',l.innerHTML=u,s.hasAttribute('data-start')&&(s.style.counterReset='linenumber '+(parseInt(s.getAttribute('data-start'),10)-1)),t.element.appendChild(l),r([s]),Prism.hooks.run('line-numbers',t);
        }
      }
    })),Prism.hooks.add('line-numbers',(function(e){
      e.plugins=e.plugins||{},e.plugins.lineNumbers=!0;
    }));
  }function r(e){
    if(0!=(e=e.filter((function(e){
      var n,t=(n=e,n?window.getComputedStyle?getComputedStyle(n):n.currentStyle||null:null)['white-space'];return'pre-wrap'===t||'pre-line'===t;
    }))).length){
      var t=e.map((function(e){
        var t=e.querySelector('code'),i=e.querySelector('.line-numbers-rows');if(t&&i){
          var r=e.querySelector('.line-numbers-sizer'),s=t.textContent.split(n);r||((r=document.createElement('span')).className='line-numbers-sizer',t.appendChild(r)),r.innerHTML='0',r.style.display='block';var l=r.getBoundingClientRect().height;return r.innerHTML='',{element:e,lines:s,lineHeights:[],oneLinerHeight:l,sizer:r};
        }
      })).filter(Boolean);t.forEach((function(e){
        var n=e.sizer,t=e.lines,i=e.lineHeights,r=e.oneLinerHeight;i[t.length-1]=void 0,t.forEach((function(e,t){
          if(e&&e.length>1){
            var s=n.appendChild(document.createElement('span'));s.style.display='block',s.textContent=e;
          }else i[t]=r;
        }));
      })),t.forEach((function(e){
        for(var n=e.sizer,t=e.lineHeights,i=0,r=0;r<t.length;r++)void 0===t[r]&&(t[r]=n.children[i++].getBoundingClientRect().height);
      })),t.forEach((function(e){
        var n=e.sizer,t=e.element.querySelector('.line-numbers-rows');n.style.display='none',n.innerHTML='',e.lineHeights.forEach((function(e,n){
          t.children[n].style.height=e+'px';
        }));
      }));
    }
  }
}();
!function(){
  if('undefined'!=typeof Prism){
    var e=Object.assign||function(e,t){
        for(var n in t)t.hasOwnProperty(n)&&(e[n]=t[n]);return e;
      },t={'remove-trailing':'boolean','remove-indent':'boolean','left-trim':'boolean','right-trim':'boolean','break-lines':'number',indent:'number','remove-initial-line-feed':'boolean','tabs-to-spaces':'number','spaces-to-tabs':'number'};n.prototype={setDefaults:function(t){
      this.defaults=e(this.defaults,t);
    },normalize:function(t,n){
      for(var r in n=e(this.defaults,n)){
        var i=r.replace(/-(\w)/g,(function(e,t){
          return t.toUpperCase();
        }));'normalize'!==r&&'setDefaults'!==i&&n[r]&&this[i]&&(t=this[i].call(this,t,n[r]));
      }return t;
    },leftTrim:function(e){
      return e.replace(/^\s+/,'');
    },rightTrim:function(e){
      return e.replace(/\s+$/,'');
    },tabsToSpaces:function(e,t){
      return t=0|t||4,e.replace(/\t/g,new Array(++t).join(' '));
    },spacesToTabs:function(e,t){
      return t=0|t||4,e.replace(RegExp(' {'+t+'}','g'),'\t');
    },removeTrailing:function(e){
      return e.replace(/\s*?$/gm,'');
    },removeInitialLineFeed:function(e){
      return e.replace(/^(?:\r?\n|\r)/,'');
    },removeIndent:function(e){
      var t=e.match(/^[^\S\n\r]*(?=\S)/gm);return t&&t[0].length?(t.sort((function(e,t){
        return e.length-t.length;
      })),t[0].length?e.replace(RegExp('^'+t[0],'gm'),''):e):e;
    },indent:function(e,t){
      return e.replace(/^[^\S\n\r]*(?=\S)/gm,new Array(++t).join('\t')+'$&');
    },breakLines:function(e,t){
      t=!0===t?80:0|t||80;for(var n=e.split('\n'),i=0;i<n.length;++i)if(!(r(n[i])<=t)){
        for(var o=n[i].split(/(\s+)/g),a=0,l=0;l<o.length;++l){
          var s=r(o[l]);(a+=s)>t&&(o[l]='\n'+o[l],a=s);
        }n[i]=o.join('');
      }return n.join('\n');
    }},'undefined'!=typeof module&&module.exports&&(module.exports=n),Prism.plugins.NormalizeWhitespace=new n({'remove-trailing':!0,'remove-indent':!0,'left-trim':!0,'right-trim':!0}),Prism.hooks.add('before-sanity-check',(function(e){
      var n=Prism.plugins.NormalizeWhitespace;if((!e.settings||!1!==e.settings['whitespace-normalization'])&&Prism.util.isActive(e.element,'whitespace-normalization',!0))if(e.element&&e.element.parentNode||!e.code){
        var r=e.element.parentNode;if(e.code&&r&&'pre'===r.nodeName.toLowerCase()){
          for(var i in null==e.settings&&(e.settings={}),t)if(Object.hasOwnProperty.call(t,i)){
            var o=t[i];if(r.hasAttribute('data-'+i))try{
              var a=JSON.parse(r.getAttribute('data-'+i)||'true');typeof a===o&&(e.settings[i]=a);
            }catch(e){}
          }for(var l=r.childNodes,s='',c='',u=!1,m=0;m<l.length;++m){
            var f=l[m];f==e.element?u=!0:'#text'===f.nodeName&&(u?c+=f.nodeValue:s+=f.nodeValue,r.removeChild(f),--m);
          }if(e.element.children.length&&Prism.plugins.KeepMarkup){
            var d=s+e.element.innerHTML+c;e.element.innerHTML=n.normalize(d,e.settings),e.code=e.element.textContent;
          }else e.code=s+e.code+c,e.code=n.normalize(e.code,e.settings);
        }
      }else e.code=n.normalize(e.code,e.settings);
    }));
  }function n(t){
    this.defaults=e({},t);
  }function r(e){
    for(var t=0,n=0;n<e.length;++n)e.charCodeAt(n)=='\t'.charCodeAt(0)&&(t+=3);return e.length+t;
  }
}();

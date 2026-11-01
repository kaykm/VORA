// Ambiente determinístico para exercitar a lógica real sem navegador ou pacotes.
// Não substitui a validação de layout, shaders WebGL e entrada em um navegador real.
import vm from 'node:vm';
import {performance} from 'node:perf_hooks';
const decode=s=>s.replace(/&(?:amp|lt|gt|quot|apos|#39);/g,m=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&#39;':"'"}[m]));
const voids=new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
class Events{
 constructor(){this.listeners=new Map()}
 addEventListener(type,fn){const list=this.listeners.get(type)||[];list.push(fn);this.listeners.set(type,list)}
 removeEventListener(type,fn){this.listeners.set(type,(this.listeners.get(type)||[]).filter(f=>f!==fn))}
 dispatchEvent(event){event.target??=this;event.currentTarget=this;event.preventDefault??=()=>event.defaultPrevented=true;event.stopPropagation??=()=>{};for(const fn of this.listeners.get(event.type)||[])fn(event);this['on'+event.type]?.(event);return !event.defaultPrevented}
}
function simpleMatch(el,selector){
 if(!el.tagName)return false;
 let negative=[];selector=selector.replace(/:not\(([^)]+)\)/g,(_,s)=>{negative.push(s);return ''});
 if(negative.some(s=>simpleMatch(el,s)))return false;
 if(selector.includes(':disabled')&&!el.disabled)return false;
 if(selector.includes(':enabled')&&el.disabled)return false;
 selector=selector.replace(/:(?:disabled|enabled|scope|first-child)/g,'');
 const tag=selector.match(/^[\w-]+/);if(tag&&el.tagName!==tag[0].toUpperCase())return false;
 for(const m of selector.matchAll(/#([\w-]+)/g))if(el.id!==m[1])return false;
 for(const m of selector.matchAll(/\.([\w-]+)/g))if(!el.classList.contains(m[1]))return false;
 for(const m of selector.matchAll(/\[([^\]=]+)(?:=["']?([^\]"']*)["']?)?\]/g))if(!el.hasAttribute(m[1])||(m[2]!==undefined&&el.getAttribute(m[1])!==m[2]))return false;
 return true;
}
function matches(el,selector){return selector.split(',').some(s=>{const parts=s.trim().split(/\s+(?![^\[]*\])/);if(!simpleMatch(el,parts.pop()))return false;let parent=el.parentElement;while(parts.length){const part=parts.pop();while(parent&&!simpleMatch(parent,part))parent=parent.parentElement;if(!parent)return false;parent=parent.parentElement}return true})}
class Element extends Events{
 constructor(tag,doc){super();this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.attributes=new Map();this.children=[];this.dataset={};this.style={setProperty(name,value){this[name]=value},getPropertyValue(name){return this[name]||''},removeProperty(name){delete this[name]}};this.hidden=false;this.disabled=false;this.inert=false;this.open=false;this.tabIndex=0;this.width=300;this.height=150;this.scrollTop=0;this.clientWidth=300;this.clientHeight=400;this.offsetWidth=300;this.offsetHeight=400;this._text='';this._value='';this.classList={contains:n=>this.className.split(/\s+/).includes(n),add:(...n)=>{this.className=[...new Set([...this.className.split(/\s+/).filter(Boolean),...n])].join(' ')},remove:(...n)=>{this.className=this.className.split(/\s+/).filter(x=>!n.includes(x)).join(' ')},toggle:(n,force)=>{const on=force??!this.classList.contains(n);on?this.classList.add(n):this.classList.remove(n);return on}}}
 setAttribute(k,v){v=String(v);this.attributes.set(k,v);if(k==='id')this.ownerDocument.ids.set(v,this);if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v;if(['hidden','disabled','inert','open'].includes(k))this[k]=true;if(k==='value')this._value=v;if(k==='tabindex')this.tabIndex=Number(v);if(k==='width'||k==='height')this[k]=Number(v)}
 getAttribute(k){return this.attributes.get(k)??null}hasAttribute(k){return this.attributes.has(k)}
 removeAttribute(k){this.attributes.delete(k);if(['hidden','disabled','inert','open'].includes(k))this[k]=false}
 get id(){return this.getAttribute('id')||''}set id(v){this.setAttribute('id',v)}
 get className(){return this.getAttribute('class')||''}set className(v){this.setAttribute('class',v)}
 get value(){return this._value||(this.tagName==='SELECT'?this.options[0]?.value||'':'')}set value(v){this._value=String(v)}
 get options(){return this.querySelectorAll('option')}
 get selectedOptions(){return this.options.filter(o=>o.value===this.value)}
 get textContent(){return this._text+this.children.map(c=>c.textContent).join('')}set textContent(v){this._text=String(v);this.children=[]}
 get innerHTML(){return this._html||''}set innerHTML(v){this._html=String(v);this.children=[];this._text='';parse(this._html,this,this.ownerDocument)}
 append(...children){for(const child of children){if(typeof child==='string'){this._text+=child;continue}child.remove();child.parentElement=this;this.children.push(child)}}
 appendChild(c){this.append(c);return c}replaceChildren(...c){this.children.forEach(n=>n.parentElement=null);this.children=[];this._text='';this.append(...c)}
 remove(){if(this.parentElement){this.parentElement.children=this.parentElement.children.filter(c=>c!==this);this.parentElement=null}}
 after(node){const p=this.parentElement;if(!p)return;node.remove();node.parentElement=p;p.children.splice(p.children.indexOf(this)+1,0,node)}
 querySelectorAll(s){const found=[];const visit=n=>{for(const c of n.children){if(matches(c,s))found.push(c);visit(c)}};visit(this);return found}
 querySelector(s){return this.querySelectorAll(s)[0]||null}closest(s){for(let n=this;n;n=n.parentElement)if(matches(n,s))return n;return null}
 contains(node){for(let n=node;n;n=n.parentElement)if(n===this)return true;return false}
 get isConnected(){return this.ownerDocument.documentElement.contains(this)}
 focus(){this.ownerDocument.activeElement=this}blur(){if(this.ownerDocument.activeElement===this)this.ownerDocument.activeElement=this.ownerDocument.body;this.dispatchEvent({type:'blur'})}
 click(){this.dispatchEvent({type:'click'})}show(){this.open=true;this.setAttribute('open','')}close(){this.open=false;this.removeAttribute('open')}
 getBoundingClientRect(){return {x:0,y:0,left:0,top:0,right:this.offsetWidth,bottom:this.offsetHeight,width:this.offsetWidth,height:this.offsetHeight}}
 scrollIntoView(){}setPointerCapture(){}releasePointerCapture(){}
 getContext(kind){if(kind!=='2d')return null;if(this.context)return this.context;const target={canvas:this,createImageData:(w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)}),putImageData:image=>{this.image=image},measureText:s=>({width:String(s).length*7}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),getImageData:()=>this.image};this.context=new Proxy(target,{get:(t,k)=>k in t?t[k]:()=>{}});return this.context}
}
function parse(html,parent,doc){
 const stack=[parent];
 for(const m of html.matchAll(/<!--[\s\S]*?-->|<![^>]*>|<\/?[^>]+>|[^<]+/g)){
  const token=m[0];if(token.startsWith('<!'))continue;
  if(token.startsWith('</')){const tag=token.slice(2,-1).trim().toUpperCase();for(let i=stack.length-1;i>0;i--)if(stack[i].tagName===tag){stack.length=i;break}continue}
  if(token.startsWith('<')){
   const name=token.match(/^<([\w:-]+)/)?.[1];if(!name)continue;const node=new Element(name,doc);
   for(const a of token.slice(name.length+1).matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))node.setAttribute(a[1],decode(a[2]??a[3]??a[4]??''));
   stack.at(-1).append(node);if(!voids.has(name.toLowerCase())&&!token.endsWith('/>'))stack.push(node);
  }else stack.at(-1)._text+=decode(token);
 }
}
export function createRuntime(html,save=null,{
 storageBlocked=false,width=320,height=240,instrument=[],boot='auto',clockStep=0
}={}){
 const began=performance.now(),doc=new Events();doc.ids=new Map();doc.createElement=name=>new Element(name,doc);doc.createElementNS=(_,name)=>new Element(name,doc);
 const container=doc.createElement('root');parse(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,''),container,doc);
 doc.documentElement=container.querySelector('html');doc.body=container.querySelector('body');doc.activeElement=doc.body;doc.hidden=false;doc.hasFocus=()=>true;
 doc.getElementById=id=>doc.ids.get(id)||null;doc.querySelectorAll=s=>doc.documentElement.querySelectorAll(s);doc.querySelector=s=>doc.querySelectorAll(s)[0]||null;
 const win=new Events(),store=new Map(save?[['vora-v1',JSON.stringify(save)]]:[]),raf=[];
 const timers=new Map(),cancelledFrames=new Set(),storageWrites=[],bootSteps=[];
 let random=12345,clock=1000,nextTask=1;
 const math=Object.create(Math);math.random=()=>{random=Math.imul(random,1664525)+1013904223|0;return (random>>>0)/4294967296};
 const sandbox={document:doc,console,Math:math,innerWidth:width,innerHeight:height,devicePixelRatio:1,
  performance:{now:()=>{const now=clock;clock+=clockStep;return now}},
  requestAnimationFrame:callback=>{const id=nextTask++;raf.push({id,callback});return id},
  cancelAnimationFrame:id=>cancelledFrames.add(id),
  setTimeout:(callback,delay=0,...args)=>{const id=nextTask++;timers.set(id,{callback:()=>callback(...args),at:clock+delay});return id},
  clearTimeout:id=>timers.delete(id),setInterval:()=>nextTask++,clearInterval:()=>{},
  matchMedia:q=>({matches:q.includes('prefers-reduced-motion'),addEventListener(){}}),getComputedStyle:el=>({opacity:'1',transform:'none',clipPath:'none',getPropertyValue:n=>el.style[n]||'0px'}),addEventListener:win.addEventListener.bind(win),removeEventListener:win.removeEventListener.bind(win),dispatchEvent:win.dispatchEvent.bind(win),visualViewport:{width,height,offsetLeft:0,offsetTop:0,scale:1,addEventListener(){}},ResizeObserver:class{observe(){}},MutationObserver:class{observe(){}},Event:class{constructor(type){this.type=type}},
  localStorage:{getItem:k=>{if(storageBlocked)throw Error('Storage bloqueado');return store.get(k)??null},setItem:(k,v)=>{if(storageBlocked)throw Error('Storage bloqueado');storageWrites.push({key:k,value:String(v)});store.set(k,String(v))}},
  atob:s=>Buffer.from(s,'base64').toString('binary'),btoa:s=>Buffer.from(s,'binary').toString('base64')};
 sandbox.window=sandbox;sandbox.self=sandbox;
 sandbox.__profileNow=()=>performance.now();sandbox.__profileRecords={};
 const context=vm.createContext(sandbox);let js=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).join('\n');
 // The real production driver schedules these same steps over animation frames.
 // Tests consume the actual iterator synchronously, without a production fast path.
 const incrementalBoot=/\bstartVora\(\);\s*$/.test(js);
 if(incrementalBoot)js=js.replace(/\bstartVora\(\);\s*$/,'');
 if(instrument.length){
  const hook=instrument.map(name=>{
   if(!/^[a-zA-Z_$][\w$]*$/.test(name))throw Error('Nome inválido para instrumentação');
   return `{const original=${name};${name}=function(...args){const start=__profileNow();try{return original.apply(this,args)}finally{const record=__profileRecords[${JSON.stringify(name)}]??={calls:0,ms:0};record.calls++;record.ms+=__profileNow()-start}}}`;
  }).join('\n');
  if(incrementalBoot)js+='\n'+hook;
  else js=js.replace('migrateWorldScale();warmModelMeshes();',()=>hook+'\nmigrateWorldScale();warmModelMeshes();');
 }
 vm.runInContext(js,context,{timeout:45000,filename:'VORA.js'});
 const run=(code,timeout=45000)=>vm.runInContext(code,context,{timeout});
 let iterator=null;
 const nextBoot=()=>{
  if(!incrementalBoot)throw Error('A referência histórica usa inicialização síncrona.');
  iterator??=run('initializeVoraSteps()');
  const start=performance.now(),result=iterator.next();
  bootSteps.push({done:result.done,value:result.value,ms:performance.now()-start});
  return result;
 };
 const completeBoot=()=>run('completeVoraLoading()');
 const drainBoot=()=>{
  if(!incrementalBoot)return;
  let count=0;
  while(!nextBoot().done)if(++count>1000000)throw Error('Boot não concluiu após 1.000.000 de passos.');
  completeBoot();
 };
 const runAnimationFrame=()=>{
  let item;
  while((item=raf.shift())){
   if(cancelledFrames.delete(item.id))continue;
   clock+=16;
   item.callback(clock);
   return true;
  }
  return false;
 };
 const runTimer=()=>{
  const item=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];
  if(!item)return false;
  timers.delete(item[0]);clock=Math.max(clock,item[1].at);item[1].callback();return true;
 };
 if(incrementalBoot&&boot!=='manual')drainBoot();
 const startupMs=performance.now()-began;
 return {context,doc,store,storageWrites,bootSteps,incrementalBoot,startupMs,run,
  json:code=>JSON.parse(run('JSON.stringify('+code+')')),
  event:(type,props={})=>sandbox.dispatchEvent({type,target:doc.getElementById('world'),...props}),
  advanceClock:ms=>clock+=ms,raf,timers,nextBoot,completeBoot,drainBoot,runAnimationFrame,runTimer};
}

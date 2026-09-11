import { Marked } from 'marked';
import hljs from 'highlight.js';
import fs from 'node:fs';
import path from 'node:path';

export const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function parser(dir) {
  return new Marked({gfm:true, renderer:{
    html: t => esc(t.text),
    code(t) { const lang=(t.lang||'').split(/\s/)[0]; return `<pre><code>${lang && hljs.getLanguage(lang) ? hljs.highlight(t.text,{language:lang}).value : esc(t.text)}</code></pre>`; },
    image(t) {
      let url=t.href;
      if (!/^(https?:|data:)/i.test(url)) {
        const file=path.resolve(dir,decodeURIComponent(url));
        const mime={'.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp'}[path.extname(file).toLowerCase()];
        if(!mime) throw new Error(`不支持的图片类型：${file}`);
        url=`data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
      }
      return `<img src="${esc(url)}" alt="${esc(t.text)}">`;
    },
    link(t) { return /^(javascript|vbscript|data):/i.test(t.href.trim()) ? this.parser.parseInline(t.tokens) : `<a href="${esc(t.href)}">${this.parser.parseInline(t.tokens)}</a>`; }
  }});
}
export function sections(tokens) {
  const root={id:0,depth:0,title:'文档',body:[],children:[]}; const stack=[root]; let current=root; let id=0;
  for(const t of tokens) {
    if(t.type==='heading') {
      while(stack.length>1 && stack.at(-1).depth>=t.depth) stack.pop();
      current={id:++id,depth:t.depth,title:t.text,body:[],children:[]}; stack.at(-1).children.push(current); stack.push(current);
    } else current.body.push(t);
  }
  return root;
}
const css=`*{box-sizing:border-box}body{margin:0;background:#eef2f6;color:#192b3c;font:16px/1.7 "Segoe UI","Microsoft YaHei",sans-serif}main{background:white;max-width:900px;margin:40px auto;padding:48px 64px;border-radius:12px}h1,h2,h3,h4{line-height:1.25;color:#123a50}h1{font-size:36px}h2{font-size:28px;border-bottom:1px solid #dce6ed;padding-bottom:12px}h3{font-size:22px}a{color:#087f8c}img{max-width:100%;max-height:380px;object-fit:contain}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#edf3f6;padding:18px;border-radius:8px;font-size:.85em}code{font-family:Consolas,monospace}blockquote{border-left:4px solid #12a395;margin:20px 0;padding:8px 20px;background:#effaf7}table{border-collapse:collapse;width:100%}td,th{border:1px solid #d6e1e8;padding:8px 12px;text-align:left}th{background:#edf5f7}p,li{overflow-wrap:anywhere}.hljs-keyword,.hljs-selector-tag{color:#a626a4}.hljs-string{color:#287b45}.hljs-number,.hljs-literal{color:#b45b15}.hljs-comment{color:#718096}nav{position:fixed;bottom:12px;left:50%;transform:translateX(-50%);z-index:10;background:#18394d;color:white;padding:8px 16px;border-radius:24px;display:flex;align-items:center;gap:12px}button{border:0;border-radius:16px;padding:7px 12px;cursor:pointer}body.slides main{max-width:none;padding:0;background:none;margin:0}.slide{width:1280px;height:720px;padding:48px 64px;background:white;position:relative;margin:24px auto;overflow:hidden}.slide .content{height:558px;overflow:hidden;font-size:24px;line-height:1.5}.slide h1{font-size:42px;margin:0 0 24px}.slide h2{font-size:32px}.slide footer{position:absolute;bottom:22px;left:64px;color:#6c8496;font-size:14px}.slide.cover{border-top:12px solid #0b968a}.slide.cover h1{font-size:56px}.slide img{max-height:380px}.slide p{margin:12px 0}.slide pre{font-size:18px}.slide table{font-size:20px}body.present{overflow:hidden;background:#142c3d}body.present .slide{display:none;margin:0;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(var(--scale,1))}body.present .slide.active{display:block}body.flow main{max-width:none;margin:0;padding:0;background:#f4f7fb;border-radius:0}#viewport{height:100vh;overflow:hidden;touch-action:none;cursor:grab}#graph{transform-origin:0 0}svg text{font-family:"Microsoft YaHei","Segoe UI",sans-serif}@media print{body{background:white}nav{display:none}main{margin:0;padding:0;max-width:none}.slide{margin:0!important;break-after:page;display:block!important;position:relative!important;transform:none!important;left:auto!important;top:auto!important}body.present{overflow:visible}pre,blockquote,tr,img{break-inside:avoid}h1,h2,h3{break-after:avoid}}`;
export function wrap(title,mode,body,script='') { return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${css}</style></head><body class="${mode}">${body}<script>${script}</script></body></html>`; }
export function slides(tokens,md,level=2) {
  const pages=[]; let page;
  for(const t of tokens) {
    if(t.type==='heading' && t.depth<=level) {page={title:t.text,cover:t.depth<level,body:[]};pages.push(page);}
    else {if(!page){page={title:'导读',body:[]};pages.push(page);}page.body.push(t);}
  }
  if(!pages.length) pages.push({title:'空文档',body:[]});
  return pages.map(p=>`<section class="slide ${p.cover?'cover':''}"><h1>${md.parseInline(p.title)}</h1><div class="content">${md.parser(Object.assign(p.body,{links:tokens.links}))}</div><footer></footer></section>`).join('');
}
export const slideScript=`
function split(el){
 if(el.nodeType===3){if(el.textContent.length<2)return null;const n=Math.ceil(el.textContent.length/2);const tail=el.splitText(n);tail.remove();return tail;}
 if(el.tagName==='IMG')return null;
 const tail=el.cloneNode(false);
 if(el.childNodes.length>1){const n=Math.ceil(el.childNodes.length/2);while(el.childNodes.length>n)tail.prepend(el.lastChild);return tail;}
 if(el.firstChild){const part=split(el.firstChild);if(part){tail.append(part);return tail;}}return null;
}
window.ready=(async()=>{
 await document.fonts.ready;await Promise.all([...document.images].map(i=>i.complete?Promise.resolve():new Promise(r=>{i.onload=r;i.onerror=r})));
 for(const original of [...document.querySelectorAll('.slide')]){
 let page=original,box=page.querySelector('.content');const queue=[...box.children];box.replaceChildren();let continued=0;
 const next=()=>{const n=original.cloneNode(true);n.classList.remove('cover');n.querySelector('h1').textContent=original.querySelector('h1').textContent+' · 续 '+(++continued);n.querySelector('.content').replaceChildren();page.after(n);page=n;box=n.querySelector('.content');};
 box.style.height=Math.max(80,640-box.offsetTop)+'px';
 while(queue.length){const el=queue.shift();box.append(el);if(box.scrollHeight>box.clientHeight+1){el.remove();if(box.children.length){const carry=[];while(box.lastElementChild && /^H[1-6]$/.test(box.lastElementChild.tagName)){carry.unshift(box.lastElementChild);box.lastElementChild.remove();}if(!box.children.length && carry.length){box.append(...carry);const tail=split(el);if(tail){queue.unshift(el,tail);continue;}}next();box.style.height=Math.max(80,640-box.offsetTop)+'px';queue.unshift(...carry,el);}else{const tail=split(el);if(tail){queue.unshift(el,tail);}else{box.append(el);el.style.maxHeight=box.clientHeight+'px';el.style.maxWidth='100%';if(box.scrollHeight>box.clientHeight+1)throw Error('不可拆分内容超出页面');}}}}
 }
 const pages=[...document.querySelectorAll('.slide')];pages.forEach((p,i)=>p.querySelector('footer').textContent='MYMD / '+(i+1)+' / '+pages.length);
 let index=0;function show(d=0){index=Math.max(0,Math.min(pages.length-1,index+d));pages.forEach((p,i)=>p.classList.toggle('active',i===index));document.documentElement.style.setProperty('--scale',Math.min(innerWidth/1280,innerHeight/720));document.getElementById('count').textContent=(index+1)+' / '+pages.length;}
 document.getElementById('prev').onclick=()=>show(-1);document.getElementById('next').onclick=()=>show(1);document.getElementById('present').onclick=()=>{document.body.classList.toggle('present');show();};document.getElementById('full').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();addEventListener('resize',()=>show());addEventListener('keydown',e=>{if(['ArrowRight','PageDown',' '].includes(e.key)){e.preventDefault();show(1);}if(['ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();show(-1);}if(e.key==='Escape')document.body.classList.remove('present');});show();
})();`;
export const slideNav='<nav><button id="prev">←</button><span id="count"></span><button id="next">→</button><button id="present">演示 / 总览</button><button id="full">全屏</button></nav>';
function lines(text,max) {const result=[];for(const line of text.split('\n')){let s='',w=0;for(const c of line){const n=c.charCodeAt(0)>255?2:1;if(w+n>max){result.push(s);s='';w=0;}s+=c;w+=n;}result.push(s);}return result;}
export function flow(root) {
 const nodes=[],edges=[];let y=90;let maxDepth=0;
 function visit(n,depth,parent){const title=lines(n.title,32);const body=lines(n.body.map(t=>t.raw).join('').trim(),48);const height=40+title.length*26+(body[0]||body.length>1?body.length*21+14:0);const node={...n,x:40+depth*480,y,height,title,body};nodes.push(node);maxDepth=Math.max(maxDepth,depth);if(parent)edges.push({a:parent,b:node,type:'parent'});y+=height+56;let prev;for(const child of n.children){const childNode=visit(child,depth+1,node);if(prev)edges.push({a:prev,b:childNode,type:'sequence'});prev=childNode;}return node;}
 if(root.body.some(t=>t.type!=='space')||!root.children.length)visit(root,0);else{let prev;for(const n of root.children){const node=visit(n,0);if(prev)edges.push({a:prev,b:node,type:'sequence'});prev=node;}}
 const width=(maxDepth+1)*480+60,height=y+20;
 const paths=edges.map(({a,b,type})=>type==='parent'?`<path d="M${a.x+420},${a.y+22} H${b.x-24} V${b.y+22} H${b.x}" fill="none" stroke="#a0b3c1" stroke-width="1.5"/>`:`<path d="M${a.x+420},${a.y+a.height-18} H${a.x+446} V${b.y+12} H${b.x+420}" fill="none" stroke="#079b8b" stroke-width="2" stroke-dasharray="6 4" marker-end="url(#arrow)"/>`).join('');
 const cards=nodes.map(n=>`<g><rect x="${n.x}" y="${n.y}" width="420" height="${n.height}" rx="12" fill="white" stroke="#cbd9e3"/><rect x="${n.x}" y="${n.y+12}" width="4" height="${n.height-24}" rx="2" fill="#079b8b"/>${n.title.map((l,i)=>`<text x="${n.x+18}" y="${n.y+30+i*26}" font-size="20" font-weight="700" fill="#173c51">${esc(l)}</text>`).join('')}${n.body.map((l,i)=>`<text x="${n.x+18}" y="${n.y+46+n.title.length*26+i*21}" font-size="15" fill="#526a7c">${esc(l)}</text>`).join('')}</g>`).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0 0 L0 6 L8 3z" fill="#079b8b"/></marker></defs><rect width="100%" height="100%" fill="#f4f7fb"/><text x="40" y="38" font-size="18" fill="#173c51">标题结构图</text><text x="40" y="65" font-size="13" fill="#526a7c">灰色实线：包含关系　绿色虚线箭头：同级文档顺序</text>${paths}${cards}</svg>`;
}
export const flowScript=`const v=document.getElementById('viewport'),g=document.getElementById('graph');let x=0,y=0,s=1;const draw=()=>g.style.transform='translate('+x+'px,'+y+'px) scale('+s+')';function fit(){const svg=g.querySelector('svg');s=Math.min(1,innerWidth/svg.width.baseVal.value,innerHeight/svg.height.baseVal.value);x=0;y=0;draw();}document.getElementById('fit').onclick=fit;v.onwheel=e=>{e.preventDefault();const next=Math.min(4,Math.max(.05,s*Math.exp(-e.deltaY*.001)));x=e.clientX-(e.clientX-x)*next/s;y=e.clientY-(e.clientY-y)*next/s;s=next;draw();};let drag;v.onpointerdown=e=>{drag=[e.clientX,e.clientY,x,y];v.setPointerCapture(e.pointerId);};v.onpointermove=e=>{if(drag){x=drag[2]+e.clientX-drag[0];y=drag[3]+e.clientY-drag[1];draw();}};v.onpointerup=()=>drag=null;v.onpointercancel=()=>drag=null;fit();window.ready=Promise.resolve();`;

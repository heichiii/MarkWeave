import {slideLogo} from './logo.js';

const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function length(value,negative=true) {
 const match=/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))(px|%)?$/.exec(value);
 if(!match || !Number.isFinite(Number(match[1])) || (!negative && Number(match[1])<0))throw Error(`无效布局长度：${value}（使用 ${negative?'可带正负号的 ':''}px 或 %）`);
 return `${Number(match[1])}${match[2]||'px'}`;
}

export function slidePages(tokens) {
 const groups=[[]];
 for(const token of tokens) {
  if(token.type==='hr')groups.push([]);
  else if(!['space','def'].includes(token.type))groups.at(-1).push(token);
 }
 let hasCover=false,chapter=0,section=0,chapterTitle='',sectionTitle='';
 return groups.filter(g=>g.length).map((group,index)=>{
  const layout={x:'0px',y:'0px',manual:false};let opened=false,closed=false;
  const body=[];
  for(const [i,token] of group.entries()) {
   if(token.type!=='slideDirective'){body.push(token);continue;}
   const directive=token.directive.trim();
   const fail=message=>{throw Error(`第 ${index+1} 个 Markdown 页面：${message}`);};
   if(directive.startsWith('slide:')) {
    if(i!==0 || opened)fail('<!-- slide: ... --> 必须位于页面开头，且每页只能出现一次');
    const args=directive.slice(6).trim().split(/\s+/).filter(Boolean),seen=new Set();
    for(const arg of args) {
     const match=/^(x|y)=(.+)$/.exec(arg);
     if(!match || seen.has(match[1]))fail(`未知或重复的布局选项：${arg}`);
     seen.add(match[1]);layout[match[1]]=length(match[2]);
    }
    opened=true;layout.manual=true;
   } else if(directive==='/slide') {
    if(!opened || closed || i!==group.length-1)fail('<!-- /slide --> 必须与开头标记配对，并位于页面结尾');
    closed=true;
   } else if(directive.startsWith('gap:')) {
    body.push({type:'slideGap',height:length(directive.slice(4).trim(),false)});layout.manual=true;
   } else fail(`无效布局标记：${directive}`);
  }
  if(opened && !closed)throw Error(`第 ${index+1} 个 Markdown 页面缺少 <!-- /slide -->`);
  const first=body.find(t=>t.type!=='slideGap');
  // Only an ATX heading on the first content line changes the page state.
  const depth=first?.type==='heading' && /^ {0,3}#{1,2}(?:\s|$)/.test(first.raw)?first.depth:0;
  let type='normal';
  if(depth===1) {
   if(!hasCover){type='cover';hasCover=true;section=0;sectionTitle='';}
   else {type='chapter';chapter++;section=0;chapterTitle=first.text;sectionTitle='';}
  } else if(depth===2){type='section';section++;sectionTitle=first.text;}
  return {type,body,layout,chapter,section,chapterTitle,sectionTitle,title:first?.type==='heading'?first.text:'',sourcePage:index+1};
 });
}

export function slides(tokens,md,language='zh-CN',logo) {
 const en=language==='en',branding=slideLogo(logo),pages=slidePages(tokens);
 const tocTitle=en?'Contents':'目录';
 const chapters=pages.filter(p=>p.type==='chapter');
 const renderBody=p=>p.body.map((token,i)=>{
  if(token.type==='slideGap')return `<div class="slide-gap" data-height="${token.height}" aria-hidden="true"></div>`;
  const html=md.parser(Object.assign([token],{links:tokens.links}));
  return token===p.body.find(t=>t.type!=='slideGap') && token.type==='heading'?html.replace(/^<h([1-6])>/,(_,n)=>`<h${n} class="page-title">`):html;
 }).join('');
 const frame=(p,body)=>{
  const labels=[];
  if(p.chapter)labels.push(`${en?'Chapter '+p.chapter:'第 '+p.chapter+' 章'} · ${p.chapterTitle}`);
  if(p.section)labels.push(`${en?'Section ':'第 '}${p.chapter?p.chapter+'.':''}${p.section}${en?'':' 节'} · ${p.sectionTitle}`);
  const label=['section','normal'].includes(p.type)?labels.join(' / '):'';
  return `<section class="slide" data-type="${p.type}" data-source-page="${p.sourcePage||0}" data-chapter="${p.chapter||0}" data-section="${p.section||0}"${p.type==='toc'?' data-toc="true"':''}${p.type==='cover'?' data-cover="true"':''} data-manual="${p.layout.manual}" data-x="${p.layout.x}" data-y="${p.layout.y}"${branding.style?` style="${branding.style}"`:''}>${branding.html}<header class="chapter-label"${label?'':' hidden'}>${escape(label)}</header><div class="body-region"><div class="content">${body}</div></div><footer></footer><aside class="layout-warning" hidden role="alert"></aside></section>`;
 };
 const result=[];
 for(const p of pages) {
  result.push(frame(p,renderBody(p)));
  if(p.type==='cover') {
   const body=`<h1 class="page-title">${tocTitle}</h1>`+(chapters.length?chapters.map(c=>`<div class="toc-entry toc-depth-1"><span>${c.chapter}</span> <div>${md.parseInline(c.title)}</div></div>`).join(''):`<p>${en?'No chapters':'暂无章节'}</p>`);
   result.push(frame({type:'toc',layout:{manual:false,x:'0px',y:'0px'}},body));
  }
 }
 if(!result.length)result.push(frame({type:'normal',layout:{manual:false,x:'0px',y:'0px'}},`<p>${en?'Empty document':'空文档'}</p>`));
 return result.join('');
}

export const slideCss=`
.slide{padding:0}
.slide .body-region{position:absolute;top:76px;left:64px;right:64px;bottom:80px}
.slide .content{position:relative;display:flow-root;height:auto;overflow:visible;font-size:24px;line-height:1.5}
.slide .content > :first-child{margin-top:0}
.slide .content > :last-child{margin-bottom:0}
.slide .page-title{font-size:42px;line-height:1.25;color:#123a50;margin:0 0 16px;padding:0;border:0}
.slide[data-type="cover"] .page-title{font-size:56px}
.slide[data-type="chapter"] .page-title{font-size:52px}
.slide[data-type="toc"] .page-title{font-size:46px;margin-bottom:24px}
.slide .chapter-label{position:absolute;top:32px;left:64px;right:208px;font-size:22px;line-height:32px;font-weight:600;color:#367585;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.slide footer{left:var(--footer-left,64px)}
.slide .slide-gap{display:block;margin:0;padding:0;flex:none}
.toc-entry{display:flex;align-items:baseline;gap:24px;font-size:28px;line-height:1.3;padding:10px 0;border-bottom:1px solid #e4edf1}
.toc-entry > span{flex:0 0 48px;color:#087f8c;font-size:24px;font-weight:600;font-variant-numeric:tabular-nums}
.toc-entry > div{min-width:0;overflow-wrap:anywhere;font-weight:500}
.layout-warning{position:absolute;left:64px;right:64px;bottom:48px;background:#fff0d5;border:1px solid #cc8c24;color:#7a4200;padding:5px 12px;font-size:15px;line-height:1.4;z-index:2}
`;

function initializeSlides() {
 function split(el) {
  if(el.nodeType===3){if(el.textContent.length<2)return null;const tail=el.splitText(Math.ceil(el.textContent.length/2));tail.remove();return tail;}
  if(el.nodeType!==1 || ['IMG','SVG'].includes(el.tagName) || el.classList.contains('katex') || el.classList.contains('katex-display') || el.classList.contains('mermaid'))return null;
  const tail=el.cloneNode(false);
  if(el.childNodes.length>1){const n=Math.ceil(el.childNodes.length/2);while(el.childNodes.length>n)tail.prepend(el.lastChild);return tail;}
  if(el.firstChild){const part=split(el.firstChild);if(part){tail.append(part);return tail;}}
  return null;
 }
 const pixels=(value,size)=>parseFloat(value)*(value.endsWith('%')?size/100:1);
  window.ready=(async()=>{
   await window.mermaidReady;
   await document.fonts.ready;
  await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));
  const en=document.documentElement.lang==='en';
  const continued=en?'Continued':'续页';
  window.slideWarnings=[];
  for(const original of [...document.querySelectorAll('.slide')]) {
   let page=original,region=page.querySelector('.body-region'),box=page.querySelector('.content');
   for(const gap of box.querySelectorAll('.slide-gap'))gap.style.height=pixels(gap.dataset.height,region.clientHeight)+'px';
   if(page.dataset.manual==='true')continue;
   const queue=[...box.childNodes];box.replaceChildren();let count=0;
   const template=original.cloneNode(true);
   const next=()=>{
    const n=template.cloneNode(true);n.dataset.continuation=String(++count);
    page.after(n);page=n;region=n.querySelector('.body-region');box=n.querySelector('.content');
   };
   while(queue.length) {
    const el=queue.shift();box.append(el);
    if(box.scrollHeight<=region.clientHeight+1)continue;
    el.remove();
    if(box.children.length) {
     // Keep a trailing heading with its following block when there is room.
     const carry=[];
     while(box.lastChild && (box.lastChild.nodeType===3 && !box.lastChild.textContent.trim() || /^H[1-6]$/.test(box.lastChild.nodeName))) {carry.unshift(box.lastChild);box.lastChild.remove();}
     if(!box.children.length && carry.length) {
      box.append(...carry);const tail=split(el);
      if(tail){queue.unshift(el,tail);continue;}
      next();queue.unshift(el);continue;
     }
     next();queue.unshift(...carry,el);
    } else {
     const tail=split(el);
     if(tail)queue.unshift(el,tail);
     else {
      box.append(el);
      if(el.nodeType===1 && el.tagName==='IMG'){el.style.maxHeight=region.clientHeight/(parseFloat(getComputedStyle(el).zoom)||1)+'px';el.style.maxWidth='100%';}
      if(box.scrollHeight>region.clientHeight+1)throw Error(en?'Unsplittable content exceeds the slide':'不可拆分内容超出页面');
     }
    }
   }
  }
  const pages=[...document.querySelectorAll('.slide')];
  for(const [i,p] of pages.entries()) {
   const region=p.querySelector('.body-region'),box=p.querySelector('.content');
   const centered=['cover','chapter'].includes(p.dataset.type);
   const x=pixels(p.dataset.x,region.clientWidth),y=pixels(p.dataset.y,region.clientHeight);
   const top=(centered?Math.max(0,(region.clientHeight-box.offsetHeight)/2):0)+y;
   box.style.left=x+'px';box.style.top=top+'px';
   p.querySelector('footer').textContent=document.body.dataset.filename+' / '+(i+1)+' / '+pages.length+(p.dataset.continuation?' · '+continued+' '+p.dataset.continuation:'');
   if(p.dataset.manual==='true') {
    // Check actual occupied content, not the unused width of the body wrapper.
    const rects=[];
    const walker=document.createTreeWalker(box,NodeFilter.SHOW_TEXT);
    while(walker.nextNode())if(walker.currentNode.textContent.trim()) {
     const range=document.createRange();range.selectNodeContents(walker.currentNode);rects.push(...range.getClientRects());
    }
    for(const el of box.querySelectorAll('img,svg,table,pre,.katex-display'))rects.push(el.getBoundingClientRect());
    const r=region.getBoundingClientRect();
    const gapOutside=[...box.querySelectorAll('.slide-gap')].some(el=>{const b=el.getBoundingClientRect();return b.top<r.top-1 || b.bottom>r.bottom+1;});
    const outside=gapOutside || rects.some(b=>b.left<r.left-1 || b.right>r.right+1 || b.top<r.top-1 || b.bottom>r.bottom+1);
    const obstacles=[...p.querySelectorAll('.slide-logo,.chapter-label:not([hidden]),footer')].map(el=>el.getBoundingClientRect());
    const overlap=rects.some(b=>obstacles.some(o=>b.left<o.right && b.right>o.left && b.top<o.bottom && b.bottom>o.top));
    if(outside || overlap) {
     const message=en?'Manual layout exceeds the body area or overlaps the frame. Adjust x/y, gaps, or split with ***.':'手动布局超出正文区域或遮挡框架，请调整 x/y、空白或使用 *** 拆页。';
     const warning=p.querySelector('.layout-warning');warning.textContent=message;warning.hidden=false;
     window.slideWarnings.push({page:i+1,sourcePage:Number(p.dataset.sourcePage),message});
    }
   }
  }
  let index=0;
  function show(d=0){index=Math.max(0,Math.min(pages.length-1,index+d));pages.forEach((p,i)=>p.classList.toggle('active',i===index));document.documentElement.style.setProperty('--scale',Math.min(innerWidth/1280,innerHeight/720));document.getElementById('count').textContent=(index+1)+' / '+pages.length;}
  document.getElementById('prev').onclick=()=>show(-1);document.getElementById('next').onclick=()=>show(1);
  document.getElementById('present').onclick=()=>{document.body.classList.toggle('present');show();};
  document.getElementById('full').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();
  addEventListener('resize',()=>show());
  addEventListener('keydown',e=>{if(['ArrowRight','PageDown',' '].includes(e.key)){e.preventDefault();show(1);}if(['ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();show(-1);}if(e.key==='Escape')document.body.classList.remove('present');});show();
 })();
}

export const slideScript=`(${initializeSlides.toString()})();`;

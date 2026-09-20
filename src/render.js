import { Marked } from 'marked';
import hljs from 'highlight.js';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import markedKatex from 'marked-katex-extension';
import {slideCss} from './slides.js';
export {slides,slideScript} from './slides.js';

const require=createRequire(import.meta.url);
let mathStyles;
function mathCss() {
  if(!mathStyles) {
    const file=require.resolve('katex/dist/katex.min.css');
    mathStyles=fs.readFileSync(file,'utf8').replace(/url\(([^)]+)\)/g,(_,url)=>{
      const font=url.replace(/["']/g,'');
      const ext=path.extname(font).slice(1);
      return `url(data:font/${ext};base64,${fs.readFileSync(path.resolve(path.dirname(file),font)).toString('base64')})`;
    });
  }
  return mathStyles;
}
export function messages(language='zh-CN') {
  const locales={
    'zh-CN':{intro:'导读',empty:'空文档',present:'演示 / 总览',full:'全屏',prev:'上一页',next:'下一页',continued:'续页',overflow:'不可拆分内容超出页面',pan:'滚轮缩放 · 拖动平移',fit:'适应窗口'},
    en:{intro:'Introduction',empty:'Empty document',present:'Present / Overview',full:'Fullscreen',prev:'Previous slide',next:'Next slide',continued:'Continued',overflow:'Unsplittable content exceeds the slide',pan:'Scroll to zoom · Drag to pan',fit:'Fit to window'}
  };
  if(!locales[language])throw Error('language 必须是 zh-CN 或 en');
  return locales[language];
}

export const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function parser(dir,{math=false}={}) {
  const imageTag=(href,alt='',style='')=>{
    let url=href;
    if (!/^(https?:|data:image\/)/i.test(url)) {
      const file=path.resolve(dir,decodeURIComponent(url));
      const mime={'.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp'}[path.extname(file).toLowerCase()];
      if(!mime)throw new Error(`不支持的图片类型：${file}`);
      url=`data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
    }
    return `<img src="${esc(url)}" alt="${esc(alt)}"${style?` style="${esc(style)}"`:''}>`;
  };
  const decode=s=>s.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi,e=>{
    const named={'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>'};
    if(named[e.toLowerCase()])return named[e.toLowerCase()];
    const n=e.toLowerCase().startsWith('&#x')?parseInt(e.slice(3),16):parseInt(e.slice(2),10);
    return n>0&&n<=0x10ffff?String.fromCodePoint(n):e;
  });
  const htmlImages=raw=>raw.split(/(<img\b(?:[^>"']|"[^"]*"|'[^']*')*>)/gi).map(part=>{
    if(!/^<img\b/i.test(part))return esc(part);
    const attrs={};
    for(const m of part.slice(4,-1).matchAll(/([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))attrs[m[1].toLowerCase()]=decode(m[2]??m[3]??m[4]);
    if(!attrs.src)return esc(part);
    const styles=[];
    for(const key of ['width','height'])if(/^\d+(?:\.\d+)?(?:px|%)?$/.test(attrs[key]||''))styles.push(`${key}:${/^\d+(?:\.\d+)?$/.test(attrs[key])?attrs[key]+'px':attrs[key]}`);
    for(const declaration of (attrs.style||'').split(';')) {
      const [key,value]=declaration.split(':').map(s=>s.trim().toLowerCase());
      if(['width','height'].includes(key) && /^(?:\d+(?:\.\d+)?(?:px|%)|auto)$/.test(value||''))styles.push(`${key}:${value}`);
      if(key==='zoom' && /^\d+(?:\.\d+)?%?$/.test(value||'')) {
        const scale=parseFloat(value)/(value.endsWith('%')?100:1);
        if(scale>0 && Number.isFinite(scale))styles.push(`zoom:${scale}`,`max-height:${380/scale}px`,`max-width:${100/scale}%`);
      }
    }
    return imageTag(attrs.src,attrs.alt,styles.join(';'));
  }).join('');
  const md=new Marked({gfm:true, renderer:{
    html: t => htmlImages(t.text),
    code(t) { const lang=(t.lang||'').split(/\s/)[0]; return `<pre><code>${lang && hljs.getLanguage(lang) ? hljs.highlight(t.text,{language:lang}).value : esc(t.text)}</code></pre>`; },
    image(t) {
      return imageTag(t.href,t.text);
    },
    link(t) { return /^(javascript|vbscript|data):/i.test(t.href.trim()) ? this.parser.parseInline(t.tokens) : `<a href="${esc(t.href)}">${this.parser.parseInline(t.tokens)}</a>`; }
  }});
  md.use({extensions:[{
    name:'slideDirective',level:'block',
    start:source=>source.indexOf('<!--'),
    tokenizer(source) {
      const match=/^ {0,3}<!--\s*((?:slide:|gap:|\/slide\b)[^\n]*?)\s*-->[ \t]*(?:\r?\n|$)/.exec(source);
      if(match)return {type:'slideDirective',raw:match[0],directive:match[1]};
    },
    renderer:()=>''
  }]});
  if(math)md.use(markedKatex({throwOnError:false,trust:false,nonStandard:true}));
  return md;
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
const css=`*{box-sizing:border-box}body{margin:0;background:#eef2f6;color:#192b3c;font:16px/1.7 "Segoe UI","Microsoft YaHei",sans-serif}main{background:white;max-width:900px;margin:40px auto;padding:48px 64px;border-radius:12px}h1,h2,h3,h4{line-height:1.25;color:#123a50}h1{font-size:36px}h2{font-size:28px;border-bottom:1px solid #dce6ed;padding-bottom:12px}h3{font-size:22px}a{color:#087f8c}img{max-width:100%;max-height:380px;object-fit:contain}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#edf3f6;padding:18px;border-radius:8px;font-size:.85em}code{font-family:Consolas,monospace}blockquote{border-left:4px solid #12a395;margin:20px 0;padding:8px 20px;background:#effaf7}table{border-collapse:collapse;width:100%}td,th{border:1px solid #d6e1e8;padding:8px 12px;text-align:left}th{background:#edf5f7}p,li{overflow-wrap:anywhere}.hljs-keyword,.hljs-selector-tag{color:#a626a4}.hljs-string{color:#287b45}.hljs-number,.hljs-literal{color:#b45b15}.hljs-comment{color:#718096}nav{position:fixed;bottom:12px;left:50%;transform:translateX(-50%);z-index:10;background:#18394d;color:white;padding:8px 16px;border-radius:24px;display:flex;align-items:center;gap:12px}button{border:0;border-radius:16px;padding:7px 12px;cursor:pointer}body.slides main{max-width:none;padding:0;background:none;margin:0}.slide{width:1280px;height:720px;padding:48px 64px;background:white;position:relative;margin:24px auto;overflow:hidden}.slide .content{height:558px;overflow:hidden;font-size:24px;line-height:1.5}.slide h1{font-size:42px;margin-top:0;margin-bottom:16px}.slide h2{font-size:32px}.slide footer{position:absolute;bottom:22px;left:64px;color:#6c8496;font-size:14px}.slide.cover{border-top:12px solid #0b968a}.slide.cover h1{font-size:56px}.slide img{max-height:380px}.slide p{margin:12px 0}.slide pre{font-size:18px}.slide table{font-size:20px}body.present{overflow:hidden;background:#142c3d}body.present .slide{display:none;margin:0;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(var(--scale,1))}body.present .slide.active{display:block}body.flow main{max-width:none;margin:0;padding:0;background:#f4f7fb;border-radius:0}#viewport{height:100vh;overflow:hidden;touch-action:none;cursor:grab}#graph{transform-origin:0 0}svg text{font-family:"Microsoft YaHei","Segoe UI",sans-serif}@media print{body{background:white}nav{display:none}main{margin:0;padding:0;max-width:none}.slide{margin:0!important;break-after:page;display:block!important;position:relative!important;transform:none!important;left:auto!important;top:auto!important}body.present{overflow:visible}pre,blockquote,tr,img{break-inside:avoid}h1,h2,h3{break-after:avoid}}`;
export function wrap(title,mode,body,script='',language='zh-CN',filename=title) { messages(language);return `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${css}${mode==='slides'?slideCss+mathCss()+'.katex-display{max-width:100%;overflow-x:auto;overflow-y:hidden}.katex{overflow-wrap:normal}':''}</style></head><body class="${mode}" data-filename="${esc(filename)}">${body}<script>${script}</script></body></html>`; }
export function slideNavigation(language='zh-CN') {
 const t=messages(language);
 return `<nav data-continued="${t.continued}" data-overflow="${t.overflow}"><button id="prev" aria-label="${t.prev}" title="${t.prev}">←</button><span id="count"></span><button id="next" aria-label="${t.next}" title="${t.next}">→</button><button id="present">${t.present}</button><button id="full">${t.full}</button></nav>`;
}
export const slideNav=slideNavigation();
export {flow} from './flow.js';
export const flowScript=`const v=document.getElementById('viewport'),g=document.getElementById('graph');let x=0,y=0,s=1;const draw=()=>g.style.transform='translate('+x+'px,'+y+'px) scale('+s+')';function fit(){const svg=g.querySelector('svg');s=Math.min(1,(innerWidth-32)/svg.width.baseVal.value,(innerHeight-88)/svg.height.baseVal.value);x=(innerWidth-svg.width.baseVal.value*s)/2;y=Math.max(16,(innerHeight-64-svg.height.baseVal.value*s)/2);draw();}document.getElementById('fit').onclick=fit;v.onwheel=e=>{e.preventDefault();const next=Math.min(4,Math.max(.05,s*Math.exp(-e.deltaY*.001)));x=e.clientX-(e.clientX-x)*next/s;y=e.clientY-(e.clientY-y)*next/s;s=next;draw();};let drag;v.onpointerdown=e=>{drag=[e.clientX,e.clientY,x,y];v.setPointerCapture(e.pointerId);};v.onpointermove=e=>{if(drag){x=drag[2]+e.clientX-drag[0];y=drag[3]+e.clientY-drag[1];draw();}};v.onpointerup=()=>drag=null;v.onpointercancel=()=>drag=null;fit();window.ready=Promise.resolve();`;

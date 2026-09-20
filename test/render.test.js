import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {parser,sections,slides,wrap,slideScript,slideNav} from '../src/render.js';
import {browserLaunch,render} from '../src/cli.js';
test('Typora HTML 图片嵌入、保留缩放，其他 HTML 和代码仍作为文字',async()=>{
 const md=parser('examples');
 const source='# Image\n\n<img src="assets/logo.svg" alt="A &amp; B" style="zoom:25%;position:fixed" onerror="alert(1)" />\n\n<img src="assets/logo.svg" width="80" />\n\n<script>alert(1)</script>\n\n```html\n<img src="missing.png">\n```';
 const html=wrap('image','slides',`<main>${slides(md.lexer(source),md)}</main>${slideNav}`,slideScript);
 assert.doesNotMatch(html,/<img[^>]*onerror=/);
 assert.match(html,/&lt;script&gt;/);
 const browser=await browserLaunch();
 try {
  const page=await browser.newPage();await page.setContent(html);await page.evaluate(()=>window.ready);
  const imgs=page.locator('.content img');assert.equal(await imgs.count(),2);
  const first=await imgs.first().evaluate(i=>({width:i.getBoundingClientRect().width,height:i.getBoundingClientRect().height,alt:i.alt,loaded:i.complete&&i.naturalWidth>0,embedded:i.src.startsWith('data:image/svg+xml;base64,')}));
  assert.deepEqual(first,{width:30,height:12,alt:'A & B',loaded:true,embedded:true});
  assert.equal(await imgs.nth(1).evaluate(i=>i.getBoundingClientRect().width),80);
 }finally{await browser.close();}
});
test('幻灯片按星号、短横线和下划线分隔线分页，标题与代码不触发分页',()=>{
 const md=parser('.');
 const source='***\n\n# 第一页\n\n## 页内标题\n\n# 另一个一级标题\n\n```md\n***\n---\n___\n```\n\n---\n\n## 第二页\n\n[链接][ref]\n\n___\n\n正文第三页\n\n* * *\n\n正文第四页\n\n- - -\n\n正文第五页\n\n_ _ _\n\n正文第六页\n\n***\n\n[ref]: https://example.com\n';
 const html=slides(md.lexer(source),md);
 assert.equal((html.match(/<section /g)||[]).length,7);
 const pages=html.split('</section>').filter(p=>!p.includes('data-toc='));
 assert.match(pages[0],/<h2[^>]*>页内标题<\/h2>/);
 assert.match(pages[0],/<h1[^>]*>另一个一级标题<\/h1>/);
 assert.match(pages[0],/<pre><code>\*\*\*\n---\n___/);
 assert.equal((html.match(/<hr>/g)||[]).length,0);
 assert.match(pages[1],/<h2[^>]*>第二页<\/h2>/);
 assert.match(pages[1],/href="https:\/\/example.com"/);
 assert.match(pages[2],/正文第三页/);
 assert.match(pages[3],/正文第四页/);
 assert.match(pages[4],/正文第五页/);
 assert.match(pages[5],/正文第六页/);
 assert.match(slides(md.lexer('***\n\n---\n\n___'),md,'en'),/<p>Empty document<\/p>/);
});
test('标题解析保留跳级、前言，忽略代码块里的伪标题',()=>{
 const md=parser('.'),root=sections(md.lexer('前言\n\n# 根\n\n```md\n## 不是标题\n```\n\n### 子\n\n## 同级父节点\n'));
 assert.equal(root.children.length,1);assert.deepEqual(root.children[0].children.map(n=>n.title),['子','同级父节点']);assert.equal(root.children[0].body.find(t=>t.type==='code').text,'## 不是标题');
});
test('拒绝错误参数与覆盖源文件',async()=>{
 await assert.rejects(render('examples/slides.md',{mode:'slides',language:'invalid'}),/language/);
 await assert.rejects(render('examples/document.md',{mode:'bad'}));await assert.rejects(render('examples/document.md',{output:'examples/document.md'}));await assert.rejects(render('examples/document.md',{format:'png'}));
});
test('公式离线渲染、分页保持完整，中英文提示和文件名页脚',async()=>{
 await fs.mkdir('tmp/qa',{recursive:true});
 const input='tmp/qa/公式 & demo.md';
 const formula=String.raw`\frac{a_1^2+b_2^2}{\sqrt{x}}`;
 const source=`## 公式 $E=mc^2$\n\n中文行内$x^2$公式。\n\n`+Array.from({length:12},()=>`$$\n${formula}\n$$\n\n`).join('')+'`$code$`\n\n```tex\n$literal$\n```\n\n\\$5\n\n$\\frac{$';
 await fs.writeFile(input,source);
 const browser=await browserLaunch();
 try {
  for(const language of ['zh-CN','en']) {
   const output=await render(input,{mode:'slides',language,output:`tmp/qa/math-${language}.html`});
   const page=await browser.newPage({viewport:{width:1400,height:950}});
   const requests=[];page.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(request.url());});
   await page.goto(new URL('file:///'+output.replaceAll('\\','/')).href);
   await page.evaluate(()=>window.ready);
   assert.equal(await page.locator('html').getAttribute('lang'),language);
   assert.equal(await page.locator('#full').textContent(),language==='en'?'Fullscreen':'全屏');
   assert.equal(await page.locator('#present').textContent(),language==='en'?'Present / Overview':'演示 / 总览');
   const count=await page.locator('.slide').count();assert.ok(count>1);
   assert.match(await page.locator('.slide').nth(1).locator('footer').textContent(),language==='en'?/Continued 1/:/续页 1/);
   assert.equal(await page.locator('.content .katex-display').count(),12);
   assert.equal(await page.locator('.content .katex-display .katex-html').count(),12);
   assert.equal(await page.locator('.page-title .katex').count(),1);
   assert.equal(await page.locator('code .katex').count(),0);
   assert.match(await page.locator('pre code').textContent(),/\$literal\$/);
   assert.equal(await page.locator('.katex-error').count(),1);
   assert.equal(await page.evaluate(()=>[...document.querySelectorAll('.content')].some(el=>el.scrollHeight>el.clientHeight+1)),false);
   assert.equal(await page.evaluate(()=>[...document.fonts].some(font=>font.family.startsWith('KaTeX')&&font.status==='loaded')),true);
   assert.deepEqual(requests,[]);
   await page.click('#present');await page.keyboard.press('ArrowRight');
   assert.equal(await page.locator('.slide.active footer').textContent(),`公式 & demo.md / 2 / ${count} · ${language==='en'?'Continued':'续页'} 1`);
   await page.screenshot({path:`tmp/qa/math-${language}.png`});
   await page.close();
  }
 } finally {await browser.close();}
});
test('长段落、列表、代码跨页无丢失，无垂直溢出；演示可翻页',async()=>{
 const md=parser('.'),source='# 压力测试\n\n## 长页\n\n'+'完整保留长段落内容。'.repeat(350)+'\n\n'+Array.from({length:45},(_,i)=>'- 验收条目 '+i).join('\n')+'\n\n```js\n'+Array.from({length:70},(_,i)=>'const value'+i+' = '+i+';').join('\n')+'\n```';
 const tokens=md.lexer(source),body=slides(tokens,md),browser=await browserLaunch();
 try{const page=await browser.newPage({viewport:{width:1280,height:900}});await page.setContent(wrap('test','slides',`<main>${body}</main>${slideNav}`,slideScript));await page.evaluate(()=>window.ready);
 const result=await page.evaluate(()=>({count:document.querySelectorAll('.slide').length,overflow:[...document.querySelectorAll('.content')].some(e=>e.scrollHeight>e.clientHeight+1),text:[...document.querySelectorAll('.slide:not([data-toc]) .content')].map(e=>e.textContent).join('')}));
 assert.ok(result.count>5);assert.equal(result.overflow,false);
 const reference=await browser.newPage();await reference.setContent(`<main>${body}</main>`);const expected=await reference.locator('.slide:not([data-toc]) .content').allTextContents();assert.equal(result.text.replace(/\s/g,''),expected.join('').replace(/\s/g,''));
 await page.click('#present');await page.keyboard.press('ArrowRight');assert.equal(await page.locator('.slide.active footer').textContent(),`test / 2 / ${result.count} · 续页 1`);
 }finally{await browser.close();}
});
test('三份样例预览无脚本错误、图片可解码并保存检查图',async()=>{
 await fs.mkdir('tmp/qa',{recursive:true});const browser=await browserLaunch();
 try{for(const mode of ['document','slides','flow']){const file=await render(`examples/${mode}.md`,{mode});const page=await browser.newPage({viewport:{width:1400,height:950}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(new URL('file:///'+file.replaceAll('\\','/')).href);await page.evaluate(async()=>{await window.ready;await Promise.all([...document.images].map(i=>i.decode()));});assert.deepEqual(errors,[]);await page.screenshot({path:`tmp/qa/${mode}.png`});await page.close();}}finally{await browser.close();}
});

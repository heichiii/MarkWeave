import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {parser,sections,slides,wrap,slideScript,slideNav} from '../src/render.js';
import {browserLaunch,render} from '../src/cli.js';
test('标题解析保留跳级、前言，忽略代码块里的伪标题',()=>{
 const md=parser('.'),root=sections(md.lexer('前言\n\n# 根\n\n```md\n## 不是标题\n```\n\n### 子\n\n## 同级父节点\n'));
 assert.equal(root.children.length,1);assert.deepEqual(root.children[0].children.map(n=>n.title),['子','同级父节点']);assert.equal(root.children[0].body.find(t=>t.type==='code').text,'## 不是标题');
});
test('拒绝错误参数与覆盖源文件',async()=>{
 await assert.rejects(render('examples/document.md',{mode:'bad'}));await assert.rejects(render('examples/document.md',{output:'examples/document.md'}));await assert.rejects(render('examples/document.md',{format:'png'}));
});
test('长段落、列表、代码跨页无丢失，无垂直溢出；演示可翻页',async()=>{
 const md=parser('.'),source='# 压力测试\n\n## 长页\n\n'+'完整保留长段落内容。'.repeat(350)+'\n\n'+Array.from({length:45},(_,i)=>'- 验收条目 '+i).join('\n')+'\n\n```js\n'+Array.from({length:70},(_,i)=>'const value'+i+' = '+i+';').join('\n')+'\n```';
 const tokens=md.lexer(source),body=slides(tokens,md),browser=await browserLaunch();
 try{const page=await browser.newPage({viewport:{width:1280,height:900}});await page.setContent(wrap('test','slides',`<main>${body}</main>${slideNav}`,slideScript));await page.evaluate(()=>window.ready);
 const result=await page.evaluate(()=>({count:document.querySelectorAll('.slide').length,overflow:[...document.querySelectorAll('.content')].some(e=>e.scrollHeight>e.clientHeight+1),text:[...document.querySelectorAll('.content')].map(e=>e.textContent).join('')}));
 assert.ok(result.count>5);assert.equal(result.overflow,false);
 const reference=await browser.newPage();await reference.setContent(`<main>${body}</main>`);const expected=await reference.locator('.content').allTextContents();assert.equal(result.text.replace(/\s/g,''),expected.join('').replace(/\s/g,''));
 await page.click('#present');await page.keyboard.press('ArrowRight');assert.equal(await page.locator('.slide.active footer').textContent(),`MYMD / 2 / ${result.count}`);
 }finally{await browser.close();}
});
test('三份样例预览无脚本错误、图片可解码并保存检查图',async()=>{
 await fs.mkdir('tmp/qa',{recursive:true});const browser=await browserLaunch();
 try{for(const mode of ['document','slides','flow']){const file=await render(`examples/${mode}.md`,{mode});const page=await browser.newPage({viewport:{width:1400,height:950}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(new URL('file:///'+file.replaceAll('\\','/')).href);await page.evaluate(async()=>{await window.ready;await Promise.all([...document.images].map(i=>i.decode()));});assert.deepEqual(errors,[]);await page.screenshot({path:`tmp/qa/${mode}.png`});await page.close();}}finally{await browser.close();}
});

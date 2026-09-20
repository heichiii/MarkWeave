import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {parser,slides,wrap,slideScript,slideNav} from '../src/render.js';
import {browserLaunch,render} from '../src/cli.js';
import {pathToFileURL} from 'node:url';

test('目录位于扉页及其续页之后，排除总标题，计章计节并在续页及无标题页继承',async()=>{
 const md=parser('.');
 const source='# 总标题\n\n'+'封面长正文。'.repeat(700)+'\n\n***\n\n# 起步\n\n***\n\n## 背景\n\n'+Array.from({length:30},()=> '背景内容。\n\n').join('')+'***\n\n补充说明\n\n***\n\n## 方法\n\n### 细节\n\n```md\n# 假章\n## 假节\n```\n\n***\n\n# 结果\n\n***\n\n## 结论\n\n正文';
 const browser=await browserLaunch();
 try {
  const page=await browser.newPage();
  await page.setContent(wrap('test','slides',`<main>${slides(md.lexer(source),md)}</main>${slideNav}`,slideScript));
  await page.evaluate(()=>window.ready);
  const coverPages=await page.locator('[data-type=cover]').count();
  assert.equal(await page.locator('.slide').nth(coverPages).locator('h1').textContent(),'目录');
  assert.equal(await page.locator('.slide').nth(0).locator('header').isVisible(),false);
  assert.equal(await page.locator('.slide').nth(1).locator('header').isVisible(),false);
  const toc=await page.locator('[data-toc] .toc-entry').allTextContents();
  assert.deepEqual(toc,['1 起步','2 结果']);
  const pages=await page.locator('.slide:not([data-toc])').evaluateAll(nodes=>nodes.map(p=>({type:p.dataset.type,title:p.querySelector('.page-title')?.textContent||'',text:p.querySelector('.content').textContent,label:p.querySelector('header').textContent})));
  assert.equal(pages[0].label,'');
  for(const p of pages.filter(p=>p.title.startsWith('背景')))assert.equal(p.label,'第 1 章 · 起步 / 第 1.1 节 · 背景');
  assert.equal(pages.find(p=>p.type==='normal'&&p.text.includes('补充说明')).label,'第 1 章 · 起步 / 第 1.1 节 · 背景');
  assert.equal(pages.at(-1).label,'第 2 章 · 结果 / 第 2.1 节 · 结论');
  assert.equal(await page.locator('.content').evaluateAll(nodes=>nodes.some(e=>e.getBoundingClientRect().bottom>e.parentElement.getBoundingClientRect().bottom+1)),false);
 } finally {await browser.close();}
});

test('超长目录保留所有条目，Logo 和目录续页排版可用',async()=>{
 await fs.mkdir('tmp/qa',{recursive:true});
 const input='tmp/qa/outline.md';
 await fs.writeFile(input,'# Title\n\n'+Array.from({length:12},(_,c)=>`***\n\n# Chapter ${c+1}\n\n`+Array.from({length:12},(_,s)=>`***\n\n## Topic ${c+1}.${s+1}\n\nContent.\n\n`).join('')).join(''));
 const file=await render(input,{mode:'slides',language:'en',output:'tmp/qa/outline.html',logo:{path:'examples/assets/logo.svg'}});
 const browser=await browserLaunch();
 try {
  const page=await browser.newPage({viewport:{width:1400,height:950}});
  await page.goto(pathToFileURL(file).href);await page.evaluate(()=>window.ready);
  assert.equal(await page.locator('.toc-depth-1').count(),12);
  assert.equal(await page.locator('.toc-depth-2').count(),0);
  assert.ok(await page.locator('.slide[data-toc]').count()>1);
  assert.equal(await page.locator('.slide').nth(1).locator('h1').textContent(),'Contents');
  assert.equal(await page.locator('.content').evaluateAll(nodes=>nodes.some(e=>e.getBoundingClientRect().bottom>e.parentElement.getBoundingClientRect().bottom+1)),false);
  await fs.mkdir('tmp/qa',{recursive:true});
  await page.click('#present');await page.keyboard.press('ArrowRight');
  await page.screenshot({path:'tmp/qa/contents.png'});
 } finally {await browser.close();}
});

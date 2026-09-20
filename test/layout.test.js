import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {parser,slides,wrap,slideScript,slideNav} from '../src/render.js';
import {slidePages} from '../src/slides.js';
import {browserLaunch,render} from '../src/cli.js';

const model=source=>slidePages(parser('.').lexer(source));
const document=source=>{const md=parser('.');return wrap('layout','slides',`<main>${slides(md.lexer(source),md)}</main>${slideNav}`,slideScript);};

test('五类页面仅由页首决定，普通页继承状态，章切换清零节',()=>{
 const pages=model('前言\n\n***\n\n# Cover\n\n## Not a section\n\n***\n\n# A\n\n## Still not a section\n\n***\n\n## A1\n\n***\n\nText\n\n# Not a chapter\n\n## Not a section\n\n***\n\n## A2\n\n***\n\n# B\n\n***\n\nText\n\n***\n\n## B1\n\n***\n\n### Normal');
 assert.deepEqual(pages.map(p=>[p.type,p.chapter,p.section]),[
  ['normal',0,0],['cover',0,0],['chapter',1,0],['section',1,1],['normal',1,1],['section',1,2],['chapter',2,0],['normal',2,0],['section',2,1],['normal',2,1]
 ]);
 assert.equal(pages[4].chapterTitle,'A');assert.equal(pages[4].sectionTitle,'A1');
 assert.equal(pages[7].sectionTitle,'');
 assert.equal(model('Setext\n======')[0].type,'normal');
 assert.doesNotMatch(document('Text only'),/data-toc=/);
});

test('布局标记解析、像素默认值、配对校验和代码隔离',()=>{
 const [p,next]=model('<!-- slide: x=-10 y=5% -->\n\n# Cover\n\n<!-- gap: 24px -->\n\nText\n\n<!-- /slide -->\n\n***\n\nNormal');
 assert.deepEqual(p.layout,{manual:true,x:'-10px',y:'5%'});
 assert.equal(p.type,'cover');assert.equal(next.layout.manual,false);
 assert.equal(model('<!-- gap: 3% -->\n\n## Section')[0].type,'section');
 const code=model('```md\n<!-- slide: x=20px -->\n***\n# Fake\n<!-- /slide -->\n```');
 assert.equal(code.length,1);assert.equal(code[0].layout.manual,false);assert.equal(code[0].type,'normal');
 for(const source of ['<!-- slide: y=10px -->\nText','<!-- /slide -->','Text\n\n<!-- slide: x=1px -->\n<!-- /slide -->','<!-- slide: z=1px -->\n<!-- /slide -->','<!-- slide: x=1px x=2px -->\n<!-- /slide -->','<!-- slide: x=abc -->\n<!-- /slide -->','<!-- gap: -5px -->','<!-- slide: -->\nText\n<!-- /slide -->\n\nMore','<!-- slide: -->\nText\n\n***\n\n<!-- /slide -->'])assert.throws(()=>model(source));
});

test('正文包含页首标题，居中布局和百分比以固定正文区域为基准，框架不移动',async()=>{
 const browser=await browserLaunch();
 try {
  const page=await browser.newPage();
  await page.setContent(document('# Cover\n\nSubtitle\n\n***\n\n# Chapter\n\nIntro\n\n***\n\n## Section\n\nText\n\n***\n\n<!-- slide: x=5% y=10% -->\n\n## Section moved\n\n<!-- gap: 5% -->\n\nText\n\n<!-- /slide -->'));
  await page.evaluate(()=>window.ready);
  const result=await page.locator('.slide').evaluateAll(nodes=>nodes.map(p=>{
   const region=p.querySelector('.body-region'),box=p.querySelector('.content'),r=region.getBoundingClientRect(),b=box.getBoundingClientRect();
   return {type:p.dataset.type,left:b.left-r.left,top:b.top-r.top,height:b.height,regionHeight:r.height,regionWidth:r.width,headerTop:p.querySelector('header').offsetTop,gap:p.querySelector('.slide-gap')?.getBoundingClientRect().height};
  }));
  assert.deepEqual(result.map(p=>p.type),['cover','toc','chapter','section','section']);
  for(const p of [result[0],result[2]])assert.ok(Math.abs(p.top-(p.regionHeight-p.height)/2)<1);
  const moved=result.at(-1);assert.ok(Math.abs(moved.left-moved.regionWidth*.05)<1);assert.ok(Math.abs(moved.top-moved.regionHeight*.1)<1);
  assert.ok(Math.abs(moved.gap-moved.regionHeight*.05)<1);assert.equal(moved.headerTop,result[3].headerTop);
  assert.equal(await page.locator('.slide[data-manual=true] .content > .page-title').textContent(),'Section moved');
  assert.deepEqual(await page.evaluate(()=>window.slideWarnings),[]);
 }finally{await browser.close();}
});

test('手动长页不续页且明确提示溢出，PDF 拒绝输出被截断的正文',async()=>{
 const source='# Cover\n\n***\n\n# Chapter\n\n***\n\n<!-- slide: x=0 y=0 -->\n\n## Long section\n\n'+'Long content. '.repeat(1600)+'\n\n<!-- /slide -->';
 const browser=await browserLaunch();
 try {
  const page=await browser.newPage();await page.setContent(document(source));await page.evaluate(()=>window.ready);
  assert.equal(await page.locator('.slide').count(),4);
  assert.equal(await page.locator('[data-manual=true] .layout-warning').isVisible(),true);
  const warnings=await page.evaluate(()=>window.slideWarnings);assert.equal(warnings.length,1);assert.equal(warnings[0].sourcePage,3);
  assert.equal((await page.locator('[data-manual=true] .content').textContent()).replace(/\s/g,''),('Long section'+'Long content. '.repeat(1600)).replace(/\s/g,''));
 }finally{await browser.close();}
 await fs.mkdir('tmp/qa',{recursive:true});await fs.writeFile('tmp/qa/overflow.md',source);
 await assert.rejects(render('tmp/qa/overflow.md',{mode:'slides',format:'pdf',output:'tmp/qa/overflow.pdf'}),/手动布局溢出/);
});

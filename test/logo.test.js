import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {parser,slides,wrap,slideScript,slideNav} from '../src/render.js';
import {browserLaunch,render} from '../src/cli.js';

test('Logo 四角定位、缩放、续页和打印布局正确且正文区域固定',async()=>{
 await fs.mkdir('tmp/qa',{recursive:true});
 const md=parser('.'),tokens=md.lexer('# Logo test\n\n'+Array.from({length:30},(_,i)=>`Paragraph ${i}: Content stays visible.\n\n`).join('')+'***\n\n# Final slide\n\nEnd.');
 const browser=await browserLaunch();
 try {
  const page=await browser.newPage({viewport:{width:1400,height:950}});
  for(const position of ['top-left','top-right','bottom-left','bottom-right']) {
   const scale=position==='bottom-left'?3:1.5;
   const html=slides(tokens,md,'en',{path:'examples/assets/logo.svg',scale,position});
   await page.setContent(wrap('Logo','slides',`<main>${html}</main>${slideNav}`,slideScript));
   await page.evaluate(()=>window.ready);
   await page.emulateMedia({media:'print'});
   const checks=await page.evaluate(()=>[...document.querySelectorAll('.slide')].map(slide=>{
    const logo=slide.querySelector('.slide-logo'),r=logo.getBoundingClientRect(),s=slide.getBoundingClientRect(),body=slide.querySelector('.content'),b=body.getBoundingClientRect(),f=slide.querySelector('footer').getBoundingClientRect();
    const overlap=q=>r.left<q.right&&r.right>q.left&&r.top<q.bottom&&r.bottom>q.top;
    return {count:slide.querySelectorAll('.slide-logo').length,decoded:logo.complete&&logo.naturalWidth>0,embedded:logo.src.startsWith('data:image/svg+xml;base64,'),width:r.width,height:r.height,left:r.left-s.left,right:s.right-r.right,top:r.top-s.top,bottom:s.bottom-r.bottom,overlap:overlap(f),overflow:body.scrollHeight>slide.querySelector('.body-region').clientHeight+1};
   }));
   assert.ok(checks.length>2);
   for(const check of checks) {
    assert.equal(check.count,1);assert.ok(check.decoded&&check.embedded);
    assert.equal(check.width,120*scale);assert.equal(check.height,48*scale);
    assert.equal(check[position.endsWith('left')?'left':'right'],64);
    assert.equal(check[position.startsWith('top')?'top':'bottom'],24);
    assert.equal(check.overlap,false);assert.equal(check.overflow,false);
   }
   await page.emulateMedia({media:'screen'});
   await page.click('#present');await page.keyboard.press('ArrowRight');
   assert.equal(await page.locator('.slide.active .slide-logo').count(),1);
   await page.screenshot({path:`tmp/qa/logo-${position}.png`});
  }
 } finally {await browser.close();}
 await render('examples/slides.md',{mode:'slides',format:'pdf',output:'tmp/qa/logo.pdf',logo:{path:'examples/assets/logo.svg',position:'bottom-right'}});
 assert.equal((await fs.readFile('tmp/qa/logo.pdf')).subarray(0,5).toString(),'%PDF-');
});

test('Logo 读取错误明确，无配置或非 slides 模式不添加 Logo',async()=>{
 const md=parser('.'),tokens=md.lexer('# Title');
 assert.doesNotMatch(slides(tokens,md),/slide-logo/);
 assert.throws(()=>slides(tokens,md,'en',{path:'missing-logo.png'}),/无法读取 Logo/);
 assert.throws(()=>slides(tokens,md,'en',{path:'logo.txt'}),/不支持的 Logo/);
 const file=await render('examples/document.md',{output:'tmp/qa/no-logo.html',logo:{path:'missing.png'}});
 assert.doesNotMatch(await fs.readFile(file,'utf8'),/slide-logo/);
});

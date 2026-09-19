#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {resolveOptions} from './config.js';
import {chromium} from 'playwright';
import {parser,sections,wrap,slides,flow,slideScript,slideNavigation,flowScript,messages} from './render.js';

export async function browserLaunch() {
 const options={headless:true};
 if(process.env.MYMD_BROWSER) return chromium.launch({...options,executablePath:process.env.MYMD_BROWSER});
 try{return await chromium.launch(options);}catch(first){try{return await chromium.launch({...options,channel:'msedge'});}catch{throw new Error('找不到浏览器。请运行 npx playwright install chromium，或设置 MYMD_BROWSER 为浏览器路径。',{cause:first});}}
}
export async function render(input,{mode='document',format='html',output,language='zh-CN',logo}={}) {
 const text=messages(language);
 if(!['document','slides','flow'].includes(mode))throw Error('mode 必须是 document、slides 或 flow');
 if(!(mode==='flow'?['html','svg','png']:['html','pdf']).includes(format))throw Error('此模式不支持该导出格式');
 input=path.resolve(input);output=path.resolve(output||`output/${path.parse(input).name}.${mode}.${format}`);
 if(input===output)throw Error('输出不能覆盖输入文件');
 const md=parser(path.dirname(input),{math:mode==='slides'}),source=await fs.readFile(input,'utf8'),tokens=md.lexer(source),title=path.parse(input).name;
 let svg,html;
 if(mode==='document')html=wrap(title,mode,`<main>${md.parser(tokens)}</main>`,'',language);
 if(mode==='slides')html=wrap(title,mode,`<main>${slides(tokens,md,language,logo)}</main>${slideNavigation(language)}`,slideScript,language,path.basename(input));
 if(mode==='flow'){svg=flow(sections(tokens));html=wrap(title,mode,`<main id="viewport"><div id="graph">${svg}</div></main><nav><span>${text.pan}</span><button id="fit">${text.fit}</button></nav>`,flowScript,language);}
 await fs.mkdir(path.dirname(output),{recursive:true});
 if(format==='html'||format==='svg')await fs.writeFile(output,format==='svg'?svg:html);
 else {
  const browser=await browserLaunch();
  try {
   const page=await browser.newPage({viewport:{width:1280,height:900}});
   await page.setContent(format==='png'?wrap(title,'',svg):html,{waitUntil:'networkidle'});
   await page.evaluate(async()=>{await window.ready;await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
   if(format==='pdf')await page.pdf({path:output,printBackground:true,...(mode==='slides'?{width:'1280px',height:'720px',margin:{top:0,bottom:0,left:0,right:0}}:{format:'A4',margin:{top:'18mm',bottom:'18mm',left:'18mm',right:'18mm'}})});
   else await page.locator('svg').screenshot({path:output,timeout:60000});
  } finally {await browser.close();}
 }
 return output;
}
async function main(){
 const values=await resolveOptions(process.argv.slice(2));
 if(values.help){console.log('用法：node src/cli.js [input.md] [--config 配置.json] [--mode document|slides|flow] [--format html|pdf|svg|png] [-o 文件] [--language zh-CN|en] [--preview|--no-preview] [--logo 图片路径] [--logo-scale 倍率] [--logo-position 位置]\n优先级：命令行参数 > JSON 配置 > 默认值；-c 为 --config 的简写。');return;}
 const output=await render(values.input,values);console.log(output);
 if(values.preview){const browser=await chromium.launch({headless:false,...(process.env.MYMD_BROWSER?{executablePath:process.env.MYMD_BROWSER}:process.platform==='win32'?{channel:'msedge'}:{})});const page=await browser.newPage();await page.goto(pathToFileURL(output).href);console.log('关闭预览浏览器即可退出。');}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(e=>{console.error('mymd:',e.message);process.exitCode=1;});

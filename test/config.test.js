import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolveOptions} from '../src/config.js';

async function fixture(t) {
 await fs.mkdir('tmp/qa',{recursive:true});
 const dir=await fs.mkdtemp(path.resolve('tmp/qa/config-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const file=path.join(dir,'settings.json');
 return {dir,file,write:value=>fs.writeFile(file,JSON.stringify(value))};
}

test('配置与显式命令行逐项合并，默认值不覆盖配置，相对路径按来源解析',async t=>{
 const {dir,file,write}=await fixture(t);
 await write({input:'source.md',mode:'slides',format:'pdf',output:'deck.pdf',language:'en',preview:true});
 assert.deepEqual(await resolveOptions(['-c',file]),{
  input:path.join(dir,'source.md'),mode:'slides',format:'pdf',output:path.join(dir,'deck.pdf'),language:'en',preview:true
 });
 const options=await resolveOptions(['replacement.md','--config',file,'--mode','document','--format','html','-o','result.html','--language','zh-CN','--no-preview'],dir);
 assert.deepEqual(options,{input:path.join(dir,'replacement.md'),mode:'document',format:'html',output:path.join(dir,'result.html'),language:'zh-CN',preview:false});
 const partial=await resolveOptions(['--config',file,'--language','zh-CN']);
 assert.equal(partial.mode,'slides');assert.equal(partial.format,'pdf');assert.equal(partial.language,'zh-CN');
 await write({input:'source.md',preview:false});
 assert.equal((await resolveOptions(['-c',file,'--preview'])).preview,true);
});

test('无配置保持默认行为，格式从最终输出路径推断，显式格式优先',async t=>{
 const {file,write}=await fixture(t);
 assert.deepEqual(await resolveOptions(['source.md']),{input:path.resolve('source.md'),mode:'document',language:'zh-CN',preview:false,format:'html'});
 await write({input:'source.md',output:'deck.pdf'});
 assert.equal((await resolveOptions(['-c',file])).format,'pdf');
 assert.equal((await resolveOptions(['-c',file,'-o','deck.html'])).format,'html');
 await write({input:'source.md',format:'pdf'});
 assert.equal((await resolveOptions(['-c',file,'-o','deck.html'])).format,'pdf');
 assert.deepEqual(await resolveOptions([]),{help:true});
 assert.deepEqual(await resolveOptions(['--help','-c','missing.json']),{help:true});
});

test('Logo 配置支持相对路径和逐项命令行覆盖，拒绝无效选项',async t=>{
 const {dir,file,write}=await fixture(t);
 await write({input:'source.md',logo:{path:'brand.svg',scale:1.5,position:'bottom-left'}});
 assert.deepEqual((await resolveOptions(['-c',file])).logo,{path:path.join(dir,'brand.svg'),scale:1.5,position:'bottom-left'});
 assert.deepEqual((await resolveOptions(['-c',file,'--logo-scale','2'])).logo,{path:path.join(dir,'brand.svg'),scale:2,position:'bottom-left'});
 assert.deepEqual((await resolveOptions(['-c',file,'--logo','new.png','--logo-position','top-left'],dir)).logo,{path:path.join(dir,'new.png'),scale:1.5,position:'top-left'});
 for(const logo of [null,[],{}, {path:'x',scale:0},{path:'x',scale:4},{path:'x',scale:'1'},{path:'x',position:'center'},{path:'x',unknown:1}]) {
  await write({input:'source.md',logo});await assert.rejects(resolveOptions(['-c',file]),/logo|Logo/);
 }
 await assert.rejects(resolveOptions(['source.md','--logo','x.png','--logo-scale','NaN']),/logo.scale/);
});

test('无效配置、缺少输入与冲突参数给出错误',async t=>{
 const {file,write}=await fixture(t);
 for(const [value,message] of [[null,/JSON 对象/],[[],/JSON 对象/],[{unknown:true},/未知配置/],[{preview:'false'},/布尔值/],[{input:''},/非空字符串/],[{},/设置 input/]]) {
  await write(value);await assert.rejects(resolveOptions(['-c',file]),message);
 }
 await fs.writeFile(file,'{broken');
 await assert.rejects(resolveOptions(['-c',file]),/无法读取 JSON 配置文件/);
 await assert.rejects(resolveOptions(['-c',file+'.missing']),/无法读取 JSON 配置文件/);
 await assert.rejects(resolveOptions(['a.md','b.md']),/每次输入一个/);
 await assert.rejects(resolveOptions(['a.md','--preview','--no-preview']),/不能同时使用/);
});

test('真实 CLI 使用配置渲染，并允许命令行覆盖模式、语言、输出和预览',async t=>{
 const {dir,file,write}=await fixture(t);
 await fs.writeFile(path.join(dir,'source.md'),'# First\n\n***\n\n## Second\n');
 await write({input:'source.md',mode:'slides',output:'configured.html',language:'en',preview:true});
 const run=promisify(execFile);
 await run(process.execPath,['src/cli.js','--config',file,'--no-preview']);
 const configured=await fs.readFile(path.join(dir,'configured.html'),'utf8');
 assert.match(configured,/<html lang="en">/);assert.match(configured,/<body class="slides"/);
 assert.equal((configured.match(/<section class="slide">/g)||[]).length,2);
 const output=path.join(dir,'override.html');
 await run(process.execPath,['src/cli.js','-c',file,'--mode','document','--language','zh-CN','-o',output,'--no-preview']);
 const overridden=await fs.readFile(output,'utf8');
 assert.match(overridden,/<html lang="zh-CN">/);assert.match(overridden,/<body class="document"/);
});

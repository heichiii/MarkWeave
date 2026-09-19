import fs from 'node:fs/promises';
import path from 'node:path';
import {parseArgs} from 'node:util';

const fields={input:'string',mode:'string',format:'string',output:'string',language:'string',preview:'boolean'};

export async function resolveOptions(args, cwd=process.cwd()) {
 const {values,positionals}=parseArgs({args,allowPositionals:true,options:{
  config:{type:'string',short:'c'},mode:{type:'string'},format:{type:'string'},
  output:{type:'string',short:'o'},language:{type:'string'},preview:{type:'boolean'},
  'no-preview':{type:'boolean'},help:{type:'boolean',short:'h'}
 }});
 if(values.help)return {help:true};
 if(positionals.length>1)throw Error('每次输入一个 Markdown 文件');
 if(values.preview && values['no-preview'])throw Error('--preview 和 --no-preview 不能同时使用');
 let config={};
 if(values.config!==undefined) {
  const file=path.resolve(cwd,values.config);
  try {config=JSON.parse((await fs.readFile(file,'utf8')).replace(/^\uFEFF/,''));}
  catch(error){throw new Error(`无法读取 JSON 配置文件 ${file}：${error.message}`,{cause:error});}
  if(!config || typeof config!=='object' || Array.isArray(config))throw Error('配置文件必须是 JSON 对象');
  for(const [key,value] of Object.entries(config)) {
   if(!Object.hasOwn(fields,key))throw Error(`未知配置选项：${key}`);
   if(typeof value!==fields[key] || (typeof value==='string' && !value.trim()))throw Error(`配置选项 ${key} 必须是${fields[key]==='boolean'?'布尔值':'非空字符串'}`);
  }
  for(const key of ['input','output'])if(config[key]!==undefined)config[key]=path.resolve(path.dirname(file),config[key]);
 }
 const options={mode:'document',language:'zh-CN',preview:false,...config};
 for(const key of ['mode','format','output','language','preview'])if(values[key]!==undefined)options[key]=values[key];
 if(values['no-preview'])options.preview=false;
 if(positionals.length)options.input=path.resolve(cwd,positionals[0]);
 if(values.output!==undefined)options.output=path.resolve(cwd,values.output);
 if(!options.input) {
  if(values.config!==undefined)throw Error('请在配置文件中设置 input，或在命令行指定 Markdown 文件');
  return {help:true};
 }
 options.format??=options.output?path.extname(options.output).slice(1):'html';
 return options;
}

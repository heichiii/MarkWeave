import fs from 'node:fs';
import path from 'node:path';

export function validateLogo(logo,{partial=false}={}) {
 if(!logo || typeof logo!=='object' || Array.isArray(logo))throw Error('logo 必须是包含 path、scale、position 的对象');
 for(const key of Object.keys(logo))if(!['path','scale','position'].includes(key))throw Error(`未知 Logo 配置：${key}`);
 if((!partial || logo.path!==undefined) && (typeof logo.path!=='string' || !logo.path.trim()))throw Error('logo.path 必须是非空图片路径');
 if(logo.scale!==undefined && (typeof logo.scale!=='number' || !Number.isFinite(logo.scale) || logo.scale<=0 || logo.scale>3))throw Error('logo.scale 必须大于 0 且不超过 3');
 if(logo.position!==undefined && !['top-left','top-right','bottom-left','bottom-right'].includes(logo.position))throw Error('logo.position 必须为 top-left、top-right、bottom-left 或 bottom-right');
}

export function slideLogo(logo) {
 if(logo===undefined)return {html:'',style:''};
 validateLogo(logo);
 const {scale=1,position='top-right'}=logo;
 const mime={'.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp'}[path.extname(logo.path).toLowerCase()];
 if(!mime)throw Error(`不支持的 Logo 图片类型：${logo.path}`);
 let data;
 try {data=fs.readFileSync(logo.path).toString('base64');}
 catch(error){throw new Error(`无法读取 Logo 图片 ${logo.path}：${error.message}`,{cause:error});}
 const [vertical,horizontal]=position.split('-'),width=120*scale,height=48*scale;
 const footer=position==='bottom-left'?`--footer-left:${88+width}px;`:'';
 return {
  style:footer,
  html:`<img class="slide-logo" alt="Logo" src="data:${mime};base64,${data}" style="position:absolute;${vertical}:24px;${horizontal}:64px;width:${width}px;height:${height}px;max-width:none;max-height:none;object-fit:contain;object-position:${horizontal} ${vertical};">`
 };
}

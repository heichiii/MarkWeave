import {render} from '../src/cli.js';
for(const mode of ['document','slides','flow'])for(const format of mode==='flow'?['html','svg','png']:['html','pdf'])console.log(await render(`examples/${mode}.md`,{mode,format}));

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parser,sections} from '../src/render.js';
import {layoutFlow,flow} from '../src/flow.js';

test('pstree 单链横向对齐，分支和长正文不重叠，所有节点在画布内',()=>{
  const inputs=[
    '# A\n## B\n### C\n#### D',
    '# A\n## B\n### C\n### D\n## E\n### F\n# G\n## H',
    '# 长标题'.repeat(1)+'\n\n'+'正文'.repeat(500)+'\n## 子节点\n### 孙节点\n## 兄弟节点',
    '前言\n\n# 标题\n### 跳级\n\n说明',
    '',
  ];
  for(const input of inputs){
    const root=sections(parser('.').lexer(input));const {nodes,width,height}=layoutFlow(root);
    for(const n of nodes){
      assert.ok(n.x>=0&&n.y>=0&&n.x+n.width<=width&&n.y+n.height<=height);
      if(n.children.length)assert.equal(n.y,n.children[0].y);
      for(const other of nodes.filter(o=>o.id!==n.id))assert.ok(n.x+n.width<=other.x||other.x+other.width<=n.x||n.y+n.height<=other.y||other.y+other.height<=n.y,'节点不得重叠');
    }
    const svg=flow(root);assert.equal((svg.match(/class="node"/g)||[]).length,nodes.length);
    const expectedSequences=[layoutFlow(root).roots,...nodes.map(n=>n.children)].reduce((sum,group)=>sum+Math.max(0,group.length-1),0);
    assert.equal((svg.match(/class="sequence"/g)||[]).length,expectedSequences);
  }
  const chain=layoutFlow(sections(parser('.').lexer(inputs[0])));
  assert.equal(new Set(chain.nodes.map(n=>n.y)).size,1);
  assert.ok(chain.height<220);
});

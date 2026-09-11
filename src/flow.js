// A pstree-style layout: first child shares the parent's title baseline;
// subsequent children reserve only the height of their preceding subtree.
const escapeXml = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function wrapLines(text, limit) {
  return text.split('\n').flatMap(line => {
    const out=[]; let current='', width=0;
    for(const char of line) {
      const size=char.codePointAt(0)>255?2:1.25;
      if(width+size>limit){out.push(current);current='';width=0;}
      current+=char;width+=size;
    }
    return [...out,current];
  });
}
export function layoutFlow(root) {
  const gap=24, columnGap=72, nodes=[], columns=[];
  function measure(source, depth) {
    const title=wrapLines(source.title,28);
    const raw=source.body.map(t=>t.raw).join('').trim();
    const body=raw?wrapLines(raw,38):[];
    const node={id:source.id,depth,title,body,height:20+title.length*25+(body.length?10+body.length*20:0)};
    const units=s=>[...s].reduce((sum,c)=>sum+(c.codePointAt(0)>255?2:1.25),0);
    node.width=Math.max(200,Math.ceil(Math.max(...title.map(s=>units(s)*9.5),...body.map(s=>units(s)*7.5)))+32);
    columns[depth]=Math.max(columns[depth]||0,node.width);
    nodes.push(node);node.children=source.children.map(c=>measure(c,depth+1));
    node.subtreeHeight=Math.max(node.height,node.children.reduce((h,c)=>h+c.subtreeHeight,0)+Math.max(0,node.children.length-1)*gap);
    return node;
  }
  const sources=root.body.some(t=>t.type!=='space')||!root.children.length?[root]:root.children;
  const roots=sources.map(n=>measure(n,0));
  const offsets=[40];for(let i=1;i<columns.length;i++)offsets[i]=offsets[i-1]+columns[i-1]+columnGap;
  function place(node,top) {
    node.x=offsets[node.depth];node.y=top;node.width=columns[node.depth];
    let cursor=top;for(const child of node.children){place(child,cursor);cursor+=child.subtreeHeight+gap;}
  }
  let cursor=100;for(const root of roots){place(root,cursor);cursor+=root.subtreeHeight+gap;}
  return {nodes,roots,width:Math.max(640,offsets.at(-1)+columns.at(-1)+40),height:cursor-gap+40};
}
export function flow(root) {
  const {nodes,roots,width,height}=layoutFlow(root);
  const branches=[],sequences=[];
  function siblings(group) {
    for(let i=1;i<group.length;i++) {
      const a=group[i-1],b=group[i],x=a.x-12;
      sequences.push(`<path class="sequence" d="M${x},${a.y+32} V${b.y+22}"/>`);
    }
  }
  siblings(roots);
  for(const n of nodes) {
    if(!n.children.length)continue;
    const trunk=n.children[0].x-36,first=n.children[0],last=n.children.at(-1);
    branches.push(`<path class="branch" d="M${n.x+n.width},${n.y+22} H${trunk} V${last.y+22}"/>`);
    for(const c of n.children)branches.push(`<path class="branch" d="M${trunk},${c.y+22} H${c.x}"/>`);
    if(first!==last)branches.push(`<circle cx="${trunk}" cy="${n.y+22}" r="3" fill="#849ba9"/>`);
    siblings(n.children);
  }
  const cards=nodes.map(n=>`<g class="node" data-id="${n.id}"><rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" rx="7" fill="${n.depth===0?'#e6f4f1':'#ffffff'}" stroke="${n.depth===0?'#78b6ab':'#d7e1e7'}"/>${n.title.map((line,i)=>`<text x="${n.x+16}" y="${n.y+29+i*25}" font-size="19" font-weight="600" fill="#173c51">${escapeXml(line)}</text>`).join('')}${n.body.map((line,i)=>`<text x="${n.x+16}" y="${n.y+25+n.title.length*25+i*20}" font-size="15" fill="#607585">${escapeXml(line)}</text>`).join('')}</g>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="标题结构树"><style>text{font-family:'Microsoft YaHei','Segoe UI',sans-serif}.branch{fill:none;stroke:#849ba9;stroke-width:1.5;stroke-linejoin:round}.sequence{fill:none;stroke:#099a89;stroke-width:1.3;stroke-dasharray:3 5;marker-end:url(#arrow)}</style><defs><marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 L0 6 L6 3z" fill="#099a89"/></marker></defs><rect width="100%" height="100%" fill="#f4f7fb"/><text x="40" y="38" font-size="20" font-weight="600" fill="#173c51">标题结构树</text><text x="40" y="66" font-size="13" fill="#607585">从左到右展开层级 · 从上到下阅读同级步骤　｜　实线：包含　虚线箭头：文档顺序</text>${branches.join('')}${sequences.join('')}${cards}</svg>`;
}

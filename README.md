# mymd

一份普通 Markdown，通过参数生成阅读文档、幻灯片或标题结构流程图。所有处理在本地完成，不使用 AI 改写内容。

## 快速开始

需要 Node.js 22 或更高版本。首次安装：

```sh
npm install
npx playwright install chromium
```

Windows 上已安装 Microsoft Edge 时可以直接使用，无需额外下载 Chromium。也可将 `MYMD_BROWSER` 环境变量设为 Chromium 系浏览器可执行文件路径。

```sh
node src/cli.js examples/document.md --mode document --preview
node src/cli.js examples/slides.md --mode slides --preview
node src/cli.js examples/flow.md --mode flow --preview
```

默认生成 HTML 到 `output/`，直接用浏览器打开即可。`--preview` 打开浏览器预览窗口，关闭窗口后退出。生成 HTML 和 SVG 不依赖浏览器；PDF 和 PNG 导出需要浏览器。

```sh
node src/cli.js examples/document.md --mode document --format pdf
node src/cli.js examples/slides.md --mode slides --format pdf
node src/cli.js examples/flow.md --mode flow --format svg
node src/cli.js examples/flow.md --mode flow --format png
node src/cli.js examples/slides.md --mode slides -o output/custom.html
node src/cli.js examples/slides.md --mode slides --language en --preview
```

可选 `npm link` 安装命令后使用 `mymd input.md --mode slides`。也可使用 `npm run mymd -- input.md --mode slides`。

## 渲染规则

| 模式 | 默认行为 | 导出 |
| --- | --- | --- |
| document | 连续阅读；保留标题、表格、列表、引用、代码高亮、图片 | HTML / A4 PDF |
| slides | 独立成行的 `***` 分隔符开始新页；标题不触发分页 | HTML / 16:9 PDF |
| flow | 标题生成节点；直属正文作为说明；灰色实线连接父子；绿色虚线箭头连接同一父节点下的相邻标题 | HTML / SVG / PNG |

使用独立成行的 `***` 分隔幻灯片（也支持 `* * *` 等星号分隔线）；`#`、`##` 等标题不触发分页。每页开头的标题作为页标题，其余标题保留在页内；代码块中的 `***` 不触发分页，`---` 和 `___` 保留为普通分隔线。连续或首尾分隔符不会产生空白页。不再提供 `--slide-level` 参数。过长正文、列表和代码按浏览器实际高度拆分为续页，不摘要或删减文字。单个超长段落可能在句中拆开；复杂表格续页暂不重复表头。图片限制在页面内。特别长的标题和复杂嵌套版式建议人工检查。

幻灯片支持总览 / 演示切换、方向键、空格和全屏；流程图支持滚轮缩放、拖动平移和适应窗口。流程图采用类似 `pstree` 的横向树形布局：父节点与第一个子节点对齐，兄弟分支从上到下排列，共享一条竖向分支线。单链直接横向展开，后续分支根据前一子树的实际高度避让；同级顺序箭头放在节点左侧。各列宽度根据内容调整，节点根据正文长度自动增高，保留所有正文；大文档会产生较大的画布，优先使用 SVG。

`--language zh-CN|en` 设置生成页面的提示语言，默认 `zh-CN`。包含演示 / 总览、全屏、上下页提示、续页、导读和空文档提示，以及流程图操作提示；不会翻译 Markdown 正文。幻灯片左下角显示输入文件名（含扩展名）和页码。

slides 模式支持 KaTeX 数学公式：`$E=mc^2$` 为行内公式，独占行的 `$$` 包围多行公式；也支持 `$$E=mc^2$$`。代码块、行内代码和转义的美元符号保留原样。公式样式和字体嵌入 HTML，离线预览与 PDF 导出均可使用；分页时不拆开公式内部结构。

```markdown
## 公式示例

勾股定理：$a^2+b^2=c^2$。

$$
\frac{a^2+b^2}{\sqrt{x}}
$$
```

标题跳级会归入最近的较浅标题；第一个标题之前的内容作为前言。多个顶级标题形成同级序列。代码块里的 `#` 不作为标题。图中的顺序箭头表示文档顺序，不推断执行分支、循环或实际函数调用。

支持 GFM 表格、任务列表、删除线和语法高亮。本地图片按输入 MD 所在目录解析，并嵌入 HTML；远程图片仍需联网。流程图正文使用原始 Markdown 文本（图片链接、代码和列表均作为文字说明），标题和正文采用不同字号及颜色。原始 HTML 作为文字显示。数学公式排版目前仅支持 slides 模式；当前不支持 Mermaid、PPTX、实时监听或图形编辑器。

## 示例与验证

- `examples/document.md`：技术设计说明，涵盖表格、代码、本地图片、引用和任务清单。
- `examples/slides.md`：迭代复盘，涵盖 `***` 分页、图表、列表和长内容续页。
- `examples/flow.md`：发布交付流程，涵盖多层标题、同级步骤与节点正文。

```sh
npm run examples
npm test
```

示例命令生成七个文件。测试检查标题语义、参数错误、跨页文本完整性、页面溢出、演示翻页及三种 HTML 的图片和脚本运行。测试截图保存在 `tmp/qa/`。

## 代码结构

- `src/render.js`：Markdown 解析、标题树、三种输出模板与浏览器交互。
- `src/cli.js`：参数解析、资源读取、浏览器导出及预览入口。
- `src/flow.js`：pstree 风格的子树尺寸计算、节点定位与 SVG 连线。
- `scripts/examples.js`：生成全部示例产物。
- `test/render.test.js`：结构与浏览器集成测试。

解析器使用 [Marked](https://marked.js.org/using_pro)，PDF 与图片导出使用 [Playwright](https://playwright.dev/docs/api/class-page#page-pdf)。

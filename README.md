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

## 配置文件

通过 `--config 文件.json`（简写 `-c`）加载 JSON 配置。所有字段均可省略；输入文件必须由配置中的 `input` 或命令行位置参数提供。例如：

```json
{
  "input": "slides.md",
  "mode": "slides",
  "format": "html",
  "output": "../output/slides.config.html",
  "language": "zh-CN",
  "preview": false
}
```

可直接使用 `examples/slides.config.json`：

```sh
node src/cli.js --config examples/slides.config.json
node src/cli.js input/presentation.md -c examples/slides.config.json --language en -o output/presentation.slides.html
node src/cli.js -c examples/slides.config.json --format pdf -o output/slides.pdf --no-preview
```

优先级为 **显式命令行参数 > 配置文件 > 默认值**，逐项覆盖。命令行的输入文件覆盖 `input`；`--preview` 开启预览，`--no-preview` 可覆盖配置中的 `"preview": true`，两者不能同时使用。

| 字段 | 类型 / 可选值 | 默认行为 |
| --- | --- | --- |
| `input` | 非空字符串 | 必须在配置或命令行中提供 |
| `mode` | `document` / `slides` / `flow` | `document` |
| `format` | `html` / `pdf` / `svg` / `png`，须符合模式支持的格式 | 从最终 `output` 扩展名推断；没有输出路径时为 `html` |
| `output` | 非空字符串 | 当前目录下的 `output/输入名.模式.格式` |
| `language` | `zh-CN` / `en` | `zh-CN` |
| `preview` | JSON 布尔值 | `false` |
| `logo` | 对象，包含 `path`、`scale`、`position` | 不显示 Logo，仅 slides 使用 |

配置中 `input` 和 `output` 的相对路径以配置文件所在目录为基准，命令行中的相对路径以当前工作目录为基准。显式设置的 `format`（包括配置中的值）优先于输出扩展名推断；修改导出类型时建议同时指定 `--format` 和 `-o`。配置文件必须是 JSON 对象，不支持注释，未知字段和错误的字段类型会报错。

### 幻灯片 Logo

在配置中添加 `logo`，会在每张幻灯片（包括自动续页）显示同一张图片，HTML 演示和 PDF 导出均支持：

```json
{
  "input": "presentation.md",
  "mode": "slides",
  "logo": {
    "path": "assets/logo.png",
    "scale": 1,
    "position": "top-right"
  }
}
```

- `path`：本地图片路径，支持 PNG、JPEG、SVG、GIF、WebP；相对路径以配置文件所在目录为基准。图片嵌入 HTML，可离线查看。
- `scale`：缩放倍率，默认 `1`，范围为大于 `0` 且不超过 `3`。基准显示区域为 120×48 像素；例如 `1.5` 为 180×72。图片保持比例、完整显示。
- `position`：`top-left`（左上）、`top-right`（右上，默认）、`bottom-left`（左下）、`bottom-right`（右下）。距左右边缘 64 像素、上下边缘 24 像素。Logo 属于固定框架，不改变正文区域或章节标注的位置；左下角 Logo 会将页脚向右移。Logo 放得过大时，可手动调整正文避免遮挡。

命令行可逐项覆盖，未指定的字段沿用配置：

```sh
node src/cli.js -c examples/slides.config.json --logo-scale 1.5 --logo-position bottom-right
node src/cli.js input/presentation.md --mode slides --logo examples/assets/logo.svg --logo-scale 0.8
```

`--logo` 的相对路径以当前工作目录为基准。省略整个 `logo` 配置且不传 Logo 参数时，不显示 Logo。示例配置使用 `examples/assets/logo.svg` 占位图片，可替换为自己的品牌图片。

## 渲染规则

| 模式 | 默认行为 | 导出 |
| --- | --- | --- |
| document | 连续阅读；保留标题、表格、列表、引用、代码高亮、图片 | HTML / A4 PDF |
| slides | 独立成行的 `***`、`---`、`___` 分隔符开始新页；标题不触发分页 | HTML / 16:9 PDF |
| flow | 标题生成节点；直属正文作为说明；灰色实线连接父子；绿色虚线箭头连接同一父节点下的相邻标题 | HTML / SVG / PNG |

使用独立成行的 Markdown 分隔线 `***`、`---`、`___` 分隔幻灯片（也支持 `* * *`、`- - -`、`_ _ _` 等形式）；`#`、`##` 等标题不触发分页。每页的标题与其他 Markdown 内容都属于正文；代码块中的分隔线不触发分页。连续或首尾分隔符不会产生空白页。不再提供 `--slide-level` 参数。未使用手动布局标记的过长正文、列表和代码按浏览器实际高度拆分为续页，不摘要或删减文字。单个超长段落可能在句中拆开；复杂表格续页暂不重复表头。图片限制在页面内。特别长的标题和复杂嵌套版式建议人工检查。

幻灯片支持总览 / 演示切换、方向键、空格和全屏；流程图支持滚轮缩放、拖动平移和适应窗口。流程图采用类似 `pstree` 的横向树形布局：父节点与第一个子节点对齐，兄弟分支从上到下排列，共享一条竖向分支线。单链直接横向展开，后续分支根据前一子树的实际高度避让；同级顺序箭头放在节点左侧。各列宽度根据内容调整，节点根据正文长度自动增高，保留所有正文；大文档会产生较大的画布，优先使用 SVG。

### 五类页面与章节状态

每页忽略空行和布局标记后的第一行决定页面类型，仅 Markdown ATX 标题（以 `#`、`##` 开头）参与分类：

| 类型 | 判定 | 默认排版和状态 |
| --- | --- | --- |
| 扉页 | 第一张以 `#` 开头的页面 | 整体垂直居中、左对齐，不计章数，不显示顶部章节标注 |
| 目录页 | 扉页及其所有自动续页结束后插入 | 仅列章标题，不改变状态，不显示顶部章节标注 |
| 章页 | 后续以 `#` 开头的页面 | 整体垂直居中、左对齐；章加一、节清零，不显示顶部章节标注 |
| 节页 | 以 `##` 开头的页面 | 顶部左对齐；当前章不变、节加一，显示章节状态 |
| 普通页 | 其余页面，包括 `###` 开头的页面 | 顶部左对齐；继承当前章和节，不自动添加“导读”标题 |

页内其他位置出现的标题不改变状态，代码块、引用内标题和 Setext 标题不参与分类。遇到新章时同时清空上一节的名称；自动续页继承原页类型和状态，不重复计数。章前的节使用独立节编号。没有扉页时不自动插入目录；空文档不生成目录。

### 固定框架与手动正文布局

每页分为固定框架和正文。框架包含章节标注、Logo、文件名和页码；正文包含 Markdown 的全部内容，**包括页首标题**。移动正文不会移动框架。续页不重复正文标题，续页编号显示在页脚。

基准画布为 1280×720 像素，正文区域固定为左侧 64、顶部 76、宽 1152、高 564 像素。演示缩放只缩放整个画布，不改变布局单位的含义。扉页和章页默认将整段正文在该区域中垂直居中。

使用独立成行的 HTML 注释调整一页的全部正文；这些标记不会显示在页面上：

```markdown
<!-- slide: x=20px y=10% -->

## 本节标题

第一段内容。

<!-- gap: 24px -->

第二段内容。

<!-- /slide -->

***

这一页是普通页，不继承上一页的偏移。
```

- `x` 正数向右、负数向左；`y` 正数向下、负数向上，均是相对于该页默认布局的偏移。
- 支持 `px` 和 `%`；省略单位时按像素处理。`x=5%` 等于正文区域宽度的 5%，`y=5%` 等于正文区域高度的 5%，与正文长度无关。
- 开头和结尾标记须配对，位于同一页的开头、结尾。`x`、`y` 可省略，默认为 0。标记每页独立，不跨 `***` 继承。
- `<!-- gap: 24px -->` 在正文当前位置插入 24 像素空白；也支持百分比（以正文区域高度计算），不允许负值。它可以单独使用，不要求外层 `slide` 标记。多次插入会累加，替代 Markdown 会忽略的连续空行。
- 在代码块、行内代码、引用、列表内部写这些标记，不会操作整页布局。请把控制标记单独放在顶层。
- 不使用布局标记的页继续自动续页。使用 `slide` 或 `gap` 的页视为手动排版，保留在一页，不自动拆分。
- 手动正文超出正文区域或遮挡框架时，HTML 在该页显示溢出提示，正文不会被自动删改；调整偏移、间距或用 `***` 拆页即可。PDF 导出遇到这类问题会报出页码并停止导出，避免生成被截断的成品。

完整示例见 `examples/layout.md`：`node src/cli.js examples/layout.md --mode slides`。

`--language zh-CN|en` 设置生成页面的提示语言，默认 `zh-CN`。包含演示 / 总览、全屏、上下页提示、续页和空文档提示，以及流程图操作提示；不会翻译 Markdown 正文。幻灯片左下角显示输入文件名（含扩展名）和页码。

slides 模式支持 KaTeX 数学公式：`$E=mc^2$` 为行内公式，独占行的 `$$` 包围多行公式；也支持 `$$E=mc^2$$`。代码块、行内代码和转义的美元符号保留原样。公式样式和字体嵌入 HTML，离线预览与 PDF 导出均可使用；分页时不拆开公式内部结构。

document 和 slides 模式支持 Mermaid。使用 `mermaid` 围栏代码块编写流程图、时序图、XY 折线图等，输出 HTML 会内嵌 Mermaid 运行时并生成 SVG，不依赖 CDN；PDF 导出会等待图形渲染完成，幻灯片分页不会拆开图形。默认主题针对白色背景使用深青、蓝、橙等高对比配色；单个图可以通过 Mermaid frontmatter 的 `config.themeVariables` 覆盖。flow 模式仍用于展示文档自身的标题层级。

```markdown
## 公式示例

勾股定理：$a^2+b^2=c^2$。

$$
\frac{a^2+b^2}{\sqrt{x}}
$$
```

标题跳级会归入最近的较浅标题；第一个标题之前的内容作为前言。多个顶级标题形成同级序列。代码块里的 `#` 不作为标题。图中的顺序箭头表示文档顺序，不推断执行分支、循环或实际函数调用。

支持 GFM 表格、任务列表、删除线、语法高亮和 Mermaid。本地图片按输入 MD 所在目录解析，并嵌入 HTML；远程图片仍需联网。流程图正文使用原始 Markdown 文本（图片链接、代码和列表均作为文字说明），标题和正文采用不同字号及颜色。支持 Typora 的 HTML `<img>` 图片及其 `zoom`、`width`、`height` 缩放设置，本地图片同样嵌入输出；其他 HTML 作为文字显示。数学公式排版目前仅支持 slides 模式；当前不支持 PPTX、实时监听或图形编辑器。

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

- `src/render.js`：Markdown 解析、标题树与通用输出模板。
- `src/slides.js`：五类幻灯片、章节状态、手动布局、自动续页与演示交互。
- `src/cli.js`：参数解析、资源读取、浏览器导出及预览入口。
- `src/config.js`：JSON 配置读取、命令行覆盖与路径解析。
- `src/flow.js`：pstree 风格的子树尺寸计算、节点定位与 SVG 连线。
- `scripts/examples.js`：生成全部示例产物。
- `test/render.test.js`：结构与浏览器集成测试。

解析器使用 [Marked](https://marked.js.org/using_pro)，PDF 与图片导出使用 [Playwright](https://playwright.dev/docs/api/class-page#page-pdf)。

# mymd

`mymd` 把一份本地 Markdown 渲染为阅读文档、幻灯片或标题结构图。内容不会经过 AI 改写，生成结果默认写入 `output/`。

| 模式 | 用途 | 输出格式 |
| --- | --- | --- |
| `document` | 连续阅读文档 | HTML、A4 PDF |
| `slides` | 16:9 幻灯片 | HTML、PDF |
| `flow` | 按标题层级生成横向结构图 | HTML、SVG、PNG |

## 安装与使用

需要 Node.js 22 或更高版本。

```sh
npm install
npx playwright install chromium
```

生成 HTML 不需要浏览器；导出 PDF、PNG 和使用 `--preview` 时需要 Chromium 系浏览器。Windows 上如果已安装 Microsoft Edge，通常无需额外下载 Chromium。也可以把 `MYMD_BROWSER` 设置为浏览器可执行文件路径。

```sh
# 生成 HTML
node src/cli.js examples/document.md --mode document
node src/cli.js examples/slides.md --mode slides
node src/cli.js examples/flow.md --mode flow

# 预览或导出
node src/cli.js examples/slides.md --mode slides --preview
node src/cli.js examples/slides.md --mode slides --format pdf
node src/cli.js examples/flow.md --mode flow --format svg
node src/cli.js examples/flow.md --mode flow --format png

# 指定输出文件和界面语言
node src/cli.js examples/slides.md --mode slides -o output/demo.html
node src/cli.js examples/slides.md --mode slides --language en --preview
```

`--preview` 会打开预览窗口，关闭窗口后命令退出。通过 `npm link` 安装后可以使用 `mymd ...`；不安装全局命令时也可以使用 `npm run mymd -- ...`。

## slides 模式语法

### 最小示例

```markdown
# 产品方案

作者 · 日期

***

# 背景

这一页开始第一章。

***

## 用户问题

- 问题一
- 问题二

***

这是补充页，继承当前章和节。
```

这段 Markdown 会得到：扉页、自动目录、章页、节页和普通页。`#`、`##` 只决定页面类型和章节状态，真正的分页符是水平分隔线。

### 1. 分页

使用一条独立成行的 Markdown 水平分隔线开始下一张幻灯片：

```markdown
第一页

***

第二页

---

第三页

___

第四页
```

支持 Markdown 允许的同类写法，例如 `* * *`、`- - -`、`_ _ _`。建议在分页符前后各留一个空行，并优先使用 `***`；紧接普通文本的 `---` 可能被 Markdown 解释为 Setext 标题下划线，而不是分页符。

分页规则如下：

- 所有被解析为水平分隔线的内容都会成为分页符，不会在幻灯片中显示 `<hr>`。
- `#`、`##` 等标题不会自行分页；一页中可以有多个标题。
- 围栏代码块中的 `***`、`---`、`___` 是代码内容，不会分页。
- 文档开头、结尾或连续出现的分页符不会产生空白页。
- 链接引用定义可以放在任意页，仍可供其他页面引用。

### 2. 页面类型与章节编号

每个 Markdown 页面去掉空行、链接定义和布局标记后，第一个内容块决定页面类型。只有 ATX 标题 `# 标题` 和 `## 标题` 参与分类；Setext 标题、引用或代码块里的标题不参与分类。

| 页面类型 | 页首语法 | 行为 |
| --- | --- | --- |
| 扉页 | 整份文档中第一个以 `#` 开头的页面 | 正文垂直居中；不计入章编号；不显示顶部章节标注 |
| 目录页 | 自动生成 | 插在扉页及其自动续页之后；只列后续章标题 |
| 章页 | 扉页之后，页首为 `#` | 章编号加一，节编号清零；正文垂直居中；不显示顶部章节标注 |
| 节页 | 页首为 `##` | 当前章不变，节编号加一；显示章/节标注 |
| 普通页 | 其他情况，包括页首 `###` | 继承当前章和节；不自动补标题 |

例如：

```markdown
# 演示标题

这是扉页。

***

# 第一部分

这是第 1 章。

***

## 背景

这是第 1.1 节。

***

补充数据

## 页内标题

这一页仍继承第 1.1 节；页内的二级标题不会新建一节。

***

# 第二部分

这是第 2 章，节编号已清零。
```

需要注意：

- 自动目录只列章页，也就是扉页之后以 `#` 开头的页面；不会列 `##` 节页。
- 没有扉页时不生成目录。空文档只生成一张“空文档”页。
- 如果节页出现在第一个章页之前，它会使用独立节编号，如“第 1 节”。
- 新章会清除上一节的名称。自动续页继承原页面类型和章节状态，不重复计数。
- 页首标题也是正文的一部分，会正常显示；分类不会删除或改写标题。

### 3. 自动续页

普通页面内容超过正文区域时会按浏览器测得的实际高度自动拆成续页。原文不会被摘要或丢弃，续页会继承章节状态，并在页脚显示“续页 1”“续页 2”等标记。

自动分页会尽量保持标题和紧随其后的内容在一起，并且不会拆开图片、KaTeX 公式或 Mermaid 图。仍有以下边界：

- 很长的普通段落可能在句中拆开。
- 列表和代码可以跨页。
- 复杂表格跨页时不会重复表头。
- 单个无法拆分且高于正文区域的内容会报错；图片会先限制到页面内。
- 特别长的标题、复杂嵌套列表和大型图表应在导出前人工预览。

### 4. 手动正文布局

画布固定为 1280×720 像素。正文区域位于 `left: 64px; top: 76px`，宽 1152 像素、高 564 像素。页头章节标注、Logo、文件名和页码属于固定框架；下面的布局指令只移动正文，不移动框架。

使用独立成行的 HTML 注释移动一整页正文：

```markdown
<!-- slide: x=20px y=-10% -->

## 调整后的位置

这一页的全部正文向右移动 20px，并向上移动正文区域高度的 10%。

<!-- gap: 24px -->

这一段前额外留出 24px。

<!-- /slide -->
```

布局指令的语法是：

```text
<!-- slide: [x=<长度>] [y=<长度>] -->
<!-- gap: <非负长度> -->
<!-- /slide -->
```

长度支持 `px`、`%` 或无单位数字。无单位按像素处理；允许小数：

- `x`：相对默认位置水平移动，正数向右，负数向左；百分比相对正文区域宽度。
- `y`：相对默认位置垂直移动，正数向下，负数向上；百分比相对正文区域高度。
- `gap`：在当前位置插入纵向空白，百分比相对正文区域高度；不能为负数。

结构限制：

- `<!-- slide: ... -->` 必须是该页第一个标记，每页最多一次。
- `<!-- /slide -->` 必须与开头标记配对，并且是该页最后一个标记。
- `x`、`y` 都可以省略，默认值为 `0px`，但不能重复或使用其他选项。
- `<!-- gap: ... -->` 可以出现多次，也可以不包在 `slide` 标记中使用。
- 指令必须作为顶层块独立成行；写在代码块、行内代码、引用或列表里只会作为普通内容处理。
- 布局只对当前 Markdown 页面有效，不跨分页符继承。

只要一页使用了 `slide` 或 `gap` 指令，就会进入手动布局模式，不再自动拆成续页。内容超出正文区域或遮挡固定框架时，HTML 会显示警告；PDF 导出会报告成品页码和 Markdown 页码并停止。此时应减小偏移或间距，或者用 `***` 手动拆页。

完整示例见 [`examples/layout.md`](examples/layout.md)。

### 5. Markdown、公式、图表和图片

slides 模式支持 GFM 表格、任务列表、删除线、引用、链接、围栏代码块和语法高亮。

KaTeX 公式只在 slides 模式启用：

```markdown
行内公式：$E=mc^2$。

$$
\frac{a^2+b^2}{\sqrt{x}}
$$
```

也可以写成独占一行的 `$$E=mc^2$$`。代码块、行内代码和转义的美元符号不会被当作公式。KaTeX 样式与字体会嵌入 HTML，可离线使用。

Mermaid 在 document 和 slides 模式中可用：

````markdown
```mermaid
flowchart LR
  A[输入] --> B[处理]
  B --> C[输出]
```
````

Mermaid 运行时会嵌入 HTML，不依赖 CDN；PDF 导出会等待图形渲染完成。`flow` 模式与 Mermaid 不同，它用于展示 Markdown 文档自身的标题层级。

图片有两种写法：

```markdown
![说明](assets/chart.png)

<img src="assets/chart.svg" width="480" alt="说明">
```

- 本地路径相对于输入 Markdown 文件解析，并以内嵌数据形式写入输出文件。
- 支持 PNG、JPEG、SVG、GIF 和 WebP；远程图片需要联网。
- 支持 Typora `<img>` 的 `width`、`height` 和 `style="zoom:..."` 缩放写法。
- 其他原始 HTML 会作为文本显示，不会直接注入输出页面。

### 6. 演示操作与固定框架

生成的 HTML 默认显示总览。点击“演示 / 总览”进入单页演示：

| 操作 | 效果 |
| --- | --- |
| `→`、`PageDown`、空格 | 下一页 |
| `←`、`PageUp` | 上一页 |
| `Esc` | 退出单页演示 |
| “全屏”按钮 | 进入或退出浏览器全屏 |

每页左下角显示“输入文件名 / 当前页 / 总页数”。`--language zh-CN|en` 只切换界面、目录、续页和错误提示，不翻译 Markdown 正文。

## Logo

Logo 只用于 slides 模式。可以在 JSON 配置中设置：

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

| 字段 | 规则 |
| --- | --- |
| `path` | PNG、JPEG、SVG、GIF 或 WebP；配置中的相对路径以配置文件目录为基准 |
| `scale` | 大于 `0` 且不超过 `3`，默认 `1`；基准显示区域为 120×48 像素 |
| `position` | `top-left`、`top-right`、`bottom-left`、`bottom-right`，默认 `top-right` |

Logo 距左右边缘 64 像素、上下边缘 24 像素，保持比例完整显示，不改变正文区域。左下角 Logo 会把页脚向右移动；Logo 过大仍可能遮挡正文，应在预览中检查。

命令行可以逐项覆盖配置：

```sh
node src/cli.js -c examples/slides.config.json --logo-scale 1.5 --logo-position bottom-right
node src/cli.js input/presentation.md --mode slides --logo examples/assets/logo.svg --logo-scale 0.8
```

命令行 `--logo` 的相对路径以当前工作目录为基准。未配置 `logo` 且未传 Logo 参数时不显示 Logo。

## JSON 配置

通过 `--config` 或 `-c` 加载配置：

```json
{
  "input": "slides.md",
  "mode": "slides",
  "format": "html",
  "output": "../output/slides.html",
  "language": "zh-CN",
  "preview": false
}
```

```sh
node src/cli.js --config examples/slides.config.json
node src/cli.js input/presentation.md -c examples/slides.config.json --language en -o output/presentation.html
node src/cli.js -c examples/slides.config.json --format pdf -o output/slides.pdf --no-preview
```

优先级是：显式命令行参数 > 配置文件 > 默认值。命令行输入文件覆盖 `input`；`--preview` 开启预览，`--no-preview` 可以覆盖配置中的 `"preview": true`，两者不能同时使用。

| 字段 | 类型或可选值 | 默认值或行为 |
| --- | --- | --- |
| `input` | 非空字符串 | 必填，可改由命令行位置参数提供 |
| `mode` | `document`、`slides`、`flow` | `document` |
| `format` | `html`、`pdf`、`svg`、`png` | 从最终 `output` 扩展名推断；无输出路径时为 `html` |
| `output` | 非空字符串 | `output/输入名.模式.格式` |
| `language` | `zh-CN`、`en` | `zh-CN` |
| `preview` | JSON 布尔值 | `false` |
| `logo` | 见上一节 | 不显示 |

配置中的 `input`、`output` 和 `logo.path` 相对于配置文件目录解析；命令行路径相对于当前工作目录解析。显式 `format` 优先于输出扩展名推断，切换格式时建议同时指定 `--format` 和 `-o`。配置文件必须是 JSON 对象，不支持注释、未知字段或错误的字段类型。

## document 与 flow 模式

`document` 保留 Markdown 的标题、表格、列表、引用、代码高亮、图片和 Mermaid，生成连续 HTML 或 A4 PDF。

`flow` 把标题变成节点，直属正文作为说明。父子节点使用灰色实线，同一父节点下相邻标题使用绿色虚线箭头表示文档顺序。标题跳级会归入最近的较浅标题；第一个标题之前的内容作为前言。图只表达文档结构，不推断业务分支、循环或函数调用。大文档会生成较大画布，优先使用 SVG。

## 示例、测试与代码结构

- [`examples/document.md`](examples/document.md)：表格、代码、本地图片、引用和任务列表。
- [`examples/slides.md`](examples/slides.md)：分页、章节、图表、列表和自动续页。
- [`examples/layout.md`](examples/layout.md)：五类页面、正文偏移和间距指令。
- [`examples/flow.md`](examples/flow.md)：多层标题、同级步骤和节点正文。

```sh
npm run examples
npm test
```

主要文件：

- `src/cli.js`：参数解析、资源读取、浏览器导出和预览入口。
- `src/render.js`：Markdown 解析、通用 HTML 模板、KaTeX 和 Mermaid。
- `src/slides.js`：页面分类、章节状态、布局、自动续页和演示交互。
- `src/flow.js`：结构图节点、布局和 SVG 连线。
- `src/config.js`：JSON 配置、命令行覆盖和路径解析。

Markdown 使用 [Marked](https://marked.js.org/)，PDF 与 PNG 导出使用 [Playwright](https://playwright.dev/docs/api/class-page#page-pdf)。当前不支持 PPTX、实时监听或图形编辑器。

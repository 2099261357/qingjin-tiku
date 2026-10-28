# 试卷收件箱

## 最简单的用法（推荐）

把**新试卷**放进这个文件夹，然后**双击项目根目录的「更新试卷库.bat」**。
它会自动 OCR、去重，并追加到 `static/papers.txt`（网站的试卷库）。

## 或者用命令行

```bash
python tools/add_papers.py
```

- 支持格式：**PDF、图片（png / jpg / jpeg / webp / bmp）**
- 会自动跳过已经收录过的试卷（按文件名判断）
- 处理完后建议**删除这个文件夹里的原始试卷**（节省空间，也避免版权文件被误传）

## 首次使用需要安装依赖

```bash
pip install pymupdf rapidocr_onnxruntime
```

## 更新到网站

1. 运行工具，确认 `static/papers.txt` 变大了
2. 重新打包 `static/`（或把整个 `static` 文件夹拖到 Netlify）
3. 网站上的「出模拟卷 / 举一反三」就会参考新试卷

> 提示：也可以把试卷直接发给我，我帮你识别并更新。

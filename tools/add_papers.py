# -*- coding: utf-8 -*-
"""
青衿题库 · 试卷库维护工具
=========================
把新试卷（PDF / 图片）OCR 后，自动去重、追加到 static/papers.txt。

用法：
    1. 把新的试卷文件放进 papers_inbox/ 文件夹
    2. 运行：python tools/add_papers.py
    3. 完成后重新打包 static/ 并部署到 Netlify 即可

依赖（首次使用请安装一次）：
    pip install pymupdf rapidocr_onnxruntime

也可以指定其它文件夹：
    python tools/add_papers.py path/to/folder
"""
import os
import sys
import glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAPERS_TXT = os.path.join(ROOT, "static", "papers.txt")
DEFAULT_INBOX = os.path.join(ROOT, "papers_inbox")

SUPPORTED_EXTS = (".pdf", ".png", ".jpg", ".jpeg", ".webp", ".bmp")

_OCR = None


def get_ocr():
    global _OCR
    if _OCR is None:
        from rapidocr_onnxruntime import RapidOCR
        _OCR = RapidOCR()
    return _OCR


def load_existing():
    if os.path.exists(PAPERS_TXT):
        with open(PAPERS_TXT, encoding="utf-8") as f:
            return f.read()
    return ""


def ocr_img(path):
    ocr = get_ocr()
    result, _ = ocr(path)
    return "\n".join(x[1] for x in (result or []))


def pages_of(path):
    """返回 [(页码, 图片路径)]；PDF 先渲染成图片。"""
    import tempfile
    if path.lower().endswith(".pdf"):
        import pymupdf
        doc = pymupdf.open(path)
        out = []
        for i, page in enumerate(doc):
            pix = page.get_pixmap(dpi=200)
            tmp = os.path.join(tempfile.gettempdir(), "qj_paper_%d.png" % i)
            pix.save(tmp)
            out.append((i + 1, tmp))
        doc.close()
        return out
    return [(1, path)]


def main():
    inbox = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_INBOX
    if not os.path.isdir(inbox):
        print("找不到文件夹:", inbox)
        sys.exit(1)

    existing = load_existing()
    files = []
    for ext in SUPPORTED_EXTS:
        files += glob.glob(os.path.join(inbox, "**", "*" + ext), recursive=True)
    files = sorted(set(files))

    if not files:
        print("文件夹里没有可处理的试卷:", inbox)
        print("支持格式:", " ".join(SUPPORTED_EXTS))
        return

    print("待处理文件:", len(files))
    added = 0
    for path in files:
        name = os.path.splitext(os.path.basename(path))[0]
        if name in existing:
            print("跳过（已存在）:", name)
            continue
        print("处理:", name)
        try:
            parts = []
            for idx, img in pages_of(path):
                print("  第 %d 页 OCR..." % idx)
                parts.append(ocr_img(img))
            body = "\n".join(parts).strip()
        except Exception as e:
            print("  失败:", e)
            continue
        if not body:
            print("  未识别到内容，跳过")
            continue
        entry = "【新增试卷】来源：%s\n%s" % (name, body)
        with open(PAPERS_TXT, "a", encoding="utf-8") as f:
            f.write("\n\n" + entry)
        existing += "\n" + name
        added += 1
        print("  已追加")

    print()
    if added:
        print("完成！新增 %d 份试卷到 %s" % (added, PAPERS_TXT))
        print("下一步：重新打包 static/ 并部署到 Netlify。")
    else:
        print("没有新增试卷。")


if __name__ == "__main__":
    main()

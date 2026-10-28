/* 青衿题库 · 前端交互
 * BYOK：用户在浏览器填写自己的 API Key（存 localStorage），
 * 前端把 Key 放在 Authorization 头里，直接请求模型提供商（BYOK 浏览器直连）。
 * 未设置 Key 时进入「演示模式」（不联网、不花钱）。
 */
(function () {
  "use strict";

  // ---------- 站点主人预配置（来自 config.js） ----------
  var SITE = window.QJ_SITE_CONFIG || {};

  // ---------- 配置存取 ----------
  var LS = { key: "qj_key", base: "qj_base", model: "qj_model", style: "qj_style", vkey: "qj_vkey", vbase: "qj_vbase", vmodel: "qj_vmodel" };
  var DEFAULTS = { key: "", base: "https://api.deepseek.com", model: "deepseek-chat", style: "", vkey: "", vbase: "", vmodel: "" };

  function getConfig() {
    return {
      key: localStorage.getItem(LS.key) || DEFAULTS.key,
      base: localStorage.getItem(LS.base) || DEFAULTS.base,
      model: localStorage.getItem(LS.model) || DEFAULTS.model,
      style: localStorage.getItem(LS.style) || DEFAULTS.style,
      vkey: localStorage.getItem(LS.vkey) || DEFAULTS.vkey,
      vbase: localStorage.getItem(LS.vbase) || DEFAULTS.vbase,
      vmodel: localStorage.getItem(LS.vmodel) || DEFAULTS.vmodel,
    };
  }
  function setConfig(cfg) {
    localStorage.setItem(LS.key, cfg.key);
    localStorage.setItem(LS.base, cfg.base);
    localStorage.setItem(LS.model, cfg.model);
    localStorage.setItem(LS.style, cfg.style);
    localStorage.setItem(LS.vkey, cfg.vkey);
    localStorage.setItem(LS.vbase, cfg.vbase);
    localStorage.setItem(LS.vmodel, cfg.vmodel);
  }

  // 站点试卷库（来自 static/papers.txt，所有用户共享）
  var SITE_PAPERS = "";
  function loadPapers() {
    fetch("papers.txt").then(function (r) { return r.ok ? r.text() : ""; }).then(function (t) {
      SITE_PAPERS = (t || "").split("\n").filter(function (line) { return !/^\s*#/.test(line); }).join("\n").trim();
    }).catch(function () {});
  }

  // 风格参考 = 站点试卷库 + config.js 的 paperBank + 用户自己粘贴的 styleRef
  function getStyleRef() {
    var parts = [];
    if (SITE_PAPERS) parts.push(SITE_PAPERS);
    if (SITE.paperBank) parts.push(SITE.paperBank);
    var s = getConfig().style;
    if (s) parts.push(s);
    return parts.join("\n\n");
  }

  // ---------- 工具 ----------
  function $(id) { return document.getElementById(id); }

  function toast(msg, isErr) {
    var t = $("toast");
    t.textContent = msg;
    t.className = "toast show" + (isErr ? " error" : "");
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.className = "toast"; }, 2800);
  }

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // ---------- Markdown → HTML（轻量，避免破坏 LaTeX 的 $ 与 _） ----------
  function renderMarkdown(md) {
    if (!md) return "";
    var codeBlocks = [], mathBlocks = [];

    // 1) 提取代码块与独立公式块（保护它们不被后续处理破坏）
    md = md.replace(/```[^\n]*\n?([\s\S]*?)```/g, function (m, code) {
      codeBlocks.push(code);
      return "\u0000CB" + (codeBlocks.length - 1) + "\u0000";
    });
    md = md.replace(/\$\$([\s\S]*?)\$\$/g, function (m, math) {
      mathBlocks.push(math);
      return "\u0000M" + (mathBlocks.length - 1) + "\u0000";
    });

    // 2) 转义 HTML
    var html = escapeHtml(md);

    // 3) 行内代码
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

    // 4) 标题
    html = html.replace(/^#{1,6}[ \t]+(.+)$/gm, function (m, t) {
      var lv = (m.match(/^#+/) || [""])[0].length;
      return "<h" + lv + ">" + t + "</h" + lv + ">";
    });

    // 5) 粗体 / 斜体（只用 *，不用 _，避免误伤 LaTeX 下标）
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");

    // 6) 引用
    html = html.replace(/^&gt;[ \t]?(.*)$/gm, "<blockquote>$1</blockquote>");

    // 7) 列表 → <li>，再把连续的 <li> 行包进 <ul>
    html = html.replace(/^[ \t]*[-*+][ \t]+(.+)$/gm, "<li>$1</li>");
    html = html.replace(/^[ \t]*\d+\.[ \t]+(.+)$/gm, "<li>$1</li>");
    var lines = html.split("\n"), out = [], run = [];
    function flush() { if (run.length) { out.push("<ul>" + run.join("") + "</ul>"); run = []; } }
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i], t = line.trim();
      if (/^<li>/.test(t)) { run.push(t); } else { flush(); out.push(line); }
    }
    flush();
    html = out.join("\n");

    // 8) 段落与换行
    html = html.replace(/\n{2,}/g, "\n</p><p>\n");
    html = html.replace(/\n/g, "<br>\n");
    html = "<p>" + html + "</p>";

    // 9) 还原代码块与公式块
    html = html.replace(/\u0000CB(\d+)\u0000/g, function (m, i) {
      return "<pre><code>" + escapeHtml(codeBlocks[+i]) + "</code></pre>";
    });
    html = html.replace(/\u0000M(\d+)\u0000/g, function (m, i) {
      return "$$" + escapeHtml(mathBlocks[+i]) + "$$";
    });

    // 10) 清理块级元素周围多余的 <p> 与 <br>
    html = html.replace(/<p><pre>/g, "<pre>").replace(/<\/pre><\/p>/g, "</pre>");
    html = html.replace(/<p>(\$\$)/g, "$1").replace(/(\$\$)<\/p>/g, "$1");
    html = html.replace(/(<br\s?\/?>\s*)+(?=<pre>|\$\$)/g, "");
    html = html.replace(/(?<=<\/pre>|\$\$)(\s*<br\s?\/?>)+/g, "");
    html = html.replace(/<p>\s*<\/p>/g, "");
    return html;
  }

  // ---------- MathJax 排版 ----------
  function typeset(el) {
    var MJ = window.MathJax;
    if (!MJ) return;
    if (MJ.typesetPromise) {
      MJ.typesetPromise([el]).catch(function () {});
      return;
    }
    // MathJax 尚未加载完成，轮询等待
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (window.MathJax && window.MathJax.typesetPromise) {
        clearInterval(iv);
        window.MathJax.typesetPromise([el]).catch(function () {});
      } else if (tries > 100) {
        clearInterval(iv);
      }
    }, 200);
  }

  // ---------- 演示模式占位输出 ----------
  function buildDemo(kind, messages) {
    var user = (messages && messages[messages.length - 1] && messages[messages.length - 1].content) || "";
    var q = (user || "").split("\n").filter(function (s) { return s.trim(); })[0] || "";
    q = q.length > 100 ? q.slice(0, 100) + "…" : q;

    var note = "> ⚠️ **演示模式**：当前未设置 API Key，以下为占位示例（未真正调用 AI）。\n\n";
    if (kind === "solve") {
      return note +
        "## 思路分析（示例）\n先识别考点与切入点，再选择合适的方法……\n\n" +
        "## 详细解答（示例）\n1. 写出关键公式；\n2. 代入、化简；\n3. 得出结果并检验。\n\n" +
        "**题目**：" + q + "\n\n" +
        "> 设置真实 API Key 后，这里会返回完整的思路分析、分步解答、一题多解、易错提醒与思维拓展。";
    }
    if (kind === "variant") {
      return note +
        "## 基础变式（示例）\n**变式 1**：改动数字后……\n\n## 创新变式（示例）\n**变式 2**：改变条件、跨知识点综合……\n\n" +
        "**原题**：" + q + "\n\n" +
        "> 设置真实 API Key 后，会生成基础变式 + 创新变式，并标注每题的思维点与解答。";
    }
    if (kind === "exam") {
      return note +
        "## 模拟卷（示例）\n\n一、选择题（5 题）\n1. ……\n\n二、填空题（5 题）\n……\n\n三、综合创新题（2 题）\n……\n\n" +
        "> 设置真实 API Key 后，会生成完整试卷，并含「综合创新题」板块。";
    }
    if (kind === "deep") {
      return note +
        "## 概念本质（示例）\n讲清这个知识点为什么成立、直觉是什么……\n\n" +
        "## 多角度思考（示例）\n从几何、代数、物理图像等不同视角重新审视……\n\n" +
        "## 创新拓展（示例）\n推广到更一般情形、提出开放问题、联系实际应用……\n\n" +
        "**题目 / 主题**：" + q + "\n\n" +
        "> 设置真实 API Key 后，会返回概念本质、多角度思考、创新拓展与知识脉络。";
    }
    return note + q;
  }

  // ---------- 调用模型 ----------
  async function callModel(messages, kind) {
    var cfg = getConfig();
    var key = SITE.textKey || cfg.key;
    if (!key) {
      return { demo: true, content: buildDemo(kind, messages) };
    }
    var model = SITE.textModel || cfg.model;
    var body = { model: model, messages: messages, temperature: 0.3, stream: false };
    var endpoint = (SITE.textBaseUrl || cfg.base || "https://api.deepseek.com").replace(/\/+$/, "") + "/chat/completions";
    var res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + key,
      },
      body: JSON.stringify(body),
    });
    var data = null;
    try { data = await res.json(); } catch (e) { /* ignore */ }
    if (!res.ok) {
      var m = (data && data.error && data.error.message) || ("请求失败（HTTP " + res.status + "）");
      throw new Error(m);
    }
    var content = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
    if (!content) throw new Error("模型未返回内容");
    return { demo: false, content: content };
  }

  // ---------- 执行一个动作 ----------
  async function runAction(opts) {
    var btn = opts.btn, output = opts.output, copyBtn = opts.copy;
    var original = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>思考中…';
    output.innerHTML = '<p class="placeholder">正在生成，请稍候…</p>';
    if (copyBtn) copyBtn.disabled = true;
    try {
      var r = await callModel(opts.messages, opts.kind);
      output.innerHTML = renderMarkdown(r.content);
      typeset(output);
      if (copyBtn) copyBtn.disabled = false;
      askMessages = opts.messages.concat([{ role: "assistant", content: r.content }]);
      if (r.demo) toast(opts.demoNote || "演示模式：未设置 API Key，以下为示例输出");
    } catch (e) {
      output.innerHTML = '<p class="placeholder">出错了：' + escapeHtml(e.message || String(e)) + "</p>";
      toast(e.message || "出错了", true);
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  // ---------- 继续追问 ----------
  var askMessages = [];
  var askBusy = false;

  function openAsk() {
    if (!askMessages.length) { toast("先让 AI 解答一道题，再来追问", true); return; }
    renderAskHistory();
    $("askModal").classList.add("show");
    setTimeout(function () { $("askInput").focus(); }, 50);
  }

  function closeAsk() {
    $("askModal").classList.remove("show");
  }

  function renderAskHistory() {
    var box = $("askHistory");
    if (!box) return;
    var html = "";
    var firstAssistant = true;
    for (var i = 0; i < askMessages.length; i++) {
      var m = askMessages[i];
      if (m.role === "system") continue;
      if (m.role === "user" && i === 1) continue; // 跳过首轮的完整提示词
      if (m.role === "assistant" && firstAssistant) {
        firstAssistant = false;
        html += '<div class="ask-label">上一轮解答</div>';
      }
      if (m.role === "user") {
        html += '<div class="ask-msg user"><div class="ask-bubble">' + escapeHtml(m.content) + "</div></div>";
      } else {
        html += '<div class="ask-msg ai"><div class="ask-bubble">' + renderMarkdown(m.content) + "</div></div>";
      }
    }
    box.innerHTML = html;
    typeset(box);
    box.scrollTop = box.scrollHeight;
  }

  async function sendAsk() {
    var input = $("askInput");
    var text = input.value.trim();
    if (!text || askBusy) return;
    if (!askMessages.length) { toast("先让 AI 解答一道题，再来追问", true); return; }
    askMessages.push({ role: "user", content: text });
    input.value = "";
    askBusy = true;
    $("askSend").disabled = true;
    renderAskHistory();
    var box = $("askHistory");
    box.innerHTML += '<div class="ask-msg ai"><div class="ask-bubble" id="askThinking">思考中…</div></div>';
    box.scrollTop = box.scrollHeight;
    try {
      var r = await callModel(askMessages, "solve");
      askMessages.push({ role: "assistant", content: r.content });
      renderAskHistory();
    } catch (e) {
      askMessages.pop();
      input.value = text;
      renderAskHistory();
      toast(e.message || "追问失败", true);
    } finally {
      askBusy = false;
      $("askSend").disabled = false;
    }
  }

  function activeValue(boxId) {
    var c = $(boxId).querySelector(".chip.active");
    return c ? (c.getAttribute("data-subject") || c.getAttribute("data-level") || "") : "";
  }

  // ---------- 复制 ----------
  function bindCopy(btnId, outputId) {
    $(btnId).addEventListener("click", async function () {
      var el = $(outputId);
      var text = el.innerText || el.textContent || "";
      if (!text.trim() || this.disabled) return;
      try {
        await navigator.clipboard.writeText(text);
        toast("已复制");
      } catch (e) {
        toast("复制失败，请手动全选", true);
      }
    });
  }

  // ---------- 留言反馈 ----------
  function renderMsg(e) {
    var nick = escapeHtml(e.nickname || "匿名");
    var time = escapeHtml(e.time || "");
    var body = renderMarkdown(e.content || "");
    return '<div class="msg">' +
      '<div class="msg-head"><span class="msg-nick">' + nick + '</span><span class="msg-time">' + time + '</span></div>' +
      '<div class="msg-body">' + body + '</div>' +
      '</div>';
  }

  function loadFeedback() {
    var list = $("fbList");
    if (!list) return;
    list.innerHTML = '<p class="placeholder">加载中…</p>';
    fetch("/api/feedback?limit=100")
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var entries = (d && d.entries) || [];
        if (!entries.length) { list.innerHTML = '<p class="placeholder">暂无留言，来抢沙发吧。</p>'; return; }
        list.innerHTML = entries.map(renderMsg).join("");
        typeset(list);
      })
      .catch(function () { list.innerHTML = '<p class="placeholder">留言功能需要后端支持；纯静态部署时暂时不可用。</p>'; });
  }

  // ---------- 拍照识别 ----------
  var currentImageDataUrl = null;

  function setImage(dataUrl) {
    currentImageDataUrl = dataUrl;
    $("previewWrap").hidden = false;
    $("previewImg").src = dataUrl;
    $("uploadZone").querySelector(".upload-inner").style.display = "none";
  }

  function resizeImage(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var MAX = 1024, w = img.width, h = img.height;
          if (Math.max(w, h) > MAX) {
            var s = MAX / Math.max(w, h);
            w = Math.round(w * s); h = Math.round(h * s);
          }
          var canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.72));
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function handleImageFile(file) {
    if (!file || (file.type && file.type.indexOf("image") !== 0)) {
      toast("请选择图片文件", true); return;
    }
    resizeImage(file).then(function (dataUrl) {
      setImage(dataUrl);
      $("ocrText").value = "";
      toast("图片已加载");
    }).catch(function () { toast("图片读取失败", true); });
  }

  async function recognizeImage() {
    if (!currentImageDataUrl) { toast("请先上传/粘贴题目图片", true); return null; }
    var cfg = getConfig();
    var vModel = (SITE.visionModel || cfg.vmodel || "").trim();
    if (!vModel) { toast("拍照识别未配置视觉模型", true); return null; }
    var vKey = SITE.visionKey || cfg.key;
    var vBase = SITE.visionBaseUrl || (cfg.vbase || "").trim() || cfg.base;
    if (!vKey) { toast("拍照识别未配置 API Key", true); return null; }

    var messages = [{
      role: "user",
      content: [
        { type: "text", text: "请识别图片中的题目，完整、准确地转录出来。数学公式用 LaTeX（行内 $...$，独立 $$...$$）。只输出题目文字，不要解答。" },
        { type: "image_url", image_url: { url: currentImageDataUrl } },
      ],
    }];

    var vEndpoint = (vBase || "https://api.deepseek.com").replace(/\/+$/, "") + "/chat/completions";
    var res = await fetch(vEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + vKey },
      body: JSON.stringify({ model: vModel, messages: messages, temperature: 0.1, stream: false, max_tokens: 4096 }),
    });
    var data = null;
    try { data = await res.json(); } catch (e) { /* ignore */ }
    if (!res.ok) throw new Error((data && data.error && data.error.message) || ("识别失败（HTTP " + res.status + "）"));
    var choice = data && data.choices && data.choices[0];
    var vmsg = (choice && choice.message) || {};
    var text = vmsg.content || vmsg.reasoning_content || "";
    if (!text) {
      throw new Error("未返回内容（finish_reason=" + (choice && choice.finish_reason) + "）原始响应：" + JSON.stringify(data).slice(0, 500));
    }
    return text.trim();
  }

  // ---------- 识别结果公式预览 ----------
  function renderOcrPreview() {
    var el = $("ocrPreview");
    if (!el) return;
    var src = $("ocrText").value.trim();
    if (!src) {
      el.innerHTML = '<p class="placeholder">识别结果会在这里以公式形式预览</p>';
      return;
    }
    el.innerHTML = escapeHtml(src).replace(/\n/g, "<br>");
    typeset(el);
  }

  function showOcrError(msg) {
    var pv = $("ocrPreview");
    if (pv) pv.innerHTML = '<p class="placeholder" style="color:#b42318;font-weight:600">识别失败：' + escapeHtml(msg) + "</p>";
    toast(msg, true);
  }

  // ---------- 事件绑定 ----------
  function init() {
    // Tab 切换
    document.querySelectorAll(".tab").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var name = btn.getAttribute("data-tab");
        document.querySelectorAll(".tab").forEach(function (b) { b.classList.toggle("active", b === btn); });
        document.querySelectorAll(".panel").forEach(function (p) { p.classList.toggle("active", p.id === "panel-" + name); });
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });

    // Chips 单选
    document.querySelectorAll(".chips").forEach(function (box) {
      box.addEventListener("click", function (e) {
        var chip = e.target.closest(".chip");
        if (!chip) return;
        box.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("active"); });
        chip.classList.add("active");
      });
    });

    // 变式数量滑块
    $("variantCount").addEventListener("input", function () {
      $("variantCountVal").textContent = this.value;
    });

    // 解题
    $("solveBtn").addEventListener("click", function () {
      var q = $("solveQuestion").value.trim();
      if (!q) { toast("请先输入题目", true); return; }
      var msg = PROMPTS.solve(activeValue("solveSubject"), q, getStyleRef());
      runAction({
        btn: $("solveBtn"), output: $("solveOutput"), copy: $("copySolve"), kind: "solve",
        messages: [{ role: "system", content: msg.system }, { role: "user", content: msg.user }],
        demoNote: "演示模式：未设置 API Key，以下为示例输出",
      });
    });

    // 举一反三
    $("variantBtn").addEventListener("click", function () {
      var q = $("variantQuestion").value.trim();
      if (!q) { toast("请先输入原题", true); return; }
      var n = parseInt($("variantCount").value, 10) || 3;
      var msg = PROMPTS.variant(activeValue("variantSubject"), q, $("variantSolution").value, n, getStyleRef());
      runAction({
        btn: $("variantBtn"), output: $("variantOutput"), copy: $("copyVariant"), kind: "variant",
        messages: [{ role: "system", content: msg.system }, { role: "user", content: msg.user }],
        demoNote: "演示模式：未设置 API Key，以下为示例输出",
      });
    });

    // 出模拟卷
    $("examBtn").addEventListener("click", function () {
      var types = [];
      document.querySelectorAll("#examTypes .type-item input").forEach(function (inp) {
        types.push({ name: inp.getAttribute("data-name"), count: parseInt(inp.value, 10) || 0 });
      });
      if (types.every(function (t) { return t.count === 0; })) {
        toast("请至少设置一种题型的数量", true); return;
      }
      var cfg = {
        total: parseInt($("examTotal").value, 10) || 100,
        level: activeValue("examLevel"),
        types: types,
        topics: $("examTopics").value,
        withAnswers: $("examAnswers").checked,
      };
      var msg = PROMPTS.exam(activeValue("examSubject"), cfg, getStyleRef());
      runAction({
        btn: $("examBtn"), output: $("examOutput"), copy: $("copyExam"), kind: "exam",
        messages: [{ role: "system", content: msg.system }, { role: "user", content: msg.user }],
        demoNote: "演示模式：未设置 API Key，以下为示例输出",
      });
    });

    // 深度思考
    $("deepBtn").addEventListener("click", function () {
      var q = $("deepQuestion").value.trim();
      if (!q) { toast("请先输入题目或知识点", true); return; }
      var msg = PROMPTS.deepThink(activeValue("deepSubject"), q, getStyleRef());
      runAction({
        btn: $("deepBtn"), output: $("deepOutput"), copy: $("copyDeep"), kind: "deep",
        messages: [{ role: "system", content: msg.system }, { role: "user", content: msg.user }],
        demoNote: "演示模式：未设置 API Key，以下为示例输出",
      });
    });

    // 拍照识别
    $("uploadZone").addEventListener("click", function () { $("fileInput").click(); });
    $("fileInput").addEventListener("change", function (e) {
      handleImageFile(e.target.files && e.target.files[0]);
    });
    document.addEventListener("dragover", function (e) { e.preventDefault(); });
    document.addEventListener("drop", function (e) {
      e.preventDefault();
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) handleImageFile(f);
    });
    document.addEventListener("paste", function (e) {
      var items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (var i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.indexOf("image") === 0) {
          handleImageFile(items[i].getAsFile());
          break;
        }
      }
    });
    $("clearImg").addEventListener("click", function () {
      currentImageDataUrl = null;
      $("previewWrap").hidden = true;
      $("previewImg").src = "";
      $("fileInput").value = "";
      $("uploadZone").querySelector(".upload-inner").style.display = "";
    });

    $("ocrText").addEventListener("input", function () {
      clearTimeout($("ocrText")._t);
      $("ocrText")._t = setTimeout(renderOcrPreview, 400);
    });

    $("ocrBtn").addEventListener("click", async function () {
      if (!currentImageDataUrl) { toast("请先上传/粘贴题目图片", true); return; }
      var orig = this.textContent;
      this.disabled = true;
      this.innerHTML = '<span class="spinner"></span>识别中…';
      try {
        var text = await recognizeImage();
        if (text) { $("ocrText").value = text; renderOcrPreview(); toast("识别完成，可修改后解答"); }
      } catch (e) { showOcrError(e.message || "识别失败"); }
      finally { this.disabled = false; this.textContent = orig; }
    });

    $("ocrSolveBtn").addEventListener("click", async function () {
      var q = $("ocrText").value.trim();
      if (!q) {
        if (!currentImageDataUrl) { toast("请先上传图片", true); return; }
        var orig = this.textContent;
        this.disabled = true;
        this.innerHTML = '<span class="spinner"></span>识别中…';
        try {
          var t = await recognizeImage();
          if (t) { $("ocrText").value = t; q = t; renderOcrPreview(); }
        } catch (e) { showOcrError(e.message || "识别失败"); }
        finally { this.disabled = false; this.textContent = orig; }
      }
      if (!q) { toast("未识别到题目，请上传图片或手动输入", true); return; }
      var msg = PROMPTS.solve(activeValue("ocrSubject"), q, getStyleRef());
      runAction({
        btn: $("ocrSolveBtn"), output: $("ocrOutput"), copy: $("copyOcr"), kind: "solve",
        messages: [{ role: "system", content: msg.system }, { role: "user", content: msg.user }],
        demoNote: "演示模式：未设置 API Key，以下为示例输出",
      });
    });

    // 复制
    bindCopy("copySolve", "solveOutput");
    bindCopy("copyVariant", "variantOutput");
    bindCopy("copyExam", "examOutput");
    bindCopy("copyDeep", "deepOutput");
    bindCopy("copyOcr", "ocrOutput");

    // 设置：保存 / 清除 / 显示
    $("saveCfg").addEventListener("click", function () {
      setConfig({
        key: $("apiKey").value.trim(),
        base: $("apiBase").value.trim() || DEFAULTS.base,
        model: $("apiModel").value,
        style: $("styleRef").value,
        vkey: $("vKey").value.trim(),
        vbase: $("vBase").value.trim(),
        vmodel: $("vModel").value.trim(),
      });
      updateKeyStatus();
      toast("已保存");
    });
    $("clearCfg").addEventListener("click", function () {
      if (!confirm("确定清除已保存的 API Key 吗？")) return;
      $("apiKey").value = "";
      $("vKey").value = "";
      setConfig({
        key: "",
        base: $("apiBase").value.trim() || DEFAULTS.base,
        model: $("apiModel").value,
        style: $("styleRef").value,
        vkey: "",
        vbase: $("vBase").value.trim(),
        vmodel: $("vModel").value.trim(),
      });
      updateKeyStatus();
      toast("已清除 Key");
    });
    $("toggleKey").addEventListener("click", function () {
      var inp = $("apiKey");
      var show = inp.type === "password";
      inp.type = show ? "text" : "password";
      this.textContent = show ? "隐藏" : "显示";
    });

    // 留言反馈
    $("fbSubmit").addEventListener("click", function () {
      var content = $("fbContent").value.trim();
      if (!content) { toast("留言内容不能为空", true); return; }
      var nick = $("fbNick").value.trim();
      this.disabled = true;
      fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nick, content: content }),
      })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error((res.d && res.d.error && res.d.error.message) || "提交失败");
          $("fbContent").value = "";
          $("fbNick").value = "";
          toast("已提交，感谢反馈！");
          loadFeedback();
        })
        .catch(function (e) { toast(e.message || "提交失败", true); })
        .finally(function () { $("fbSubmit").disabled = false; });
    });
    $("fbRefresh").addEventListener("click", loadFeedback);

    // 继续追问：给每个解答区加「追问」按钮
    document.querySelectorAll(".output-head").forEach(function (head) {
      var copy = head.querySelector("button");
      var b = document.createElement("button");
      b.type = "button";
      b.className = "btn ghost sm ask-trigger";
      b.textContent = "追问";
      b.addEventListener("click", openAsk);
      if (copy) head.insertBefore(b, copy); else head.appendChild(b);
    });
    $("askClose").addEventListener("click", closeAsk);
    $("askSend").addEventListener("click", sendAsk);
    $("askInput").addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAsk(); }
    });
    $("askModal").addEventListener("click", function (e) {
      if (e.target === $("askModal")) closeAsk();
    });

    // 初始载入配置
    loadSettings();
    loadPapers();
    loadFeedback();
  }

  function loadSettings() {
    var cfg = getConfig();
    $("apiKey").value = cfg.key;
    $("apiBase").value = cfg.base;
    $("apiModel").value = cfg.model;
    $("styleRef").value = cfg.style;
    // 视觉识别：优先用站点预配置
    $("vBase").value = SITE.visionBaseUrl || cfg.vbase;
    $("vModel").value = SITE.visionModel || cfg.vmodel;
    $("vKey").value = "";
    // 已预配置的项，对普通用户隐藏
    var visionSection = $("visionConfigSection");
    if (visionSection && SITE.visionModel) visionSection.style.display = "none";
    var textKeySection = $("textKeySection");
    if (textKeySection && SITE.textKey) textKeySection.style.display = "none";
    updateKeyStatus();
  }

  function updateKeyStatus() {
    var siteText = !!(SITE.textKey);
    var has = siteText || !!getConfig().key;
    var st = $("keyStatus");
    st.classList.toggle("on", has);
    st.querySelector(".key-status-text").textContent = siteText ? "已预配置" : (has ? "已设置 Key" : "未设置 Key");
    $("keyHint").textContent = siteText
      ? "本站已预配置模型，无需填写，直接使用即可。"
      : (has ? "已设置 Key，保存后立即生效；AI 调用费用由该账户自行承担。" : "尚未设置 Key，当前为「演示模式」（不联网、不花钱）。");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

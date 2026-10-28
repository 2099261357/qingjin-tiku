/* 青衿题库 · 提示词模板
 * 设计目标：不止于给出答案，而是引导学生思考、一题多解、主动做创新拓展。
 * 面向高等数学、大学物理，公式用 LaTeX。挂到 window.PROMPTS 供 app.js 使用。
 */
(function () {
  "use strict";

  var SYSTEM = [
    "你是一位严谨、富有洞见的大学课程辅导老师，精通高等数学与大学物理。",
    "你不仅会解题，更善于引导学生思考：先讲清思路，再给解答，并主动指出易错点、提供一题多解与知识迁移，不满足于只给答案。",
    "请始终用中文回答；数学公式请使用 LaTeX 语法（行内公式用 $...$，独立公式用 $$...$$）。",
    "除非题目信息不足（此时先说明假设），否则回答要步骤清晰、逻辑完整、结论正确。",
  ].join("\n");

  function styleBlock(ref, note) {
    if (!ref || !ref.trim()) return "";
    return (
      "\n\n【往年真题风格参考】\n" +
      note +
      "请模仿其出题风格、题型分布与难度，但不要直接照抄原题：\n" +
      ref.trim()
    );
  }

  window.PROMPTS = {
    SYSTEM: SYSTEM,

    // 解题：带思考过程的深度讲解
    solve: function (subject, question, styleRef) {
      return {
        system: SYSTEM,
        user:
          "【科目】" + subject + "\n" +
          "请对下面这道题进行「深度讲解」，按以下结构输出：\n" +
          "1. 【思路分析】先说明考点、切入点与所用方法（体现思考过程）；\n" +
          "2. 【详细解答】分步给出完整推导与结果；\n" +
          "3. 【一题多解】如适用，再给出一种不同思路的解法；\n" +
          "4. 【易错提醒】指出常见错误与注意点；\n" +
          "5. 【思维拓展】说明这道题还能如何变形、关联哪些知识点。\n\n" +
          "题目：\n" + question.trim() +
          (styleRef && styleRef.trim() ? "\n\n【风格参考（仅用于语气/难度参考，不影响本题解答）】\n" + styleRef.trim() : ""),
      };
    },

    // 举一反三：基础变式 + 创新变式
    variant: function (subject, question, solution, n, styleRef) {
      return {
        system: SYSTEM,
        user:
          "【科目】" + subject + "\n" +
          "下面是一道原题及其解答。请基于它生成 " + n +
          " 道变式题（举一反三），并体现出「创新思维」：\n" +
          "要求：\n" +
          "- 前一部分是「基础变式」：改动数字或条件，核心知识点不变、难度相当；\n" +
          "- 后一部分是「创新变式」：改变条件本质、跨知识点综合、或改造成开放探究题；\n" +
          "- 每道变式题都要标注【考察的思维点】，并附完整解答；\n" +
          "- 不要直接照抄原题。\n\n" +
          "【原题】\n" + question.trim() + "\n\n" +
          "【原题解答】\n" + (solution && solution.trim() ? solution.trim() : "（未提供，请根据原题自行给出）") +
          styleBlock(styleRef, "（用于模仿风格）"),
      };
    },

    // 出模拟卷：常规题 + 综合创新题板块
    exam: function (subject, cfg, styleRef) {
      var types = cfg.types
        .filter(function (t) { return t.count > 0; })
        .map(function (t) { return t.name + " " + t.count + " 道"; })
        .join("、") || "题型由你根据该科目合理设置";

      var ans = cfg.withAnswers
        ? "- 每题之后都要给出完整、详细的分步解答，并在最后附参考答案\n"
        : "- 只出题目，不要给出答案与解答\n";

      return {
        system: SYSTEM,
        user:
          "【科目】" + subject + "\n" +
          "请生成一份完整的《" + subject + "》模拟试卷，风格与难度参照往年真题，并体现对综合运用与创新思维的考查。\n\n" +
          "要求：\n" +
          "- 总分 " + (cfg.total || 100) + " 分\n" +
          "- 题型与数量：" + types + "\n" +
          "- 覆盖知识点：" + (cfg.topics && cfg.topics.trim() ? cfg.topics.trim() : "围绕该科目核心章节，覆盖面要广") + "\n" +
          "- 难度：" + (cfg.level || "适中") + "\n" +
          "- 结构：前部分为常规题；最后单独设一个「综合创新题」板块（2~3 道），考查跨章节综合运用、开放思维与一题多解\n" +
          ans +
          styleBlock(styleRef, "请严格模仿其出题风格、题型分布与难度，") +
          "\n\n请用中文，公式用 LaTeX。",
      };
    },

    // 深度思考：概念本质 + 多角度 + 创新拓展 + 知识脉络
    deepThink: function (subject, question, styleRef) {
      return {
        system: SYSTEM,
        user:
          "【科目】" + subject + "\n" +
          "请围绕下面这道题（或知识点）进行「深度思考」，不要只满足于给出答案，而要讲透本质、举一反三、激发创新：\n" +
          "1. 【概念本质】这个知识点或方法到底是什么、为什么成立、其直觉是什么；\n" +
          "2. 【多角度思考】从不同视角（如几何、代数、物理图像）重新审视它；\n" +
          "3. 【创新拓展】能否推广到更一般的情形、提出新的开放问题、并说明与实际应用的联系；\n" +
          "4. 【知识脉络】它依赖哪些前置知识，又能通向哪些后续内容。\n\n" +
          "题目 / 主题：\n" + question.trim() +
          (styleRef && styleRef.trim() ? "\n\n【风格参考】\n" + styleRef.trim() : ""),
      };
    },
  };
})();

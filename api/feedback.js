// 青衿题库 · 留言反馈（Vercel Serverless 函数）
// 使用 Upstash Redis 免费云存储持久化留言，零第三方 npm 依赖（直接走 REST API）。
// 需要环境变量：UPSTASH_REDIS_REST_URL、UPSTASH_REDIS_REST_TOKEN
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || "";
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";
const LIST_KEY = "feedback";

export async function GET() {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return json({ ok: true, entries: [] }); // 未配置时返回空列表，不报错
  }
  try {
    const data = await upstash([["LRANGE", LIST_KEY, "0", "99"]]);
    const raw = (data && data[0] && data[0].result) || [];
    const entries = raw
      .map((s) => { try { return JSON.parse(s); } catch { return null; } })
      .filter(Boolean);
    return json({ ok: true, entries });
  } catch (e) {
    return json({ error: { message: "读取留言失败" } }, 500);
  }
}

export async function POST(request) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return json({ error: { message: "留言功能未配置（缺少 Upstash 环境变量）" } }, 500);
  }
  try {
    const body = await request.json();
    const content = (body.content || "").trim();
    const nickname = (body.nickname || "").trim() || "匿名";
    if (!content) return json({ error: { message: "留言内容不能为空" } }, 400);
    if (content.length > 2000) return json({ error: { message: "留言内容过长（最多 2000 字）" } }, 400);

    const entry = {
      id: Date.now(),
      nickname: nickname.slice(0, 50),
      content,
      time: new Date().toLocaleString("zh-CN", { hour12: false, timeZone: "Asia/Shanghai" }),
    };

    // LPUSH 最新在前，并用 LTRIM 只保留最近 500 条
    await upstash([
      ["LPUSH", LIST_KEY, JSON.stringify(entry)],
      ["LTRIM", LIST_KEY, "0", "499"],
    ]);
    return json({ ok: true, entry });
  } catch (e) {
    return json({ error: { message: "保存留言失败" } }, 500);
  }
}

async function upstash(commands) {
  const url = UPSTASH_URL.replace(/\/+$/, "") + "/pipeline";
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + UPSTASH_TOKEN },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error("upstash error " + res.status);
  return res.json();
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

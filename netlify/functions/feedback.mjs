// 青衿题库 · Netlify 函数：留言反馈
// 使用 Upstash Redis 免费云存储（REST API），需要环境变量：
// UPSTASH_REDIS_REST_URL、UPSTASH_REDIS_REST_TOKEN
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || "";
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";
const LIST_KEY = "feedback";

export const handler = async (event) => {
  if (event.httpMethod === "GET") return handleGet();
  if (event.httpMethod === "POST") return handlePost(event);
  return res(405, { error: { message: "Method Not Allowed" } });
};

async function handleGet() {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return res(200, { ok: true, entries: [] });
  try {
    const data = await upstash([["LRANGE", LIST_KEY, "0", "99"]]);
    const raw = (data && data[0] && data[0].result) || [];
    const entries = raw
      .map((s) => { try { return JSON.parse(s); } catch { return null; } })
      .filter(Boolean);
    return res(200, { ok: true, entries });
  } catch (e) {
    return res(500, { error: { message: "读取留言失败" } });
  }
}

async function handlePost(event) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return res(500, { error: { message: "留言功能未配置（缺少 Upstash 环境变量）" } });
  }
  try {
    const body = JSON.parse(event.body || "{}");
    const content = (body.content || "").trim();
    const nickname = (body.nickname || "").trim() || "匿名";
    if (!content) return res(400, { error: { message: "留言内容不能为空" } });
    if (content.length > 2000) return res(400, { error: { message: "留言内容过长（最多 2000 字）" } });

    const entry = {
      id: Date.now(),
      nickname: nickname.slice(0, 50),
      content,
      time: new Date().toLocaleString("zh-CN", { hour12: false, timeZone: "Asia/Shanghai" }),
    };

    await upstash([
      ["LPUSH", LIST_KEY, JSON.stringify(entry)],
      ["LTRIM", LIST_KEY, "0", "499"],
    ]);
    return res(200, { ok: true, entry });
  } catch (e) {
    return res(500, { error: { message: "保存留言失败" } });
  }
}

async function upstash(commands) {
  const url = UPSTASH_URL.replace(/\/+$/, "") + "/pipeline";
  const respond = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + UPSTASH_TOKEN },
    body: JSON.stringify(commands),
  });
  if (!respond.ok) throw new Error("upstash error " + respond.status);
  return respond.json();
}

function res(status, obj) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(obj),
  };
}

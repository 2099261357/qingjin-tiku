// 青衿题库 · Vercel Serverless 函数
// 通用 OpenAI 兼容代理：把浏览器传入的请求转发到目标模型（默认 DeepSeek）。
// 同时支持文本模型与视觉模型（视觉模型走同一个 /chat/completions 接口，只是消息里带 image_url）。
// 用户自备 Key：从请求的 Authorization 头读取，服务器不保存。
export async function POST(request) {
  try {
    const body = await request.json();
    const auth = request.headers.get("authorization") || "";

    if (!auth.toLowerCase().startsWith("bearer ")) {
      return json({ error: { message: "请先在「使用说明」里设置你的 API Key" } }, 401);
    }

    let base = (request.headers.get("x-api-base-url") || "https://api.deepseek.com").replace(/\/+$/, "");
    const url = base + "/chat/completions";
    body.stream = false; // 统一非流式

    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: auth },
      body: JSON.stringify(body),
    });

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
    });
  } catch (e) {
    return json({ error: { message: "代理出错：" + (e && e.message ? e.message : String(e)) } }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

// 青衿题库 · Netlify 函数：OpenAI 兼容代理（文本 + 视觉）
// 从请求头读取用户自带的 API Key，转发到目标模型（默认 DeepSeek），不保存密钥。
export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return res(405, { error: { message: "Method Not Allowed" } });
  }
  try {
    const body = JSON.parse(event.body || "{}");
    const auth = event.headers.authorization || event.headers.Authorization || "";
    if (!auth.toLowerCase().startsWith("bearer ")) {
      return res(401, { error: { message: "请先在「使用说明」里设置你的 API Key" } });
    }
    const base = (event.headers["x-api-base-url"] || "https://api.deepseek.com").replace(/\/+$/, "");
    body.stream = false;

    const upstream = await fetch(base + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: auth },
      body: JSON.stringify(body),
    });
    const text = await upstream.text();
    return {
      statusCode: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
      body: text,
    };
  } catch (e) {
    return res(500, { error: { message: "代理出错：" + (e && e.message ? e.message : String(e)) } });
  }
};

function res(status, obj) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(obj),
  };
}

# 部署到 Netlify（免费 · 1 分钟 · 随时随地访问）

本项目是**纯静态网站**：不需要后端、不需要数据库、不需要 GitHub。
把 `static` 文件夹拖到 Netlify 就能上线，得到固定网址，任何网络都能打开。

---

## 第 1 步：准备文件

把项目里的 **`static` 文件夹**准备好（里面有 `index.html`、`app.js`、`papers.txt` 等）。

> 如果你拿到的是别人打包好的 `qingjin-tiku-site.zip`，直接用它也行（Netlify 支持拖 zip）。

---

## 第 2 步：拖到 Netlify

1. 打开 **https://app.netlify.com/drop**
2. 把 **`static` 文件夹**（或 `qingjin-tiku-site.zip`）**直接拖进**网页中间的大虚线框
3. 等几十秒，Netlify 会给你一个网址，形如：
   ```
   https://xxxx-xxxx.netlify.app
   ```
4. 这就是你的网站，打开即可。

> 免费、自动 HTTPS、固定网址。注册（用邮箱或 GitHub 登录）后网址永久保留。

---

## 第 3 步：开始使用

网站不需要任何登录，每个使用者**自己填一个 DeepSeek Key** 即可：

1. 打开你的 `https://xxx.netlify.app`
2. 点「使用说明」→「API Key」→ 粘贴 DeepSeek 的 `sk-…` → 保存
3. 回「拍照识别」上传题目，或「出模拟卷」直接生成

> 拍照识别和解题都用这个 DeepSeek Key（识图用 `deepseek-flash`，解题用 `deepseek-chat`），
> 不需要再配置视觉模型。

---

## 更新网站

1. 打开你的 Netlify 站点 → **Deploys**
2. 找 **「Deploy manually」**（或页面上的 **「Already built it? Drop a folder, .zip...」** 虚线框）
3. 把新的 `static` 文件夹 / 新 zip 拖进去
4. 等部署完成，网址不变，内容已更新

> 手机/浏览器若还是旧页面，按 **Ctrl + F5** 强制刷新（或清一下网站缓存）。

---

## 常见问题

- **拍照识别报错 / 没反应？** 确认填的是 **DeepSeek** 的 Key（不是别的平台的）。
- **识别很慢？** 视觉模型 + 网络延迟，第一次可能慢几秒，属正常。
- **想换自定义域名？** Netlify → Domain management，绑定自己的域名。
- **担心 AI 费用？** 各人自带 Key、各付各的，部署者不承担他人费用。
- **想本地预览？** 在项目目录运行 `python server.py`，打开 `http://127.0.0.1:8000`。

---

## 其他部署方式（可选）

纯静态网站也可以放在任何静态托管上：
- Cloudflare Pages
- Vercel（纯静态，直接导入 `static` 目录）
- GitHub Pages（需 GitHub 能访问）

核心都一样：**把 `static` 目录作为网站根目录发布**即可。

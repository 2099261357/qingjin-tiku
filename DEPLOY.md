# 部署到 Vercel（免费 · 随时随地可访问）

这篇教程带你把这个网站免费部署到公网，得到固定网址（如 `https://你的项目.vercel.app`），任何网络都能打开。全程约 20 分钟，只需注册 3 个免费账号。

---

## 需要准备的免费账号

| 平台 | 用途 | 费用 |
|------|------|------|
| [GitHub](https://github.com) | 存放代码 | 免费 |
| [Vercel](https://vercel.com) | 托管网站 | 免费 |
| [Upstash](https://upstash.com) | 存留言（Redis） | 免费版够用 |

> 提示：全程可用 GitHub 账号「一键登录」Vercel 和 Upstash，减少注册步骤。

---

## 第一步：把代码推到 GitHub

1. 打开 GitHub → 右上角「+」→「New repository」，仓库名随意（如 `qingjin-tiku`），设为 **Public** 或 Private 均可，点「Create」。
2. 在你自己电脑上，进入本项目目录，在终端执行：

   ```bash
   cd exam-ai-tutor
   git init
   git add .
   git commit -m "first commit"
   git branch -M main
   git remote add origin https://github.com/你的用户名/qingjin-tiku.git
   git push -u origin main
   ```

   > 还没装 Git 的话，先到 <https://git-scm.com> 下载安装。

---

## 第二步：Vercel 连接仓库自动部署

1. 打开 [vercel.com](https://vercel.com)，点「Sign Up」，选择 **Continue with GitHub** 授权登录。
2. 登录后点 **「Add New」→「Project」**，选择你刚建的 `qingjin-tiku` 仓库，点 **「Import」**。
3. Vercel 会自动识别（本项目无需构建命令），直接点 **「Deploy」**。
4. 等待几十秒，出现 🎉 即部署完成，点 **「Visit」** 就能打开你的网站，网址形如 `https://qingjin-tiku-xxxx.vercel.app`。

> 以后你 `git push` 新代码，Vercel 会**自动重新部署**，无需手动操作。

---

## 第三步：配置留言功能（Upstash Redis）

留言功能需要云存储，用 Upstash 免费版：

1. 打开 [upstash.com](https://upstash.com)，用 GitHub 登录。
2. 进入 **Console → Create Database**，Region 任选（离你近即可），创建好后进入数据库详情页。
3. 在 **REST API** 一栏复制两样东西：
   - `UPSTASH_REDIS_REST_URL`（形如 `https://xxxx.upstash.io`）
   - `UPSTASH_REDIS_REST_TOKEN`
4. 回到 Vercel → 你的项目 → **Settings → Environment Variables**，添加上面两个变量，**Deployment 选 Production**，点 Save。
5. 回到 **Deployments**，点右上角「⋯」→ **Redeploy**（让环境变量生效）。

> 不配置也能用，只是「留言反馈」页会显示为空、提交会提示未配置。

---

## 第四步：开始使用（重要）

网站上线后，**每个用户需要自己填 API Key**（BYOK），网站本身不出 AI 费用：

1. 打开你的 `xxx.vercel.app`。
2. 点「使用说明」：
   - **API Key**：填 DeepSeek 的 `sk-…`（用于解题、举一反三、出卷、深度思考）。
   - **视觉模型**：填一个支持图片的模型，用于「拍照识别」。
     - 推荐 **智谱 GLM-4V-Flash（免费）**：地址 `https://open.bigmodel.cn/api/paas/v4`，模型 `glm-4v-flash`，Key 填智谱的 key（注册即免费用）。
     - 或 **通义千问 Qwen-VL**：地址 `https://dashscope.aliyuncs.com/compatible-mode/v1`，模型 `qwen-vl-plus`，Key 填通义千问的 key。
     - （DeepSeek 标准 API 不支持图片，所以识别需要单独配一个视觉模型。）
3. 点「保存」，即可拍照识别、解题、出卷。

---

## 常见问题

- **拍照识别没反应？** 检查「使用说明」里的视觉模型是否已配置（DeepSeek 不支持图片）。
- **留言提交失败？** 检查 Vercel 环境变量是否填对、是否 Redeploy 过。
- **想用自定义域名？** Vercel → Settings → Domains 添加你自己的域名（需另购域名）。
- **担心 AI 费用？** 各人自带 Key，费用各人自理，你作为部署者不承担他人费用。

## 本地开发（不上线时）

```bash
cd exam-ai-tutor
python server.py     # 打开 http://127.0.0.1:8000
```

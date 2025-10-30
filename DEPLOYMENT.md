# 🚀 部署指南

## 方法一：使用 Vercel（最简单，推荐）

### 步骤 1：注册 Vercel 账号

1. 访问 [vercel.com](https://vercel.com)
2. 点击 "Sign Up"
3. 使用 GitHub 账号登录（推荐）

### 步骤 2：导入项目

1. 登录后点击 "Add New..." → "Project"
2. 在 "Import Git Repository" 中找到 `KazooProtoWeb-Alpha4`
3. 点击 "Import"

### 步骤 3：配置项目

保持默认设置即可：
- **Framework Preset**: Other
- **Root Directory**: `./`
- **Build Command**: (留空)
- **Output Directory**: (留空)

### 步骤 4：部署

1. 点击 "Deploy" 按钮
2. 等待 1-2 分钟，Vercel 会自动构建和部署
3. 部署完成后，你会获得一个免费的 URL，类似：
   ```
   https://kazoo-proto-web-alpha4.vercel.app
   ```

### 步骤 5：测试

1. 访问部署的 URL
2. 允许浏览器访问麦克风
3. 开始使用！

### 自动更新

每次你推送代码到 GitHub，Vercel 会自动重新部署：
```bash
git add .
git commit -m "更新功能"
git push
```

---

## 方法二：使用 Netlify

### 步骤 1：注册 Netlify

1. 访问 [netlify.com](https://netlify.com)
2. 使用 GitHub 账号注册

### 步骤 2：导入项目

1. 点击 "Add new site" → "Import an existing project"
2. 选择 "GitHub"
3. 授权并选择 `KazooProtoWeb-Alpha4` 仓库

### 步骤 3：部署设置

- **Build command**: (留空)
- **Publish directory**: `.`

### 步骤 4：部署

点击 "Deploy site"，完成后获得 URL。

---

## 方法三：使用 GitHub Pages

### 步骤 1：启用 GitHub Pages

1. 进入你的 GitHub 仓库
2. 点击 "Settings"
3. 左侧菜单选择 "Pages"
4. Source 选择 "Deploy from a branch"
5. Branch 选择 "main" 和 "/ (root)"
6. 点击 "Save"

### 步骤 2：访问网站

几分钟后，访问：
```
https://zenalexa.github.io/KazooProtoWeb-Alpha4/
```

**注意**: GitHub Pages 只支持 HTTPS，所以麦克风访问没问题。

---

## 方法四：使用 Vercel CLI（命令行）

### 安装 Vercel CLI

```bash
npm install -g vercel
```

### 登录

```bash
vercel login
```

### 部署

```bash
# 进入项目目录
cd KazooProtoWeb-Alpha4

# 部署到生产环境
vercel --prod
```

按提示操作，完成后会显示部署的 URL。

---

## 自定义域名（可选）

### 在 Vercel 中绑定域名

1. 购买域名（如 Namecheap, GoDaddy）
2. 进入 Vercel 项目设置
3. 点击 "Domains"
4. 添加你的域名
5. 按照提示配置 DNS 记录

### DNS 配置示例

在你的域名提供商添加：

```
Type: CNAME
Name: www
Value: cname.vercel-dns.com

Type: A
Name: @
Value: 76.76.21.21
```

---

## 故障排除

### 问题 1: 麦克风无法访问

**原因**: 浏览器要求 HTTPS 才能访问麦克风

**解决方案**:
- 确保部署在 HTTPS 环境（Vercel/Netlify 默认提供）
- 本地测试使用 `localhost`（浏览器允许）

### 问题 2: 音频库加载失败

**原因**: CDN 链接可能被墙

**解决方案**: 下载库文件到本地
```bash
# 下载 Tone.js
curl -o js/lib/tone.min.js https://cdn.jsdelivr.net/npm/tone@14.7.77/build/Tone.js

# 下载 Pitchfinder
curl -o js/lib/pitchfinder.min.js https://cdn.jsdelivr.net/npm/pitchfinder@2.3.0/dist/pitchfinder.min.js
```

然后修改 [index.html](index.html) 中的引用：
```html
<script src="js/lib/tone.min.js"></script>
<script src="js/lib/pitchfinder.min.js"></script>
```

### 问题 3: 延迟较高

**优化建议**:
1. 使用 Chrome 浏览器（音频性能最佳）
2. 使用有线耳机
3. 关闭其他标签页
4. 在设置中降低"音高平滑"值

---

## 监控和分析

### 添加 Google Analytics

1. 注册 [Google Analytics](https://analytics.google.com)
2. 获取跟踪 ID
3. 在 [index.html](index.html) 的 `<head>` 中添加：

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

---

## 性能优化

### 启用 CDN 缓存

Vercel 和 Netlify 自动启用全球 CDN，无需配置。

### 压缩资源

```bash
# 安装压缩工具
npm install -g minify

# 压缩 CSS
minify css/styles.css > css/styles.min.css

# 压缩 JS
minify js/main.js > js/main.min.js
```

### 使用 HTTP/2

Vercel 和 Netlify 默认启用 HTTP/2，提升加载速度。

---

## 推荐配置

### 最佳部署平台对比

| 平台 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| **Vercel** | 最快部署、自动 HTTPS、全球 CDN | 无 | ⭐⭐⭐⭐⭐ |
| **Netlify** | 功能丰富、表单处理 | 稍慢 | ⭐⭐⭐⭐ |
| **GitHub Pages** | 完全免费、简单 | 无服务端功能 | ⭐⭐⭐ |

### 推荐部署流程

1. **开发阶段**: 使用 `npm run dev` 本地测试
2. **预览阶段**: 推送到 GitHub，Vercel 自动部署预览版本
3. **生产阶段**: 合并到 main 分支，自动部署到生产环境

---

## 下一步

部署完成后，你可以：

1. 分享链接给朋友测试
2. 收集用户反馈
3. 根据 Google Analytics 数据优化功能
4. 添加更多乐器音色
5. 实现音频录制和导出功能

---

**祝你部署成功！🎉**

如有问题，请提交 [Issue](https://github.com/ZenAlexa/KazooProtoWeb-Alpha4/issues)。

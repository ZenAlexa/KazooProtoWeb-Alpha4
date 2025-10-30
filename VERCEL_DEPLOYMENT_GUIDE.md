# Vercel 部署指南

## 问题诊断和修复

### ✅ 已修复的404错误

**问题原因：**
旧的 `vercel.json` 使用了过时的配置：
```json
{
  "version": 2,
  "builds": [{"src": "index.html", "use": "@vercel/static"}],
  "routes": [{"src": "/(.*)", "dest": "/$1"}]
}
```

**修复方案：**
现代Vercel会自动检测静态网站，不需要 `builds` 配置。新配置：
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {"key": "Cross-Origin-Embedder-Policy", "value": "require-corp"},
        {"key": "Cross-Origin-Opener-Policy", "value": "same-origin"},
        {"key": "Cache-Control", "value": "public, max-age=3600, s-maxage=3600"}
      ]
    }
  ]
}
```

## 部署步骤

### 方法1: 通过Vercel Dashboard (推荐)

1. **连接GitHub仓库**
   - 访问 https://vercel.com/new
   - 选择 "Import Git Repository"
   - 选择 `KazooProtoWeb-Alpha4` 仓库

2. **配置项目设置**
   - Framework Preset: `Other` (静态网站)
   - Root Directory: `./` (项目根目录)
   - Build Command: 留空
   - Output Directory: `./` (项目根目录)

3. **环境变量**
   - 不需要任何环境变量

4. **部署**
   - 点击 "Deploy"
   - 等待部署完成（通常1-2分钟）

### 方法2: 通过Vercel CLI

```bash
# 安装Vercel CLI (如果还没安装)
npm i -g vercel

# 登录
vercel login

# 部署
vercel --prod
```

## 验证部署

部署完成后，你会获得一个URL，例如：
- `https://kazoo-proto-web-alpha4.vercel.app`
- 或你的自定义域名

### 测试清单

1. **首页加载** ✓
   - 访问URL，应该看到 "Transform Your Voice" 标题
   - Hero图标应该有浮动动画

2. **资源加载** ✓
   - 打开浏览器开发者工具 (F12)
   - 检查Network标签
   - 所有文件应该返回200状态码：
     - `index.html`
     - `css/styles.css`
     - `js/lib/tone.js`
     - `js/lib/pitchfinder-browser.js`
     - 所有其他 `.js` 文件

3. **功能测试** ✓
   - 点击 "Start Calibration" 按钮
   - 允许麦克风权限
   - 校准模态弹窗应该显示
   - 哼唱5秒，应该自动进入Step 2
   - 再哼唱5秒，应该完成校准

4. **Console检查** ✓
   - 打开Console标签
   - 应该看到：
     - "Tone.js AudioContext resumed after user gesture"
     - "Calibration started: Step 1"
     - 没有404或CORS错误

## 常见问题排查

### 问题1: 仍然404错误

**可能原因：**
- Vercel缓存了旧的部署

**解决方案：**
```bash
# 在Vercel Dashboard中
1. 进入项目设置
2. 找到 "Deployments" 标签
3. 找到最新的部署
4. 点击 "..." → "Redeploy"
5. 选择 "Clear build cache and redeploy"
```

### 问题2: 资源加载失败

**检查：**
```bash
# 确认所有文件都在仓库中
git ls-files | grep -E "css|js|html"
```

**应该看到：**
```
css/styles.css
index.html
js/audio-input.js
js/calibration.js
js/lib/pitchfinder-browser.js
js/lib/tone.js
js/main.js
js/performance.js
js/pitch-detector.js
js/synthesizer.js
```

### 问题3: CORS或SharedArrayBuffer错误

**原因：**
Web Audio API需要特殊的HTTP headers

**验证：**
使用curl检查headers：
```bash
curl -I https://your-deployment-url.vercel.app
```

**应该包含：**
```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

如果没有，检查 `vercel.json` 是否正确配置。

### 问题4: 麦克风权限被拒绝

**原因：**
- 浏览器需要HTTPS或localhost才能访问麦克风
- Vercel自动提供HTTPS ✓

**解决方案：**
- 确保使用 `https://` 而不是 `http://`
- 在浏览器中检查麦克风权限设置

## 项目结构

```
KazooProtoWeb-Alpha4/
├── index.html              # 入口文件 ✓
├── vercel.json            # Vercel配置 ✓
├── css/
│   └── styles.css         # 样式文件 ✓
├── js/
│   ├── audio-input.js     # 音频输入管理 ✓
│   ├── calibration.js     # 校准系统 ✓
│   ├── main.js            # 主控制器 ✓
│   ├── performance.js     # 性能监控 ✓
│   ├── pitch-detector.js  # 音高检测 ✓
│   ├── synthesizer.js     # 音色合成 ✓
│   └── lib/
│       ├── tone.js        # Tone.js库 (345KB) ✓
│       └── pitchfinder-browser.js # YIN算法 ✓
└── assets/
    └── icons/             # 图标资源
```

## 性能优化

### 缓存策略
```json
// vercel.json 中的缓存配置
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {"key": "Cache-Control", "value": "public, max-age=3600"}
      ]
    },
    {
      "source": "/js/lib/(.*)",
      "headers": [
        {"key": "Cache-Control", "value": "public, max-age=31536000, immutable"}
      ]
    }
  ]
}
```

- **一般资源**: 1小时缓存
- **库文件** (`js/lib/`): 1年缓存，标记为不可变

### CDN分发
Vercel自动使用全球CDN，确保：
- 低延迟访问
- 自动HTTPS
- 自动压缩 (Gzip/Brotli)

## 监控和日志

### Vercel Analytics
在项目设置中启用：
1. 进入项目 → Settings → Analytics
2. 启用 "Web Analytics"
3. 查看实时访问数据和性能指标

### 部署日志
查看构建和部署日志：
1. 进入 Deployments 标签
2. 点击任何部署
3. 查看 "Build Logs" 和 "Function Logs"

## 自定义域名

1. **添加域名**
   ```
   Project Settings → Domains → Add Domain
   ```

2. **配置DNS**
   - A记录: `76.76.21.21`
   - 或 CNAME: `cname.vercel-dns.com`

3. **自动HTTPS**
   Vercel会自动配置SSL证书

## 故障排除命令

```bash
# 检查最新部署状态
vercel ls

# 查看特定部署的详细信息
vercel inspect [deployment-url]

# 本地测试（模拟Vercel环境）
vercel dev

# 强制重新部署
vercel --prod --force
```

## 技术支持

如果问题仍然存在：

1. **检查Vercel状态页面**
   https://www.vercel-status.com

2. **查看Vercel文档**
   https://vercel.com/docs

3. **联系Vercel支持**
   https://vercel.com/support

4. **查看项目README**
   `README.md` 包含项目说明和本地开发指南

## 成功标志

部署成功后，你应该能够：
- ✓ 访问网站并看到完整的UI
- ✓ 完成语音校准（两步，各5秒）
- ✓ 选择乐器并听到实时的音色转换
- ✓ 在控制台看到 "Tone.js AudioContext resumed"
- ✓ 没有404、CORS或其他错误

---

**最后更新**: 2025-10-30
**版本**: 1.1
**状态**: ✅ 404问题已修复

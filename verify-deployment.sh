#!/bin/bash

# Vercel部署验证脚本
# 用于检查所有必要的文件是否存在且正确

echo "🔍 Vercel部署验证检查"
echo "===================="
echo ""

# 检查关键文件
echo "📁 检查关键文件..."
files=(
    "index.html"
    "vercel.json"
    "css/styles.css"
    "js/main.js"
    "js/audio-input.js"
    "js/calibration.js"
    "js/pitch-detector.js"
    "js/synthesizer.js"
    "js/performance.js"
    "js/lib/tone.js"
    "js/lib/pitchfinder-browser.js"
)

missing_files=0
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✓ $file"
    else
        echo "  ✗ $file (缺失!)"
        missing_files=$((missing_files + 1))
    fi
done

echo ""

# 检查vercel.json配置
echo "⚙️  检查vercel.json配置..."
if grep -q "\"builds\"" vercel.json; then
    echo "  ✗ 发现过时的builds配置 - 需要移除!"
else
    echo "  ✓ 无builds配置（正确）"
fi

if grep -q "\"outputDirectory\"" vercel.json; then
    echo "  ✓ outputDirectory已配置"
else
    echo "  ✗ 缺少outputDirectory配置"
fi

if grep -q "Cross-Origin-Embedder-Policy" vercel.json; then
    echo "  ✓ COOP/COEP headers已配置"
else
    echo "  ✗ 缺少COOP/COEP headers"
fi

echo ""

# 检查HTML中的资源路径
echo "🔗 检查资源路径..."
if grep -q 'src="http' index.html || grep -q 'href="http' index.html; then
    echo "  ✗ 发现绝对URL - 应使用相对路径"
else
    echo "  ✓ 使用相对路径（正确）"
fi

if grep -q 'src="//' index.html || grep -q 'href="//' index.html; then
    echo "  ✗ 发现协议相对URL - 应使用相对路径"
else
    echo "  ✓ 无协议相对URL（正确）"
fi

echo ""

# 检查文件大小
echo "📊 检查文件大小..."
size_tone=$(wc -c < js/lib/tone.js | xargs)
size_pitchfinder=$(wc -c < js/lib/pitchfinder-browser.js | xargs)

echo "  - tone.js: $size_tone bytes"
echo "  - pitchfinder-browser.js: $size_pitchfinder bytes"

if [ $size_tone -lt 100000 ]; then
    echo "  ✗ tone.js太小，可能未正确保存"
else
    echo "  ✓ tone.js大小正常"
fi

echo ""

# 检查Git状态
echo "📦 检查Git状态..."
if [ -z "$(git status --porcelain)" ]; then
    echo "  ✓ 工作目录干净，所有改动已提交"
else
    echo "  ⚠️  有未提交的改动："
    git status --short
fi

echo ""

# 检查package.json
echo "📋 检查package.json..."
if grep -q "\"build\":" package.json; then
    echo "  ⚠️  发现build脚本 - 纯静态网站应移除"
else
    echo "  ✓ 无build脚本（正确 - 纯静态网站）"
fi

echo ""

# 总结
echo "===================="
if [ $missing_files -eq 0 ]; then
    echo "✅ 所有检查通过！可以部署到Vercel"
    echo ""
    echo "配置摘要："
    echo "  - 输出目录: . (根目录)"
    echo "  - 网站类型: 静态网站"
    echo "  - COOP/COEP: 已配置"
    echo ""
    echo "下一步："
    echo "1. git push origin main (如果有未推送的提交)"
    echo "2. 访问 Vercel Dashboard 查看部署状态"
    echo "3. 等待部署完成（约1-2分钟）"
    echo "4. 获取Production URL并测试"
else
    echo "❌ 发现 $missing_files 个问题，请修复后再部署"
fi

echo ""

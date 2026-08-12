---
name: 上传文件
description: 将本地文件（文档、图片、音视频）上传到知识库。当用户需要上传、导入或添加文件到知识库时使用。
---

# 上传文件

将本地文件上传到目标知识库。系统会自动解析文件内容、提取知识实体、
构建向量嵌入，使内容可被检索。

## 支持格式

- 文档: PDF, Word (.doc/.docx), Excel (.xls/.xlsx), CSV, TXT, Markdown
- 演示: PowerPoint (.pptx/.ppt)
- 代码/配置: HTML, XML, JSON, YAML, TOML, INI, LOG
- 图片: PNG, JPG, GIF, BMP, WebP, SVG, ICO, TIFF, HEIC
- 音视频: MP3, WAV, M4A, AAC, OGG, FLAC, MP4, MOV, AVI, MKV, WebM

## 处理流程

1. 用户选择或拖拽文件
2. 通过 `POST /api/knowledge-bases/{kb_id}/documents` 上传（multipart）
3. 后端处理：分块 → 向量化 → 实体提取 → 分类
4. 返回成功或失败结果

## 注意事项

- 大文件处理时间较长
- 文件处理在后台异步进行

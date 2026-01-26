# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此仓库工作时提供指导。

## 项目概述

基于 Next.js 的 AI 聊天应用（模仿豆包），使用 SSE（Server-Sent Events）实现实时流式响应。

## 常用命令

```bash
npm run dev      # 开发服务器，运行在 http://10.59.83.189:3001
npm run build    # 生产构建（standalone 模式）
npm start        # 启动生产服务器
npm run lint     # 运行 ESLint 检查
```

## 架构

### 技术栈
- **Next.js 16** App Router + React 19 + TypeScript
- **UI 组件**: Ant Design 6、Tailwind CSS 4
- **Markdown 渲染**: marked + highlight.js + xss（防 XSS 攻击）
- **React Compiler** 已启用

### 关键配置
- `basePath: '/next'` - 所有路由以 `/next` 为前缀
- `output: 'standalone'` - 用于容器化部署
- `compress: false` - 由 nginx 处理 Brotli 压缩

### 目录结构
```
src/
├── app/
│   ├── chat/page.tsx    # 聊天主界面（客户端组件）
│   ├── chat/icon/       # SVG 图标组件
│   ├── layout.tsx       # 根布局，包含 Ant Design 注册
│   └── [slug]/page.tsx  # 404 兜底路由
├── components/          # 可复用 UI 组件
└── composables/         # 自定义 React Hooks（Vue 风格命名）
    ├── useResetState.ts # 带重置功能的 useState
    └── useEffectUtil.ts # 异步 useEffect
```

### 聊天界面 (`src/app/chat/page.tsx`)

**状态模型：**
```typescript
interface IChat {
  question: string;
  answer?: string;           // 最终响应
  streamingAnswer?: string;  // SSE 实时累积内容
}
```

**SSE 流式请求：**
- 开发环境 API: `http://10.59.83.189:8080/ai/chat`
- 生产环境 API: `/api/ai/chat`
- 使用 `AbortController` 支持取消请求
- 响应格式: `data: {...}\n\n`，以 `data: [DONE]` 结束
- 通过 `partialAnswer` 字段累积部分响应

**快捷键：**
- `Enter` - 发送消息
- `Shift+Enter` - 换行

### 路径别名
`@/*` 映射到 `./src/*`（在 tsconfig.json 中配置）

### 样式
- Tailwind 自定义设计令牌在 `globals.css`
- 中文字体栈: PingFang SC、Hiragino Sans GB、Microsoft YaHei
- Markdown 样式在 `src/app/chat/index.css`

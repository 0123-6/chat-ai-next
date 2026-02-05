# 待办
// 请忽略 请修复以下bug,请注意网站同时支持pc端和移动端,自动测试代码是否有bug(仅限这次新增的),并自动修复

主要可优化点

1. 聊天主页面过于庞大（~577 行）
chat/[[...conversationId]]/page.tsx 承担了太多职责：SSE 连接、滚动控制、Markdown 渲染、历史加载、
UI渲染全部混在一起。可以考虑拆分：

- SSE 流式请求逻辑 → useSSEChat hook
- 滚动控制逻辑 → useAutoScroll hook
- 单条消息渲染 → ChatMessage 组件
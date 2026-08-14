---
title: "Claude 的尖括号、Content Block 和 JSON 到底是什么关系"
description: "模型看到的全是纯文本，客户端收到的是结构化 block，尖括号只是提示词里的标记。三层各管各的，没有自动转换管道。从训练先验到后端专用生成通道，拆清楚 Claude 的 content block、尖括号标签和 JSON 结构之间的关系。"
date: "2026-08-14"
tags: ["Claude", "Agent", "Context", "API"]
readingTime: "6 min read"
---

Claude Code 收到的消息是 block 化的。一条 assistant 消息大致长这样：

```json
{
  "type": "assistant",
  "content": "asdasda"
}
```

更准确的说法是 content 是一个数组，里面可以塞多种类型的 block。text、tool_use、thinking 都是其中一种。很多人第一次看到 skill 相关的结构时会愣一下：

```xml
<skill>
  <name>...</name>
  <description>...</description>
  ...
</skill>
```

这和 block 是什么关系？

模型看到的全是纯文本。system prompt 里被塞进一堆带尖括号的字符串，模型把它们当普通字符处理。客户端和 API 之间传输的，是结构化的 content block。尖括号是提示词里的标记，block 是传输协议。两者不在同一层。

官方返回给客户端的数据永远是 Messages API 的结构化格式。即使只有一句普通回复，也会被包成 `{"type": "text", "text": "..."}`。thinking 和 tool_use 更是后端直接按类型切好的。你在界面上看到的文字，是客户端把这些 block 里的字段抽出来渲染的结果。模型底层还是在生成 token，但官方通道没有"纯文字流直接吐给你"这回事。

尖括号常见的用法分几类。提示词结构里最常见的是 instructions、context、example、document、question 这些。Claude Code 的 skill 元数据会用 available_skills、skill、name、description。思维链相关的提示里经常出现 thinking 和 answer。模型被大量带 XML 结构的数据训练过，对这种边界标记很敏感。

官方的 extended thinking 不是靠模型先写 `<thinking>` 标签再解析。请求里打开 thinking 后，后端走专用生成路径，直接产出：

```json
{
  "type": "thinking",
  "thinking": "摘要后的推理...",
  "signature": "加密签名..."
}
```

你看到的 thinking 内容通常是摘要版，完整原始推理被加密放进 signature，安全系统觉得有风险时还会变成 redacted_thinking。这是刻意设计，不是 bug。

尖括号和 JSON 之间没有自动的一一转换管道。输入侧，尖括号是人（或运行时）写进 prompt 的普通文本，用来激活模型对结构的敏感。输出侧，官方 thinking 和 tool_use 是后端直接结构化的，不依赖模型先吐出尖括号再解析。只有当你自己要求模型用尖括号格式输出时，那些标签才会作为普通字符串出现在 text block 里，需要客户端自己处理。

模型印象里尖括号的主要来源是训练数据。预训练和后续对齐里大量出现过这种格式，权重里已经形成了很强的先验。人写进 prompt 的尖括号只是在激活这个已有习惯，不是源头。

那为什么平时正常交流时它几乎不吐尖括号？因为后训练把默认行为压住了。RLHF 和偏好优化强烈奖励干净、自然的人类可读文字。正常对话的上下文里没有激活"需要结构"的信号，模型就待在流畅文本的分布里。尖括号会漏出来，通常发生在明确要求、官方特殊模式，或者上下文混乱、指令冲突、负载高、能力下降的时候。压力大时训练痕迹重新浮上来，这是先验泄漏，不是官方设计的正常路径。

把三者放在一起看就清楚了。尖括号是提示词约定和训练痕迹。模型生成的是 token 序列。API 把生成结果包装成 typed content block 返回给客户端。官方结构化靠的是专用生成通道，不是"先吐尖括号再转换"。平时不吐尖括号是对齐成功的表现，脆弱时吐出来是先验露馅。

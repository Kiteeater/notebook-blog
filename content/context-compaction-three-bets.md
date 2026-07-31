---
title: "上下文压缩的三种赌注"
description: "参数只是表象。缓存、结构、边界——三个互斥的下注，决定了成本、能力天花板和演进权。"
date: "2026-07-31"
tags: ["LLM", "Agent", "Compaction", "Claude Code"]
readingTime: "5 min read"
---

LLM 上下文窗口有限。长会话必然溢出。Claude Code、Pi、Codex 都做了压缩来续命。触发阈值、token 估算方式、摘要格式高度趋同。看起来差不多。真正拉开差距的，是三个互斥的下注：缓存怎么处理、会话结构怎么建模、压缩逻辑的边界放在哪。这些决定了各自的成本、能力天花板和可演进性。

## 先看缓存

压缩会改历史长度，直接冲击 prompt 前缀缓存。三者给出了三种完全不同的答案。

Claude Code 选择全力复用。它不在主对话里直接调模型生成摘要，而是 fork 出一个子 agent。请求必须和主对话的前缀完全一致，才能命中 Anthropic 的缓存键。CacheSafeParams 把 system prompt、tools、model、messages 前缀打包传过去。这里有一个反直觉的坑：绝不能给 fork 设 maxOutputTokens。它会连带改掉 budget_tokens，而 thinking config 是缓存键的一部分，缓存瞬间失效。压缩后还要主动调用 notifyCompaction，把 cache_read 的基线清掉。否则系统会把合法的 token 下降当成缓存断裂报警。漏掉这一步，历史上曾造成 20% 的误报。实验数据很硬：关掉 fork 共享，cache miss 飙到 98%，全队每天多出约 380 亿 token 的创建成本。这就是“压缩这次也要命中”的代价和收益。

Codex 做前缀保护。超限时从头部删最旧的一项再重试，不删尾。服务端缓存按前缀匹配，删头既能腾空间，又能保住后续 turn 的缓存。整个 compact turn 复用同一个 client session，sticky routing 和 websocket 状态跨重试存活。它还有一条更彻底的路径：把整个 session 直接丢进 Codex 客户端内部压缩，然后把结果返回给你。过程、细节、中间状态全部黑盒。你看不到任何东西。能推就推，客户端只在没有服务端能力时才自己扛。

Pi 直接退出这场博弈。摘要是一次性请求，几乎不会有第二次一模一样的调用。写缓存占额度、增加复杂度，收益接近零。于是设 cacheRetention:"none"，再配一个全新的 sessionId，把路由和主对话隔离开。一行配置，代码最短，也最干净。

这是三者复杂度差异的根源。Claude Code 为命中付出了三重额外机制。Pi 一行甩掉整个问题。Codex 折中加黑盒。

## 再看结构

会话是线性链还是树，决定了能不能保留探索过的分支上下文。这不是参数问题，是结构问题。

Claude Code 和 Codex 都是线性。简单，前缀缓存好做。切走的思路只能丢弃。没有“另一条分支”的概念，也就谈不上保留。

Pi 是唯一的树。你可以在多条思路间跳转。从分支 A 切到分支 B 时，它找最深公共祖先，从旧叶子沿 parentId 回溯，收集路径上的 entry，反转成时间序，生成 branchSummary，再注入新分支。新分支还“记得”旧分支探索过什么。线性结构在物理上就不支持这个能力。

切点选择也更精细。从最新消息往回累加估算 token，直到够 keepRecentTokens（默认 20k），再找最近的合法切点。user、assistant、bash、branchSummary、compactionSummary 都可以。tool_result 不行，必须紧跟对应的 tool call，否则 API 直接报配对错误。切点之前的消息拿去摘要，之后的原样保留。

## 最后是边界

压缩逻辑放在哪，谁能改，决定了产品定位和演进权。

Claude Code 是重客户端单体。微压缩、自动压缩、全量摘要、重建全部编译进去，用内部 feature flag 门控。普通用户改不了一行，也换不了压缩模型。摘要 prompt 是内嵌常量。全量压缩用 maxTurns:1，fork 会继承主对话全套工具。模型有时会手贱去调工具，一轮直接废。所以 prompt 开头用极强措辞把模型摁住：“工具调用会被拒绝，你会失败”。能力最全，但锁死。

Pi 是可插拔框架。generateSummaryWithUsage 把 model、apiKey、streamFn、customInstructions、previousSummary 全部做成参数。扩展可以传入任意模型（官方示例用便宜的 gemini-2.5-flash 压缩）、任意 prompt、任意流式实现。有 previousSummary 时自动切到增量更新。session_before_compact 和 session_before_tree 钩子可以取消，或者直接提供自定义摘要。控制权在用户手里。

Codex 按 provider 和 flag 分派。开了 TokenBudget 就纯丢弃，不摘要。否则如果 provider 支持远程压缩，走服务端（再按版本分 v1 或 v2 流式）。第三方 API 才走本地模型摘要。再加上客户端内部黑盒压缩，哲学就是能把重活推给自家后端就推。

## 选型

选型因此变得清晰。成本敏感、要极致缓存命中，用 Claude Code。要分支探索或二次开发，用 Pi。要深度集成自家后端、愿意接受黑盒推服务端，用 Codex。

参数只是表象。三个根本取舍才是本质。它们分别决定了你付多少钱、能保留多少探索路径、以及谁有权继续演进压缩本身。

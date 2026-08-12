---
title: "Claude Code、Codex 与 Grok Build 怎么处理 Skill 正文"
description: "Agent 靠 SKILL.md 扩展能力，但正文什么时候进上下文、压缩后会不会丢、丢了怎么重建，几家方案差异很大。从注入时机、消息格式、去重到压缩重建策略，拆解 Claude Code、Codex 和 Grok Build 的不同路线。"
date: "2026-08-13"
tags: ["Agent", "Skill", "Context", "Claude Code", "Codex", "Grok"]
readingTime: "6 min read"
---

Agent 现在普遍靠 SKILL.md 这种文件来扩展能力。文件开头是名字和一段描述，后面是具体指令和流程。描述用来判断什么时候该用，正文才是真正干活的部分。问题在于这些正文什么时候进上下文，压缩发生后会不会被丢掉，以及丢掉之后怎么重新塞回来。几家主流工具的处理方式并不一样。

压缩发生前，Claude Code、Codex CLI 和 ChatGPT 都会把已经加载过的 skill 正文留在当前会话里。真正拉开差距的是压缩那一刻和压缩之后的重建策略。

## Claude Code：启动一次，常驻到用完

Claude Code 的思路比较克制。会话一启动，就把所有 skill 的名字和描述塞进 system prompt。这份目录之后基本不动，压缩也不会重注。真正用到某个 skill 时，模型自己判断描述是否匹配，然后用 Bash 把完整 SKILL.md 读进来。读进来的正文会一直留在对话历史，直到整个 session 结束。默认情况下模型不会重复读取已经读过的文件。

压缩触发时才开始真正动手。单条 skill 正文有大约 5K tokens 的上限，所有 skill 正文加起来不超过 25K。超了就截断，只保留开头。超预算时最老的先丢。丢完之后，系统只会把实际被 invoke 过的 skill 正文重新塞回上下文。没被用过的 skill 只保留最初的名字和描述，不会再塞完整正文。目录本身是唯一不会在 compaction 时被重载的 startup 元素。session 内直接改 SKILL.md 也不会立刻生效，得开新 session 才能看到新版本。

## Codex：每 turn 刷新，显式控制

Codex 的处理更主动，也更频繁。目录不是启动时一次注完就完事，而是每 turn 重新渲染进 developer context。它有明确的预算，大约是模型 context 窗口的 2%，或者未知时 8K 字符。超预算会先缩短描述，再不够就把整 skill 从列表里省略，同时给用户警告。正文只在两种情况下注入，一种是用户显式提到（用 $skill 或者结构化输入），另一种是模型根据描述判断需要。

真正干活的是主机端一个叫 `build_skill_injections` 的函数。它不是模型能调用的 tool，而是 CLI 自己的内部逻辑。它先收集本 turn 被提到的 skill，然后把完整 SKILL.md 读出来，包装成一条 role 为 user 的消息，格式固定是

```
<skill>
<name>名字</name>
<path>绝对路径</path>
完整正文
</skill>
```

这条消息随后被写进对话历史，模型下一轮就能直接看到。同 turn 里如果多次触发同一条路径，会用一个叫 `InjectedHostSkillPrompts` 的 HashSet 去重，避免同一份正文被塞好几遍，白白烧 token。系统提示里还明确写了一句，不要跨 turn 继续带着 skill，除非用户重新提到。

压缩或者 rollback 发生时，历史会被 trim，然后重建 contextual developer content。已经注入的正文会跟着被摘要或者丢掉。下次要用，必须重新 mention，才会再走一遍注入流程。压缩几乎一定会打断 prompt cache 的前缀匹配，因为历史被整块替换成了 summary 加上特殊的 compaction 条目，前缀不再是精确延续。resume 旧线程时还有一个已知问题，模型看到的 skill 目录可能还是创建线程时的旧快照，UI 列表更新了，模型可见的清单却没跟上。

## ChatGPT：裁剪后重新注入

ChatGPT 的细节没有公开源码。能确认的是 context 超限之后会对 skill 正文做裁剪，只保留开头一部分，然后再重新注入。其他规则目前仍不清楚。

## Grok Build：兼容路线，按需读取

Grok Build 走的是另一条兼容路线。它从多个位置发现 SKILL.md，包括当前目录和仓库根下的 `.grok/skills`、用户目录下的 `~/.grok/skills`、插件自带的 skills，以及 Claude 和 Cursor 的兼容路径。启动时只暴露名字和描述做触发判断，完整正文按需加载。可以用斜杠命令显式调用，也可以靠描述自动匹配。它直接兼容 Claude 的技能格式，几乎不用改就能用。压缩后的具体重注细节目前没有像 Codex 那么公开的源码，但整体思路仍然是用到才加载，目录会随会话重建。

## 共同模式

这几套方案背后其实是同一件事。context 窗口有限，skill 又会越装越多。把所有正文永远挂在上下文里不现实，完全不注入又用不了。于是大家都在启动时只放轻量目录，真正用到再展开正文，压缩时再按自己的预算决定留多少。差别主要在注入时机、消息格式、去重方式和压缩后的重建策略。Claude 偏启动一次、常驻到用完，Codex 偏每 turn 刷新、显式控制，Grok Build 则更强调兼容和按需读取。

如果你在写 skill 或者选工具，关键就两件事。描述要写清楚触发条件，正文尽量控制长度。因为不管哪家，压缩之后能留下来的都有限。描述写得好，模型才知道什么时候该读；正文写得精，压缩时才不容易被砍掉关键部分。

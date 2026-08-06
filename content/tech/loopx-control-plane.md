---
title: "LoopX：把长程 Agent 从聊天上下文里拔出来"
description: "长上下文只让模型看到更多历史,回答不了控制问题。LoopX 是面向超长程 Agent 的 control plane:把过程状态外置到 Kernel、Domain State 和 Event Ledger,让连续数百小时的任务跑稳。"
date: "2026-08-06"
tags: ["Agent", "Control Plane", "LoopX", "架构"]
readingTime: "8 min read"
---

![LoopX](/images/loopx.jpg)

LoopX 是一个面向超长程 Agent 的 control plane。它解决的核心问题很直接:模型上下文有限,跨天甚至跨周的任务现场会分散到代码仓库、PR、CI、实验平台、用户反馈和权限关系里。长上下文只能让模型看到更多历史,回答不了"谁拥有当前事实、谁有权推进、这次调用是否形成可接受结果、现在该继续还是等待还是问人、中断后从哪里恢复"这些控制问题。所以必须把过程状态外置。

一次模型调用只完成一个有界 Turn。控制面负责把这些有界调用组织成可以持续推进、验证、等待和恢复的执行系统。目标是长程任务无人干预时能跑稳,有人干预时能跑好。真实轨迹已经连续跑过 220 小时和 272 小时以上,中间经历等待、人工反馈、模型切换和 resume,因果链仍然保持连续。

Turn 看起来重,是故意的。跨天任务里,一次调用必须同时完成读取正确事实、检查权限和 quota、执行有界动作、独立验证、写回并确认、决定下一步。把这些拆成多个轻薄调用,中间任何一次崩溃或模型切换都会让因果链断裂。重的是控制面,不是模型本身。模型每次只做一件事。

工作被做成可执行 Kanban。每张卡片不是普通 todo,它携带稳定 identity、role、priority、task class、claim 与 lease、required capability、write scope、decision scope 与 gate、successor 与 resume condition、evidence。移动卡片不是 UI 拖拽,而是一次受控 transition:观察事实、领域判断、Kernel 决策、有界执行、独立验证、持久写回、committed-state readback,最后产生 successor、wait、ask、replan 或 terminal。只有完整走完这条路径,状态才真正改变。

卡片不等于 session。卡片是持久工作单元,跨 session、跨模型、跨 host 存活。Session 或 Runtime 只是临时工人,每次只拿一个有界 Turn,干完就走,可以随时死、换、重启。上下文不够时,不移动卡片。状态已经外置在 Kernel、Domain State 和 Event Ledger 里。新 session 直接读取 committed state 加上新鲜外部事实,不需要复现旧 transcript。移动卡片的唯一合法理由是证据证明进度发生了。

和 Codex 的 /goal 相比,Codex 把 objective 和 goal lifecycle 外置,并在末端判断 complete 或 blocked,解决的是"别过早停"。LoopX 在此基础上继续外置过程状态:todo 工作图、authority、evidence、gate、quota、cadence、handoff 与 recovery。前者是目标生命周期管理,后者是完整 control plane,把"下一轮如何继续"变成结构化协议。

Goal 是整个主线战役的 durable identity。卡片是任务栏里的单个任务,不是整条主线。Work graph 描述任务之间的依赖、successor 和 supersede 关系。推进主线就是不断合法移动这些小卡片,同时保持 Goal 的acceptance 和 authority 边界。中断后只需要恢复 Goal 加上当前 frontier 的卡片状态。

这不是经典多 Agent 互相监控的系统。它是单 Kernel 加多 peer 执行。State Kernel 唯一拥有状态变更权。所有 todo 状态变化必须经过它。Capability Pack 只观察外部事实并翻译成 typed proposal,不能自己改状态。Peer 是临时工人,通过 claim 或 lease 领取一张卡片,执行有界动作后交回结果,不持有长期状态。continuous_monitor 是特殊卡片,到期后只做一次轻量观察,有变化才生成 successor 或 gate,无变化则 quiet backoff,不唤醒强模型。

State Kernel 只能通过受控 transition 自我更新。路径固定:外部观察或 peer 执行结果,经过 Capability 归一化成 proposal,Kernel 校验 authority、gate、quota 和 workspace,独立验证后写入 event ledger 和 active state,再 readback 确认。Capability Pack 运行时只提案,不写状态。它的演进走另一条受控路径:发现 capability gap,创建 feature todo,独立实现并验证,经过 owner gate 后注册新版本。Agent 自己写的新 Capability 不会自动获得生产权限。

一个 peer 不控制全局,也不负责更新外部观察。External Truth 由 GitHub、CI、实验平台自己拥有,LoopX 只读取。Capability 只做观察到提案的翻译。Kernel 是唯一决策与写状态的地方。Peer 只在被授权后执行有界动作。没有"一个 Agent 又执行又更新外部观察"的全能角色。权限和状态所有权被强制拆开。

这也不是"一个模块一个 Agent"的分工。模块是代码层,Peer 是可互换的临时工人。状态所有权始终集中在 Kernel。多个 Peer 可以并行 claim 不同卡片,只要 claim、lease 和 workspace 不冲突,但它们不拥有任何长期模块。

所有模块的更新只认两类数据:外部真实事实,以及已验证的执行结果加 evidence。External Truth 不被 LoopX 改写。Domain State 来自对 External Truth 的新鲜观察,经 Capability 提取紧凑事实(PR revision、check fingerprint、实验 lineage、metric receipt、artifact identity)后由 Kernel 写入。它只保留跨 Turn 仍有决策价值的连续性,原始大日志留在外部。Kernel 的写入必须走完整验证链路,模型输出或未验证的 tool success 全部无效。Projection(包括看板)是纯派生视图,从 source state 重建,改显示不会改真实状态。

Domain State 的数据获取路径就是外部系统到 Capability 再到 Kernel。看板只是 Projection。真实移动发生在 Kernel 和 Event Ledger。Domain State 提供"外部世界现在什么样"的输入,帮助 Kernel 决定某张卡片能不能、该不该移动。

Kernel 计算 runnable frontier 是确定性过滤,不是智能推荐。它把所有 todo 过一遍硬约束:priority、task class、decision scope、claim 与 lease 状态、capability availability、repository 与 write scope、dependency 与 resume condition。全部通过才进入 frontier。检查按固定安全顺序进行:先 identity 和 goal authority,再 user decision scope 和 self-repair,然后 capability 与 workspace,最后才看 frontier 与 continuation。顺序本身防止越权和写错仓库。Claim 减少重复劳动,lease 处理排他资源,gate 挡住用户未拍板的决定,dependency 确保前置条件满足。Peer 只能从这条 frontier 里领取卡片。

模型决定单步上限,控制面决定长期协作下限。LoopX 要解决的,就是让 Agent 连续工作数百小时之后,仍然知道目标边界、已经证明了什么、当前有什么权限,以及下一步该做什么。

- 项目:https://github.com/huangruiteng/loopx

---
title: "LLM-as-a-Coach 论文阅读"
description: "把 LLM-as-a-Judge 的 scalar reward 升级成 per-token 的经验蒸馏——不抽分数，抽经验。微软 LLM-as-a-Coach（arXiv: 2607.18110）论文笔记。"
date: "2026-07-28"
tags: ["LLM", "RL", "Distillation", "Paper Reading"]
readingTime: "7 min read"
---

RL 在数学题、代码这种可验证任务（verifiable tasks）上很好用——答案能判对错，reward 信号明确。但开放式任务没有标准答案，写文案、给建议、做总结这种，你没法说"这个回答等于 42，对"。这种叫 non-verifiable tasks。

传统做法是让一个模型当裁判（LLM-as-a-Judge），拿着评分标准（rubric）给回答打分。但裁判其实能说出很多细节——哪里好、哪里差、怎么改——RL 最后只抽一个分数（scalar reward），剩下的全扔了。两个回答都得 7 分，一个可能是"事实对但太啰嗦"，另一个可能是"文笔好但漏了关键信息"，模型分不出谁更好。说白了信息被压扁了。

从信息论角度算一下就更直观：

```
离散 1-10 分 reward:  log₂(10) ≈ 3.3 bits
bf16 reward head:     16 bits
1024 token 经验上下文:  1024 × log₂(150000) ≈ 17,600 bits
```

差了大概 1000 倍。当然不是每个 token 都是有效监督，但方向很清楚——**别把复杂反馈压成一个数字。**

这篇论文（LLM-as-a-Coach，arXiv: 2607.18110，微软出的）觉得这太浪费了。它的核心改动就一句：**不抽分数，抽经验。** 把裁判换成教练（LLM-as-a-Coach），教练不打分，而是写一段可迁移的经验（experiential knowledge）。不是针对这一条回答说"你这里错了"，而是总结"以后遇到类似问题应该怎么做"。比如"回答选购建议时先问预算和用途，不要一上来列参数表"。论文做了 ablation，结论是 distilled experiential knowledge > raw critiques > 直接用 rubrics。

具体流程五步：

```
1. on-policy rollout:     y ~ πθ(·|x)
2. coach 写经验:           e = Extract_Knowledge(M(x, y, R_x))
3. teacher 带经验答题:      π_teacher(·|e, x, y_<t)
4. 学生逐词蒸馏 (reverse KL)
5. 可选: iterative teacher update
```

优化目标是 minimize reverse KL divergence：

```
L(θ) = E[ (1/|y|) Σ_t D_KL( πθ(·|x, y_<t) ‖ π_teacher(·|e, x, y_<t) ) ]
```

注意是 reverse KL（πθ 在前），不是 forward KL。这意味着 policy 会倾向于覆盖 teacher 高概率的 token，但不会强制覆盖 teacher 低概率的 token，比 forward KL 更保守，减少 mode-covering 问题。这个信号是 per-token 的——每个词位置都有一个目标分布，而不是整段回答一个分数。**信号密度差了几个数量级。**

传统 RL 那边对比一下，优化目标是 maxθ E[r]，其中 r = Extract_Reward(M(x, y, R_x))，用 GRPO 实现。一个 response 一个数，梯度信号稀疏。EL 这边每个 token 位置都有梯度，密度高得多。

这里有个很巧妙的设计：**优等生不需要一开始就比学生强。** 它就是训练前的模型自己，参数完全一样，只是多了教练的经验作为 context。同样的模型，带着经验答题就会比不带好。打个比方，你和一模一样的你考试，你啥提示都没有，另一个你手里拿着老师的答题注意事项，能力一样但拿着提示的那个大概率答得更好。训练完之后经验内化进参数了，推理时不需要教练也不需要优等生。

优等生还能迭代升级（iterative teacher update）：学生学一轮变强了，下一轮用变强后的学生当新优等生，越滚越强。但要注意如果教练本身判断有偏差，迭代会放大这个偏差，所以得加 general-domain distillation 防止偏科。

很多人第一反应是这不就是 SFT 吗？看着像但有三个关键区别。SFT 用的是提前准备好的固定答案，EL 用的是模型自己生成的回答（on-policy）——反馈是动态的，模型弱的时候经验说"补基础"，强了之后说"优化细节"。SFT 是硬拷贝具体词（teacher forcing），**EL 是对齐概率分布（KL minimization），优等生不确定的地方学生不会硬学。** 最关键的是 SFT 的优等生不知道学生哪里弱，EL 的教练是先看了学生回答才写经验的，示范有针对性。

和传统 RL 比优势也很直观。RL 的分数是公开考核标准，模型很聪明会找捷径刷分（reward hacking）——裁判觉得"详细"给高分，模型就学会不管问啥都写一大堆。EL 要模仿的是一整套答题方式，很难找到固定捷径去骗。而且同样分数的回答在 EL 里能分出高下，因为教练针对不同回答写的经验不一样。泛化也更好，学的是方法不是刷分技巧。

偏差这事儿说实话两边都有，不管教练还是裁判背后都是同一个反馈模型 M。但打分的偏差更危险，因为 scalar reward 太粗糙，模型会钻空子——量化后的 r = Extract_Reward(M(x,y,R)) 丢掉了 M 输出里的文本信息，只留一个数，模型只能猜"怎么拿高分"，猜着猜着就猜到歪路上去了。经验的偏差没那么危险，因为 e = Extract_Knowledge(M(x,y,R)) 保留了高维文本信号，teacher 再把它转成 per-token 的 distributional supervision，模型要 hack 这个信号得同时骗过每个 token 位置的分布，成本高得多。偏差不能消除只能控制：控制迭代次数 + 通用任务蒸馏。

一句话：

> EL = RL 的 on-policy 反馈循环 + SFT 的蒸馏优化方式。

保留"模型从自己尝试中学习"这个核心优势，把反馈从 scalar reward 升级成 per-token distributional supervision。让模型在开放式任务上学方法，而不是刷分数。

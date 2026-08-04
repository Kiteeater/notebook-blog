---
title: "Credit Assignment is All You Need：长序列 Agent 训练里真正的瓶颈"
description: "长 horizon agent 训练里，涨点全靠运气、波动为主，很少出现 reasoning-RL 那种清晰上升曲线。真正的瓶颈不是算力，是 credit assignment。"
date: "2026-08-04"
tags: ["Agent", "RL", "Credit Assignment", "Infra"]
readingTime: "6 min read"
---

训练 reasoning model 时，即使输出很长，credit assignment 也几乎可以忽略。题目够难、group-size 够大、训练时间够久、训推 diff 低、entropy 不炸，效果就能稳定涨上去。一旦转到 agentic 任务——多轮行动、工具调用、环境交互——故事完全变了。各种 TITO、seq/token-level advantage、算法变种试下来，涨点全靠运气，波动为主，很少出现 reasoning-RL 那种清晰上升曲线。

## Credit assignment 到底是什么

Credit assignment 的意思很直接：最终只给一个成功或失败的奖励时，怎么把这份功劳或锅正确分给中间的每一步。短轨迹里问题不严重，靠大量 group sampling 能糊弄过去。长到 128k 甚至 256k、奖励又极度稀疏时，这个问题会变得致命。

正确样本里夹杂的错误行为会被一起鼓励；错误样本里其实正确的推理和工具调用路径会被无差别惩罚。结果就是模型输出质量断崖下跌，或者涨点完全随缘。

## 为什么以前的解法救不了

高质量 rubric 或 LLM-judge 能给中间步骤打细粒度分，但在这种长度下成本极高，会严重拖慢训练和验证。SAO 之前大家主要靠 group-sampling 硬撑：数据、recipe 看着都对的时候，只能继续加大 batch size 和每组采样数，用暴力换稳定。

就算 infra 把训推 diff 压得很低，开了算子对齐，也救不了。信号本身是脏的，资源再多也是在训练噪声。

## 解法：Partial Credit Assignment

解决思路是 partial credit assignment。不完全等最终结果，而是给中间步骤打部分分。只要做得不比 group-mean 还烂，就比没有强；质量越高，收益越大。

一个已经验证有效的做法是 **pivot**：先找到一个高价值的切割点（第一次明确出错的位置，或高 entropy 的分叉点），把前面的前缀固定住当作 prompt 重放，只对后缀重新采样和优化。

- 前缀的正确步骤不会被后面的错误连坐
- 错误的前缀也不会被错误地奖励
- 训练信号变得更干净
- 同时因为大量前缀被复用，训练速度也会更快

## 底层没有魔法

标准 RL 是整条轨迹共享一个最终奖励，所有 token 一起算 advantage 再更新参数。Pivot 把这个过程切开：

- 前缀冻结或梯度权重极低
- 只让后缀承担信用分配和参数更新

等价于把一条超长、奖励稀疏的 trace 拆成「已经发生的历史 + 当前需要决策的未来」。更进一步可以在切割点做 **tree-rollout**：从同一个前缀分叉出多条不同后缀，用对比信号估计更准的 advantage 或 Q-value。

## 为什么以前没人用

短序列或纯 reasoning 任务里，暴力堆量 marginal benefit 还够用，没人愿意多折腾。到了长 horizon agent，堆量的边际收益急剧下降，prefix-replay 的性价比才真正显现。

相关工作最近才密集出现，说明社区刚开始系统性正视这个问题，而不是继续假装「再多采一点就行」。

## 对 Infra 侧意味着什么

对推理 infra 侧的同学来说，含义也很直接。训练侧已经开始大规模用 prefix-replay 和部分轨迹重采样。KV cache、prefix caching、请求调度如果能更好支持「前缀固定、只续写后缀」，会直接帮到训练效率。

训推一致性依然重要，但已经不是当前最大瓶颈。最终上线效果波动大，很多时候不是 serving 的问题，而是训练信号本身在惩罚正确步骤、奖励错误步骤。

## 一句话

长序列 agent 训练本质上是一场资源效率的战争。与其无脑加大采样量硬刚，不如先把 credit 分对。信号干净了，同样的资源能换来更稳定的涨点。

## 更进一步：算力充足时的更优解

但整体上，如果算力比较高，做 tree-rollout，选 pivot-node（比如 `[4]`，再结合 LLM-judge），做后续的 rollout，估计 Q-value 等等，也能得到比较 solid 的 pivot-turn 的选择，会是更好的选择。

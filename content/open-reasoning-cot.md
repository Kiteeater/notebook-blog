---
title: "国模 Open Reasoning"
description: "CoT 是学霸的草稿纸，不是答案旁边的废话。从 open-reasoning 仓库说起，聊聊 CoT 蒸馏的真正价值，以及 SFT 和 RL 的区别。"
date: "2026-07-28"
tags: ["LLM", "CoT", "Reasoning", "RL"]
readingTime: "8 min read"
---

今天看的这个 open-open-reasoning，最开始以为是把 Claude 的隐藏 CoT 直接解密出来了。后来捋了一下，应该不是这么回事。

Claude 的 hidden thinking / CoT 一般会被加密或签名封装，密钥在 Anthropic 服务端，本地基本拿不到。所以这个仓库如果属实，核心不是"本地破解加密"，而是把 Anthropic 返回的 `thinking.signature` 再塞回 Anthropic API，让 Anthropic 服务端自己解封，然后再通过 prompt 诱导模型把解封后的 hidden reasoning 复述出来。

所以不是"大模型自己解密自己的 CoT"。模型本身应该没有密钥，真正解密的是 provider runtime / gateway / 服务端。模型只是后来接触到了被恢复出来的内容，然后被诱导说出来。

这比普通 prompt hack 更微妙。普通 prompt hack 是骗模型说不该说的话；这个更像是拿一个内部状态 token，让有钥匙的服务端帮你 unseal，再通过 prompt 把内容外带出来。**prompt 是最后的触发器，真正敏感的是 API / harness 的边界设计。**

如果 `thinking.signature` 本来是内部状态，那它就不应该被不可信客户端随便持有、随便 replay，更不应该 replay 之后让模型能把里面的内容复述出来。这个点才是真正危险的地方。

CoT 为什么值钱？最简单说，**CoT 就是学霸的草稿纸。**

普通 final answer 只告诉你"答案是 42"。CoT 会告诉你"我先排除了 A 和 B，发现 C 是陷阱，然后用这个公式算，最后检查了一遍，所以答案是 42"。

所以 CoT 不是答案旁边的废话，而是模型的中间计算轨迹，也就是 reasoning trace。里面可能包括怎么拆题、怎么搜索解法、哪些路是错的、哪些约束要检查、怎么自检、怎么回退。agent 场景里还可能有怎么规划任务、怎么调用工具、怎么处理失败。

拿到 CoT 后，模型看起来能力会突然变强，不是因为模型权重现场进化了，而是它拿到了强模型已经算过一遍的草稿。说白了，不是自己从零想，而是直接看高手怎么想。

专业一点说，CoT 至少有三个价值。

**第一是 search cache，搜索缓存。** 难题最难的不是最后答案，而是怎么找到路。CoT 已经记录了强模型搜索过的路线，后面的模型不用重新试一堆错路，可以直接沿着强模型的路线走。它给的不只是终点，还有导航路线。

**第二是 process supervision，过程监督。** 普通 SFT 学的是 final answer：老师答案是什么，我就学什么。CoT 蒸馏学的是 reasoning process：老师每一步怎么想、怎么排除、怎么检查、怎么修正。这个训练信号比单纯问答值钱很多，因为模型不只是学结果，而是在学解题算法。这就是 reasoning distillation / CoT distillation 的核心。

**第三是 in-context demonstration，上下文示范。** 就算不拿去训练，只是把 CoT 放进当前上下文，也会增强模型表现。因为它变成了一个很强的 few-shot example，告诉模型这类问题应该怎么拆、怎么推、怎么检查。这叫 in-context learning / in-context adaptation。模型权重没变，但当前这次回答会变强，因为上下文里已经有高手草稿了。

所以厂商不想泄露 raw CoT，不只是因为里面可能有隐私，也因为它本身很值钱。

raw CoT 可能泄露用户隐私、system prompt 痕迹、tool observation、harness 设计、安全策略、模型内部偏好和错误模式。更关键的是，它是很好的 distillation data。大量强模型 CoT 就是大量高手草稿纸，拿去训练小模型，小模型就可能越来越像强模型。

> final answer 像成品菜，CoT 像菜谱、火候、踩坑经验。泄露 final answer 只是泄露一道菜，泄露 CoT 是泄露做菜方法。

然后是 SFT 和 RL 的区别。

**SFT 是模仿老师，RL 是自己试错拿分。** SFT 优化的是"我的输出像不像老师"，RL 优化的是"我的行为最后有没有赢，有没有拿高分"。

所以 SFT 像抄学霸作业，RL 像自己上考场做题。做错扣分，做对加分，最后真的练会。

如果全靠蒸馏 SFT，确实可能把 RL 架空。因为 SFT 太重会让模型太像老师，形成很强的行为惯性。老师一般这么写，那我也这么写。这样 policy entropy 会下降，探索空间会变小。模型不爱试新路线，也不容易发现新策略。

CoT 蒸馏还有一个问题是，模型可能学到的是"推理外观"，不一定是真推理能力。比如它很会写"首先""我们逐步分析""检查边界条件""因此答案是"，看起来很会想，但可能只是 reasoning style imitation。**RL 的价值是它不管你说得像不像，只看最后有没有做对、有没有拿分。**

另外，老师的 CoT 也不是绝对真理。老师有自己的风格、偏好、捷径、错误模式。全靠老师数据蒸馏，学生会被锁在老师策略附近。这就是 behavior cloning bottleneck。学生最多学得像老师，很难超过老师。

SFT 和 RL 的目标函数也不一样。SFT 是 imitation objective，模仿数据分布。RL 是 reward objective，最大化 reward。如果 SFT 太重，模型就会被"像老师"这个目标拽住，后面的 RL 想把它改成"更会赢"的策略就会更难。

所以比较合理的训练路线一般是：先用 SFT / 蒸馏打底，让模型知道基本套路；再用 RL / verifier / reward 继续优化，让模型不只是像高手，而是真的能拿分、能恢复、能探索。

一句话就是：

> SFT 决定起手式有多漂亮，RL 决定打持久战能不能赢。

再说 Kimi。Kimi 这种模型如果 one-shot 很强，通常说明它已经在训练里见过大量高质量范式。比如高质量答案、高质量 CoT、代码任务轨迹、agent 轨迹、benchmark 题型、工具调用模式、常见问题拆解方式。

所以它不是现场慢慢试错，而是已经把很多高手解法套路压进权重里了。one-shot 强，本质上就是模型脑子里已经背了很多高手解法范式。这很像 SFT / distillation / imitation learning 的贡献。

如果一个模型打榜分高、one-shot 强、token 又少，也能从这个角度解释。很多长推理可能已经在训练阶段被压缩进权重了。别人考试要写一大页草稿，它看一眼题就知道是哪类题、该用哪个套路、哪里有坑、怎么最短路径拿分。

也就是说，**训练时花过的 CoT，推理时不一定要完整展开。** 老师当年推导十页，学生背熟以后，考试可能三行就写完。token 少不一定说明它没推理，可能是推理过程已经被 distill / compress 到 model weights 里了。

但也不能因此说 RL 不重要。SFT / 蒸馏让模型起手准、one-shot 强、输出短、很会匹配题型、很像高手。RL / search / verifier 更影响长程任务、多轮 agent、失败恢复、自检、探索，以及真正复杂任务里的稳定性。

所以 Kimi 这种"榜单高、one-shot 强、token 少"的风格，我会倾向判断：它的可见能力里，高质量 SFT / 蒸馏 / agent trajectory imitation 占了很大比例。但这不等于 RL 没用。更准确说，**SFT 把高手套路压进权重，RL 负责让它在复杂环境里更会赢。**

最后压缩一下：

CoT 是学霸草稿纸，不是废话。final answer 是答案，CoT 是解题算法。

open-open-reasoning 如果属实，关键不是本地破解加密，而是把 `thinking.signature` replay 回 provider，让 provider 解封，再诱导模型复述。

**SFT / 蒸馏**像抄高手作业，可以让模型 one-shot 很强、token 很少、起手很准。

**RL** 像自己上考场试错拿分，可以让模型更会探索、更稳、更能处理长任务。

所以 Kimi 这种榜单高、one-shot 强、token 少，很可能说明大量能力已经通过 SFT / 蒸馏 / 高质量轨迹压进权重里了。

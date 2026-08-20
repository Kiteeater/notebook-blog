---
title: "Agent 死循环防护：状态哈希比 max turns 更关键"
description: "Agent 在生产里失控，往往不是通信问题，而是死循环。模型没有跨步骤的自我认知，只会在同一状态上反复空转烧 token。max steps 只是安全网，状态哈希才能做早期熔断：把决策相关字段序列化后算 sha256，历史命中即判定无进展。"
date: "2026-08-20"
tags: ["Agent", "死循环检测", "状态哈希", "LLM", "工程实践"]
readingTime: "6 min read"
---

Agent 项目里消息队列的核心价值是异步解耦和可靠投递。Agent 之间、Agent 与工具之间不用互相等待，消息持久化后崩溃也不丢，突发任务可以先堆在队列里慢慢消化。没有它，系统很容易变成同步调用地狱。

真正让 Agent 在生产里失控的，往往不是通信问题，而是死循环。模型每一步只看到当前上下文，没有跨步骤的持久自我认知。它不知道自己已经在同一状态上转了十几圈，只会继续调用工具、继续反思、继续烧 token。

打断死循环是客户端的责任，不是模型的责任。最基础的手段是硬性 max steps。没有上限的 Agent 框架直接是残废的。但 max steps 只是安全网，作用有限。Agent 完全可以在远没撞到上限之前，就已经在同一动作上反复空转，把预算烧掉大半。

更有效的检测是状态哈希。把真正影响下一步决策的信息抽出来，包括当前目标、最近几步的 action 与 observation、关键 memory，序列化成确定性字符串，再算 sha256。如果新算出的哈希和历史窗口里已经出现过的某个哈希相同，说明状态没有任何实质进展，却还在继续跑。这就是死循环的典型信号，直接强制终止。

只哈希决策相关字段。时间戳、随机数、完整历史对话全部丢掉，否则噪音太大。维护一个滑动窗口记录最近的哈希，连续相同或历史命中就判定循环。连续判定比单次命中更可靠，避免偶发巧合。

一个最小可用的实现大致如下：

```python
import hashlib
import json
from collections import deque

class LoopDetector:
    def __init__(self, max_history=20, consecutive_threshold=2):
        self.history = deque(maxlen=max_history)
        self.consecutive = 0
        self.threshold = consecutive_threshold
        self.last_hash = None

    def _make_state(self, goal, recent_steps, memory=None):
        state = {
            "goal": goal,
            "recent_steps": recent_steps[-6:],
            "memory": memory or ""
        }
        return json.dumps(state, sort_keys=True, ensure_ascii=False)

    def compute_hash(self, goal, recent_steps, memory=None):
        state_str = self._make_state(goal, recent_steps, memory)
        return hashlib.sha256(state_str.encode("utf-8")).hexdigest()

    def check(self, goal, recent_steps, memory=None):
        h = self.compute_hash(goal, recent_steps, memory)
        if h == self.last_hash:
            self.consecutive += 1
        else:
            self.consecutive = 1
        self.last_hash = h
        self.history.append(h)
        if self.consecutive >= self.threshold or self.history.count(h) > 1:
            return True
        return False
```

每一步执行前调用 check，命中就抛异常或强制退出。检测到循环时把触发的状态打印出来，方便后续调试。

大部分 coding agent 都实现了 max turns，这是最低配保护。完整的状态哈希或工具调用指纹重复检测并不是标配。认真做生产级的开源实现（比如 OpenHands 的 Stuck Detector）会做 action-observation 重复、ping-pong 模式、相同错误循环等检测。很多商业或早期实现只靠步数上限，死循环照样能在限制内把资源耗尽。

max turns 是必要的天花板，但不是好用的检测手段。它只防止无限烧钱，无法在早期发现"没有进展"。正确的做法是两者叠加：max turns 做硬保底，状态哈希做早期熔断。任何没有硬性终止条件的循环，最终都会耗尽资源。Agent 也不例外。

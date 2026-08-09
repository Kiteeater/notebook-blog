---
title: "Claude Prompt Caching 到底在缓存什么"
description: "Prompt caching 缓存的不是文本,而是 Prefill 阶段算出的 KV 张量。理解断点、TTL、层级失效和前缀稳定性,比会调几个参数更重要。"
date: "2026-08-08"
tags: ["Claude", "Prompt Caching", "LLM", "推理优化"]
readingTime: "8 min read"
---

大模型推理时最贵的一步往往是 Prefill。你把整段 prompt 喂进去,模型要给每一个 token 算出 Key 和 Value,存进显存。这段计算量大致随长度平方增长。后面真正一个个生成回答的 Decode 反而便宜得多。

Attention 是因果的。第 500 个 token 的 Key 和 Value 只依赖前面 1 到 499 个 token,永远不依赖后面的东西。所以只要下一次请求的前缀和上一次完全一样,已经算好的 KV 就可以直接复用。中间改一个空格、一个标点、一个工具参数,后面所有 Key 和 Value 全部作废。

这不是产品设计上的便利,而是注意力机制本身带来的物理约束。Anthropic 把这件事做成了公开的操作语义。客户端用 `cache_control` 告诉服务端"缓存到这里",服务端按固定规则写、读、淘汰。理解这套语义,比会调几个参数更重要。

请求体按固定顺序拼成一条长序列。最先是 tools 数组,里面是 Agent 能调用的所有工具定义。接着是 system,放角色设定和固定指令。最后是 messages,装着从对话开始到当前的全部历史,包括用户问题、模型回复、工具调用和工具结果。

服务端只认这个顺序。缓存的是从请求开头到某个断点的完整前缀,必须字节级完全一致。它存的是前缀的哈希和对应的 KV 张量,不存原始文本。匹配失败时,不会模糊查找相似内容,只会从断点位置往前最多回溯二十个 block,看有没有之前写过的更短前缀可以命中。

一个完整的请求大致长这样。

```python
response = client.messages.create(
    model="claude-opus-5",
    max_tokens=1024,
    tools=[
        {
            "name": "get_weather",
            "description": "获取指定城市的天气",
            "input_schema": {
                "type": "object",
                "properties": {
                    "location": {"type": "string"}
                },
                "required": ["location"]
            }
        },
        {
            "name": "get_time",
            "description": "获取指定时区的当前时间",
            "input_schema": {
                "type": "object",
                "properties": {
                    "timezone": {"type": "string"}
                },
                "required": ["timezone"]
            },
            "cache_control": {"type": "ephemeral"}
        }
    ],
    system=[
        {
            "type": "text",
            "text": "你是一个有用的助手。优先使用工具获取真实信息,不要编造。",
            "cache_control": {"type": "ephemeral"}
        }
    ],
    messages=[
        {
            "role": "user",
            "content": "北京天气怎么样?现在几点?"
        }
    ]
)
```

tools 排在最前面,最后一个 tool 上挂了 `cache_control`,整个 tools 前缀就会被缓存。system 写成数组,里面的 text block 也挂了 `cache_control`,system 同样被缓存。messages 里只有当前用户问题。如果是多轮,这里会装完整历史。

messages 的 content 可以是字符串,也可以是 block 数组。字符串只是简写,等价于一个 text block。常见的 block 类型有 text、image、document、tool_use、tool_result。多轮时大致会变成这样。

```python
messages = [
    {
        "role": "user",
        "content": "帮我查一下北京天气"
    },
    {
        "role": "assistant",
        "content": [
            {
                "type": "tool_use",
                "id": "toolu_01A",
                "name": "get_weather",
                "input": {"location": "北京"}
            }
        ]
    },
    {
        "role": "user",
        "content": [
            {
                "type": "tool_result",
                "tool_use_id": "toolu_01A",
                "content": "北京当前 28°C,晴"
            }
        ]
    },
    {
        "role": "user",
        "content": "现在几点了?"
    }
]
```

断点有两种打法。一种是在 `messages.create` 最外层加 `cache_control`,服务端自动把断点放到最后一个可缓存的 block 上,对话变长时断点会跟着往后移。

```python
response = client.messages.create(
    model="claude-opus-5",
    max_tokens=1024,
    cache_control={"type": "ephemeral"},
    system="你是一个有用的助手……",
    messages=[{"role": "user", "content": "北京天气怎么样?"}]
)
```

另一种是显式写在具体 block 上,最多可以同时打四个。想要一小时存活时间就写成 `{"type": "ephemeral", "ttl": "1h"}`。

多断点的意义不在于把缓存拉得更长,而在于让变化频率不同的部分有独立的生命周期。tools 几乎从不变更,可以单独断。固定角色设定很少变更,可以单独断。会定期更新的知识库可以单独断。对话历史每轮都在增长,也可以单独断。知识库更新时,只失效后面的部分,前面稳定的 tools 和角色设定仍然命中。自动缓存只有一个断点,绑在最后,前面的稳定内容也会被迫跟着重算。

第一次请求时,服务端会完整做 Prefill,在断点位置把从开头到断点的 KV 和哈希写下来。响应里的 `cache_creation_input_tokens` 会接近被缓存的前缀长度,`cache_read_input_tokens` 是零,`input_tokens` 只剩断点之后的新内容。第二次用完全相同的前缀再发,服务端直接加载已经算好的 KV,跳过这部分 Prefill。此时 `cache_read_input_tokens` 会变大,`cache_creation_input_tokens` 接近零。

TTL 是缓存条目的存活时间。默认五分钟,可选一小时。计时从写入或命中的那次请求开始。命中会刷新计时。回答本身消耗的时间也算在 TTL 里。一次回答如果花了四分钟流式输出,你必须在结束后大约一分钟内发出下一次请求,否则缓存可能已经过期。一小时的写成本更高,适合间隔较长但会反复使用同一前缀的场景。

最小可缓存长度随模型不同,大致从五百多到四千多 token。低于阈值时请求照样成功,但完全不写缓存,也不报错。唯一可靠的验证方式是看响应里的 usage 字段。

```python
print(response.usage.cache_creation_input_tokens)
print(response.usage.cache_read_input_tokens)
print(response.usage.input_tokens)
```

两个 cache 字段都是零,说明根本没生效。要么前缀太短,要么前缀在两次请求之间发生了肉眼不易察觉的变化。

工具特别容易搞砸缓存。tools 排在最前面,任何一个 tool 的 name、description、参数定义改动,或者数组顺序变了,或者中途增删,整个前缀从根上作废。官方解法是 defer_loading。带这个标记的工具不进入初始前缀,模型需要时通过 tool search 发现,定义以 tool_reference 的形式追加到对话历史里。前缀本身没变,缓存继续命中。

Claude Code 把整个 harness 围着前缀稳定性设计。静态 system 和 tools 放最前,项目级上下文其次,会话上下文再次,对话消息最后。中途不改 tools 集合,不改 system 来注入时间或文件变更,而是把更新塞进 messages。模型切换和 effort 切换都会导致缓存重建,因为缓存是按模型隔离的。子任务或 compaction 时必须复用父请求完全相同的 system 和 tools 前缀,才能命中。

第三方推理引擎很多实现了通用的 prefix 或 radix 缓存,但往往缺少显式断点、精确 TTL、层级失效和客户端可控的写点。按官方语义写的客户端发过去,命中率会明显下降,行为也不可预期。这就是为什么有人会说"第三方服务端不支持这套语义就会很难受"。

自己发两次请求验证一次。第一次带长 system 和 cache_control,第二次用完全相同的 system 换一个用户问题。看第二次的 cache_read 是否接近第一次的 cache_creation。故意改一个标点再发,确认全部 miss。故意把前缀弄得很短,确认两个 cache 字段都是零。做完这几步,机制就真正进脑子了。

官方文档和 Claude Code 团队的工程复盘已经把这套语义写得很清楚。真正卡住的地方通常不是概念,而是前缀在不知不觉中变了,或者服务端根本没有完整实现这套操作语义。盯 usage 字段,比任何二次解读都快。

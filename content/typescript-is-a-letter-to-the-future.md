---
title: "TypeScript 的类型是给未来的信"
description: "类型系统不是给编译器看的，是给三个月后的自己看的。"
date: "2026-06-28"
category: "Programming"
tags: ["TypeScript", "类型系统", "工程"]
readingTime: "5 min read"
---

很多人把 TypeScript 的类型当成「给编译器看的注释」，写完能跑就行。这是低估了它。

## 类型是契约

一个函数签名，是一份契约：

```ts
type FetchUser = (id: string) => Promise<User | null>;
```

它告诉调用方三件事：

- 你要给我一个 `string`。
- 我会给你一个 `Promise`。
- 里面可能是 `User`，也可能是 `null`——**你必须处理 null**。

最后那条最关键。`| null` 不是装饰，是**强制提醒**：这里有可能失败，别假装不会。

## 给未来的信

类型系统真正服务的对象，不是现在的你，而是**三个月后的你**，以及接手代码的同事。

当你改了一个字段的名字，类型系统会立刻告诉你所有受影响的地方。没有它，你只能全局搜索 + 祈祷。

> 动态类型省下的写类型的时间，会在调试时十倍还回来。

## 别滥用 any

`any` 是类型的逃生舱。偶尔用一次无妨，但成片的 `any` 等于放弃了类型系统所有的保护。

```ts
// 坏：什么都可能
function process(data: any) { ... }

// 好：明确边界
function process(data: unknown) {
  if (!isUser(data)) throw new Error("invalid");
  ...
}
```

`unknown` 比 `any` 诚实——它承认「我不知道这是什么」，并逼你先验证再使用。

## 所以

认真写类型，不是矫情，是对未来负责。你今天写下的每一个类型，都是在帮三个月后的自己少加一次班。

# Agent Note: 保存的模型目录必须保留推理档位

Status: implemented

[English](2026-08-20-saved-model-catalog-must-keep-reasoning-efforts.md) | 中文

## 问题

在顶层 provider 段（Tencent CodeBuddy）添加模型时，UI 会把每个默认 catalog 行物化进 draft，携带每行的 `reasoningEfforts` dict。客户端反序列化的 schema 可能拒绝该 dict（Host 与客户端之间的序列化 schema 漂移），因此 `validateDraft` 使保存失败，尽管 Host 自己的 schema 接受该值。

早期修复从 draft 行中剥离 `reasoningEfforts` 并保存剥离后的副本。这使保存成功，但静默禁用了被替换目录中每个模型的推理：保存的 catalog 不再声明档位阶梯，因此 composer 不再为这些模型提供档位。

## 决策

剥离后的副本**仅作为客户端校验辅助**。保存路径校验剥离后的 draft 以判断 Host 是否会接受写入，但持久化的是**未剥离**的 draft（`save(next)`），因为 Host 的权威 schema 接受完整 dict，而从保存的 catalog 中剥离 `reasoningEfforts` 会静默禁用被替换的每个模型的推理。

另外，在 Tencent 卡片上添加的行通过 `newRowDefaults` prop **种子化** image input 和完整推理档位阶梯（`low`…`max`），因此手动添加的模型可以实际使用这两种能力，而不是什么都不继承。

## 考虑的替代方案

- **剥离并保存剥离后的副本**：否决 —— 会静默禁用被替换目录的推理（本 note 修复的 bug）。
- **无客户端校验回退**：否决 —— 误报会完全阻塞保存；剥离后的副本是判断 Host 是否接受写入的最廉价可靠信号。

## 后果

- 向 Tencent（或任何顶层 provider 段）添加模型会保存完整的 catalog 行，保留 catalog 携带的每个能力字段。
- 新的 Tencent 行生来就带 image input 和完整推理阶梯，立即可用。
- 剥离后的 draft 校验保留为客户端门禁；Host 的 schema 仍然是持久化内容的权威。

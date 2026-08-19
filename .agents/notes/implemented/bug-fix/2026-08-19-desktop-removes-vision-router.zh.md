# Agent Note：桌面 Profile 不再包含外部 vision router

Status: implemented

[English](2026-08-19-desktop-removes-vision-router.md) | 中文

## Problem

桌面应用把 `dsh-vision-router` 作为安装方维护的 profile bundle 和生产依赖交付。桌面组合已经具备内置附件与浏览器能力，外部 router 并非启动或默认模型流程所必需。保留它会扩大打包依赖闭包，并使每份既有桌面 profile 在应用更新后继续保留该插件。

## Decision

桌面 manifest 与 `PROFILE_TEMPLATES.desktop` 不再包含 `dsh-vision-router`。Profile 规范化识别两种旧的安装方维护桌面元组：同时包含 `dsh-browser` 与 `dsh-vision-router` 的元组，以及后来只包含 `dsh-vision-router` 的元组。两者都会迁移到当前模板，同时保留 `dsh-better-sidebar`。

任何其他 bundle 列表仍视为用户自有配置，不会被重写。

## Alternatives considered

**只移除包依赖。** 拒绝，因为既有默认 profile 仍会引用缺失 bundle，并在解析 profile 时失败。

**重写所有包含该插件的桌面 profile。** 拒绝，因为修改过的 bundle 列表属于用户；移除用户选择的插件会破坏 profile 所有权。

## Consequences

新建桌面 profile 不再安装或加载 `dsh-vision-router`。既有默认桌面 profile 会在下次加载时移除它。主动修改过 bundle 列表的用户保留其配置，并可继续显式安装该插件。

## Verification

app-boot profile 测试覆盖初始化和两种旧元组。Windows 包会检查部署根中不再存在该外部包及其锁文件解析项。

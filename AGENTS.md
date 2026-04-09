# AGENTS

## Release Notes

- 任何代码变更在推送前都必须递增版本号。
- 版本号变更是当前 release 流程的触发条件；如果只推代码、不更新版本号，GitHub Actions 不会触发构建和发布。
- 最低要求：在推送包含代码变更的提交前，同步更新 `package.json` 中的 `version` 字段。
- release 由 `package.json` 中的版本号驱动；不要再把手动创建 git tag 当作发布入口。

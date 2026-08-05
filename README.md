# effect.douyin

抖音特效（Effect Creator）项目集合。一个特效一个子目录。

---

## 目录

| 特效 | 状态 | 说明 |
|------|------|------|
| [SampleMathProblem](SampleMathProblem/) | 🔲 起步 | 摇头口算大挑战。开发手册已写完，工程仍是空场景，见 [README](SampleMathProblem/README.md) |

## 规划中

来自 `IDEA/想法.txt` 的方向：

| 想法 | 备注 |
|------|------|
| 早餐 / 中餐 / 晚餐 | — |
| 小学 / 初中 / 高中 / 大学 算数 | SampleMathProblem 是这个方向的起点 |
| 补诗词 | — |
| 补歌词 | — |

---

## 约定

**新增一个特效** = 在根目录建一个同名文件夹，不用改任何配置。

**编码**：文本文件一律 UTF-8。Windows 记事本默认可能存成 GBK，
那样在 GitHub 网页上会显示乱码 —— 用 VS Code 编辑可避免。

**不入库**：`Library/`（编辑器缓存）、`*-lock`。
详见 [.gitignore](.gitignore)，里面也标明了哪些**必须**入库。

---

## 换台电脑怎么开工

```bash
git clone https://github.com/masifan200/effect.douyin.git
```

用 **像塑** PC 端（工程内部标识 `Douyin AR`，官网 effect.douyin.com）打开子目录里的
`effect.dyehpj`。当前工程基于 **9.1.3**，脚本用 JavaScript
（`require('amazingpro.js')`，不是 Lua）。

## 分支约定

| 分支 | 用途 |
| ---- | ---- |
| `main` | 主干，保持随时可用 |
| `feature/*` | 开发新功能时临时开，合并回 `main` 后删除 |

发布用 tag 标记（如 `v1.0`），不设长期发布分支。

四个仓库（本仓库、`IDEA`、`gradient-puzzle`、`puppet-show`）用同一套约定。

---

## 与其他项目的关系

抖音特效走的是**特效开放平台 / 剪映**那条线，是给特效创作者的工具链，
和小游戏是两套完全不同的技术路径 —— 小游戏侧拿不到特效平台的能力，
反之亦然。所以这个仓库和 `puppet-show`（微信小游戏）不共用代码。

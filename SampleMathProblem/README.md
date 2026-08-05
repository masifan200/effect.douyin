# 摇头口算大挑战 — 抖音互动特效开发手册

> 人脸姿态识别 + 随机题库的互动答题特效：正对镜头自动出题，左右摇头选择答案。

| 项目 | 说明 |
| ---- | ---- |
| 工程目录 | `SampleMathProblem/` |
| 创作工具 | 像塑 PC 端（工程内部标识 `Douyin AR`），Windows / Mac 通用，官网 effect.douyin.com |
| 工具版本 | 9.1.3（见 `effect.dyehpj` 的 `version` 字段） |
| 脚本语言 | JavaScript（CommonJS，`require('amazingpro.js')`） |
| 特效类型 | 人脸姿态识别互动答题 |
| 目标场景 | 抖音合拍短视频、平台特效激励、亲子教育类趣味玩法 |

**当前工程状态**：空白模板。`Assets/main.scene` 无任何组件，`Graph/graph.json` 仅有默认的 `Update` / `OnStart` 事件节点。下文第二、三、四章即为从零搭建的完整步骤。

---

## 目录

1. [项目概述](#一项目概述)
2. [工程初始化与 UI 搭建](#二工程初始化与-ui-搭建)
3. [核心脚本](#三核心脚本)
4. [摇头交互与参数调试](#四摇头交互与参数调试)
5. [真机预览调试](#五真机预览调试)
6. [发布上线](#六发布上线)
7. [避坑清单](#七避坑清单)
8. [拓展升级方案](#八拓展升级方案)
9. [附录：运营与变现参考](#附录运营与变现参考)

---

## 一、项目概述

### 1.1 核心玩法

1. 特效启动后自动生成 **1~100 以内的加减法算术题**，减法强制大数减小数，杜绝负数；
2. 画面分为：顶部算式展示区 + 下方 3 个答案选项（1 个正确答案 + 2 个错误答案）；
3. 交互方式：
   - 头部**左转** → 选中左侧答案
   - 头部**正对屏幕** → 选中中间答案
   - 头部**右转** → 选中右侧答案
4. 答题后弹出「正确 ✓ / 再试一次 ✗」文字提示，1.5 秒后自动刷新新题目；
5. 内置 2 秒答题冷却，防止头部轻微晃动造成误触。

### 1.2 产品定位

市面上同类摇头特效多为固定文案的选择题，本项目使用**动态随机题库**，可无限出题重复游玩。亲子打卡、育儿类短视频适配度高，同质化低。

### 1.3 前置准备

1. PC 端安装「像塑」创作工具（effect.douyin.com）；
2. 抖音账号完成实名认证（用于特效上线与收益提现）；
3. **无需任何外部图片素材** —— UI 全部由内置文字组件搭建，无版权风险。

---

## 二、工程初始化与 UI 搭建

### 2.1 新建工程

打开像塑 → 新建项目 → 选择「人脸互动特效」模板。
（若继续使用本工程，直接双击 `effect.dyehpj` 打开即可。）

### 2.2 场景文字组件

在场景中依次创建以下 6 个文本组件，层级从上至下摆放：

| 组件名称 | 类型 | 摆放位置 | 功能说明 | 初始状态 |
| ---- | ---- | ---- | ---- | ---- |
| `Text_Question` | 文本组件 | 画面顶部居中 | 展示加减算式 | 显示 |
| `Text_Ans1` | 文本组件 | 画面左下角 | 左侧答案选项 | 显示 |
| `Text_Ans2` | 文本组件 | 画面底部居中 | 中间答案选项 | 显示 |
| `Text_Ans3` | 文本组件 | 画面右下角 | 右侧答案选项 | 显示 |
| `Text_Right` | 文本组件（绿色） | 画面中部 | 答对提示：`正确 ✓` | **隐藏** |
| `Text_Wrong` | 文本组件（红色） | 画面中部 | 答错提示：`再试一次 ✗` | **隐藏** |

> 组件名称必须与上表完全一致，脚本按名称查找组件。

### 2.3 状态变量

| 变量名 | 类型 | 初始值 | 作用 |
| ---- | ---- | ---- | ---- |
| `trueAns` | 整数 | 0 | 本题正确结果 |
| `pos` | 整数 | 0 | 正确答案所在位置：1 左 / 2 中 / 3 右 |
| `cd` | 浮点数 | 2.0 | 答题冷却剩余时间（秒） |
| `refreshTimer` | 浮点数 | -1 | 出下一题的倒计时，-1 表示未启动 |

- **脚本方案**（3.1）：这些是脚本类的成员变量，无需在面板中创建；
- **可视化方案**（3.2）：需要在可视化编程面板中逐个新建为全局变量。

---

## 三、核心脚本

### 3.0 脚本环境说明

像塑 9.x 的脚本组件使用 **JavaScript**（CommonJS 模块），引擎 API 通过 `require('amazingpro.js')` 获取：

```javascript
const APJS = require('amazingpro.js');
```

本项目用到的 API 一览：

| 用途 | API | 说明 |
| ---- | ---- | ---- |
| 脚本基类 | `APJS.ScriptComponent` | 继承它并实现生命周期方法 |
| 启动回调 | `onStart()` | 特效启动时执行一次 |
| 每帧回调 | `onUpdate(dt)` | `dt` 为距上一帧的秒数 |
| 设置文本内容 | `textComp.str = "..."` | `Text` 组件的字符串属性 |
| 显示 / 隐藏 | `comp.enabled = true / false` | 所有组件继承自 `Component` |
| 按名查找对象 | `scene.findSceneObject(name)` | 也可用属性绑定，见下方注意事项 |

> ⚠️ **两个必须注意的差异**（这是原版 Lua 手册直译过来会失效的地方）：
>
> 1. **引擎不提供 `setTimeout` / `delayCall`**。所有延时必须在 `onUpdate(dt)` 里自己累计时间，下方代码已用计时器实现。
> 2. **文本组件推荐用属性绑定，而不是按名查找**。在检查器面板把 6 个 `Text` 组件拖进脚本对应的属性槽，比 `findSceneObject` 更稳、也不怕后期改名。

### 3.1 出题与判题脚本

新建脚本组件（例如 `MathQuiz.js`），挂到场景根节点上，把 2.2 的 6 个文本组件绑定到对应属性。

```javascript
const APJS = require('amazingpro.js');

class MathQuiz extends APJS.ScriptComponent {

    onStart() {
        // ---- 绑定的文本组件（在检查器中拖拽赋值）----
        // this.textQuestion / textAns1 / textAns2 / textAns3 / textRight / textWrong

        this.trueAns = 0;      // 本题正确结果
        this.pos = 0;          // 正确答案位置：1 左 / 2 中 / 3 右
        this.cd = 0;           // 答题冷却剩余秒数
        this.refreshTimer = -1; // 出下一题的倒计时，-1 表示未启动

        this.newQuestion();
    }

    onUpdate(dt) {
        // 答题冷却倒计时
        if (this.cd > 0) {
            this.cd -= dt;
        }

        // 答题后延时出新题（替代 setTimeout）
        if (this.refreshTimer > 0) {
            this.refreshTimer -= dt;
            if (this.refreshTimer <= 0) {
                this.refreshTimer = -1;
                this.newQuestion();
            }
        }
    }

    // 生成 1~100 的随机整数
    getRandNum() {
        return Math.floor(Math.random() * 100) + 1;
    }

    // 生成干扰答案：与正确值相差 6~22，避免数值过近被蒙对
    getWrongNum(correct) {
        const offset = Math.floor(Math.random() * 17) + 6; // 6 ~ 22
        return Math.random() > 0.5 ? correct + offset : correct - offset;
    }

    // 刷新一道全新的算术题
    newQuestion() {
        this.cd = 2.0; // 重置答题冷却

        const a = this.getRandNum();
        const b = this.getRandNum();
        let calcStr = "";

        if (Math.random() > 0.5) {
            // 加法
            this.trueAns = a + b;
            calcStr = a + " + " + b + " =";
        } else {
            // 减法：大数减小数，保证结果非负
            const bigNum = Math.max(a, b);
            const smallNum = Math.min(a, b);
            this.trueAns = bigNum - smallNum;
            calcStr = bigNum + " - " + smallNum + " =";
        }

        // 随机决定正确答案落在左 / 中 / 右
        this.pos = Math.floor(Math.random() * 3) + 1;
        const wrong1 = this.getWrongNum(this.trueAns);
        const wrong2 = this.getWrongNum(this.trueAns);

        const options = [wrong1, wrong2];
        options.splice(this.pos - 1, 0, this.trueAns); // 把正确答案插到 pos 位置

        this.textAns1.str = String(options[0]);
        this.textAns2.str = String(options[1]);
        this.textAns3.str = String(options[2]);
        this.textQuestion.str = calcStr;

        // 隐藏上一题的对错提示
        this.textRight.enabled = false;
        this.textWrong.enabled = false;
    }

    // 判题：selectNum 为玩家选中的位置（1 左 / 2 中 / 3 右）
    checkAnswer(selectNum) {
        if (this.cd > 0 || this.refreshTimer > 0) {
            return; // 冷却中或正在展示结果，忽略输入
        }

        if (selectNum === this.pos) {
            this.textRight.enabled = true;
        } else {
            this.textWrong.enabled = true;
        }

        this.refreshTimer = 1.5; // 1.5 秒后自动出下一题
    }
}

exports.MathQuiz = MathQuiz;
```

> 相比原版：冷却判断从可视化分支移进了 `checkAnswer` 内部，避免「冷却已到但结果提示还在显示」时被重复触发。选项赋值改用数组 `splice` 插入，省掉三段重复的 if/else 分支。

### 3.2 纯可视化搭建方案（不写脚本）

如果不使用脚本组件，上述逻辑也可以用可视化节点等价实现：

| 脚本写法 | 可视化节点 |
| ---- | ---- |
| `onStart()` | `Start` 事件节点 |
| `onUpdate(dt)` | `Update` 事件节点，`Delta Time` 输出端口即 `dt` |
| `textComp.str = x` | 「设置文本」节点 |
| `comp.enabled = x` | 「设置可见性 / 启用」节点 |
| 随机数 | 「随机数」节点（范围 1~100） |
| 冷却计时 | `Update` → 变量自减 → 条件分支 |

工程模板已内置 `Start`（`Graph/ScriptTemplate/OnStart/`）与 `Update`（`Graph/ScriptTemplate/OnUpdate/`）两个事件节点，直接从它们往后连线即可。

---

## 四、摇头交互与参数调试

### 4.1 摇头判定

引入组件：**人脸追踪 → 头部横向旋转角度（Yaw 偏航角）**，按下表映射到 `checkAnswer()`：

| 判定条件 | 含义 | 执行 |
| ---- | ---- | ---- |
| Yaw > 15° | 头部右转 | `checkAnswer(3)` 选中右侧答案 |
| Yaw < -15° | 头部左转 | `checkAnswer(1)` 选中左侧答案 |
| -8° ≤ Yaw ≤ 8° | 正对屏幕 | `checkAnswer(2)` 选中中间答案 |

**脚本方案**：把判定写进 `onUpdate(dt)`，冷却由 `checkAnswer()` 内部拦截，无需额外分支：

```javascript
onUpdate(dt) {
    // ...（3.1 中的冷却与刷新计时）

    const yaw = this.getFaceYaw(); // 从人脸追踪组件读取 Yaw 角度

    if (yaw > 15) {
        this.checkAnswer(3);
    } else if (yaw < -15) {
        this.checkAnswer(1);
    } else if (yaw >= -8 && yaw <= 8) {
        this.checkAnswer(2);
    }
}
```

**可视化方案**：在 `Update` 节点后接三路条件分支，并**额外加一个 `cd <= 0` 的前置判断**（脚本方案里这一步已由 `checkAnswer` 内部完成）。

> 注意 15° 与 8° 之间留有 7° 的**死区**，这是刻意设计的 —— 头部缓慢回正时不会在两个区间边界反复横跳触发答题。调整阈值时请保留这段间隔。

### 4.2 参数调试对照

| 现象 | 调整方式 |
| ---- | ---- |
| 摇头识别过于灵敏（容易误答） | 阈值 15° → **18°** |
| 摇头识别不灵敏（转头不响应） | 阈值 15° → **12°** |
| 想加长答题间隔 | 修改 `newQuestion()` 里的 `this.cd = 2.0` |
| 结果提示一闪而过看不清 | 修改 `checkAnswer()` 里的 `this.refreshTimer = 1.5` |

---

## 五、真机预览调试

1. 点击工具右上角「扫码预览」，用抖音 APP 扫码加载 AR 特效；
2. 正对摄像头，确认自动出题正常显示；
3. 左右摇头，逐项测试：选项选中、对错提示、题目自动刷新；
4. 调整文字大小与位置，保证手机竖屏画面清晰可读。

---

## 六、发布上线

### 6.1 提交资料

| 字段 | 建议内容 |
| ---- | ---- |
| 特效名称 | 摇头口算大挑战丨小学生 100 以内算术练习 |
| 特效简介 | 左右摇头选择答案，趣味口算练习，适合孩子打卡、亲子合拍短视频 |
| 封面图 | 截取游戏界面，突出「摇头答题」核心玩法 |

### 6.2 审核要点

- 全程使用原生文字组件，无图片、无商用素材，审核通过率高；
- 无敏感内容、无诱导付费，常规审核 1 个工作日内完成上线。

---

## 七、避坑清单

- ❌ **禁止把摇头角度阈值设得过小** —— 人脸微动会造成无限误答题；
- ❌ **错误答案与正确答案差值不要小于 5** —— 随机蒙对会失去练习效果；
- ❌ **不要导入外部背景音乐** —— 使用平台内置免费音效，规避版权驳回；
- ✅ **减法必须大数减小数** —— 适配小学低年级教学逻辑，不出现负数。

---

## 八、拓展升级方案

可选的二次开发方向：

- 新增得分变量，连续答对累计分数展示在画面角落；
- 增加限时答题（10 秒未作答直接判错跳题）；
- 难度分级：1~20 简单题、1~100 难题双模式切换；
- 加入乘法、除法题型，拓展题库类型。

---

## 附录：运营与变现参考

> 以下为运营侧参考信息，与工程开发无关。

**平台流量激励**：根据用户「拍同款」投稿量阶梯结算奖金，个人实名账号可直接提现，无需注册公司。

**定制外包**：为宝妈博主、教育机构定制同款改版特效，单次定制费用参考 300–1000 元。

**账号长期变现**：特效设计师账号打造、AR 特效教学、多品类答题特效批量制作。

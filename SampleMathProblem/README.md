# 摇头口算大挑战 — 抖音互动特效开发手册

> 人脸姿态识别 + 随机题库的互动答题特效：连续出 10 道 100 以内加减法，左右摇头二选一，结束显示总成绩。

| 项目 | 说明 |
| ---- | ---- |
| 工程目录 | `SampleMathProblem/` |
| 创作工具 | 像塑 PC 端（工程内部标识 `Douyin AR`），Windows / Mac 通用，官网 effect.douyin.com |
| 工具版本 | 9.1.3（见 `effect.dyehpj` 的 `version` 字段） |
| 脚本语言 | JavaScript（CommonJS，`require('amazingpro.js')`） |
| 特效类型 | 人脸姿态识别互动答题 |
| 数字渲染 | **图片贴图**（非文字组件），素材见 `Assets/数字/` |

**当前工程状态**：素材已就位（`Assets/数字/`、`Assets/背景/`），但 `Assets/main.scene` 仍是空场景，`Graph/graph.json` 只有默认的 `Start` / `Update` 事件节点。下文第二、三、四章即为从零搭建的完整步骤。

---

## 目录

1. [玩法规则](#一玩法规则)
2. [素材清单与缺口](#二素材清单与缺口)
3. [场景搭建](#三场景搭建)
4. [核心脚本](#四核心脚本)
5. [摇头交互与调参](#五摇头交互与调参)
6. [真机预览调试](#六真机预览调试)
7. [发布上线](#七发布上线)
8. [避坑清单](#八避坑清单)
9. [拓展方案](#九拓展方案)

---

## 一、玩法规则

### 1.1 完整流程

```
特效启动
   │
   ├─→ 出第 1 题 ──→ 题干区显示算式（如 56 + 22 = ?）
   │                 左右按钮各显示一个答案，一对一错，左右位置随机
   │                      │
   │                 玩家左 / 右摇头选择
   │                      │
   │                 判定 → 答对则得分 +1 → 分数区刷新为 X/10
   │                      │
   │                 停留 1.5 秒
   │                      │
   ├─→ 未满 10 题 ────────┘（循环出下一题）
   │
   └─→ 满 10 题 → 中间显示最终成绩（如 8/10），其余元素全部隐藏
```

### 1.2 规则要点

| 项 | 规则 |
| ---- | ---- |
| 题数 | **10 题**，脚本里是常量 `TOTAL_QUESTIONS`，改成 5 只需改一个数字 |
| 题型 | 1~100 以内加减法，减法强制大数减小数，不出负数 |
| 选项 | **两个**，一对一错，正确答案随机落在左或右 |
| 交互 | 头部左转选左侧，右转选右侧（**没有中间态**） |
| 分数 | 实时显示「答对数 / 总题数」，如 `3/10` |
| 结算 | 10 题答完，中间显示最终成绩，题干、按钮、分数板全部隐藏 |
| 防误触 | 每题 2 秒答题冷却 + 结果展示期间不接受输入 |

> **二选一比原来的三选一更稳**：三选一需要「正对屏幕」当作中间选项，而人脸正对是默认姿态，极易误触 —— 所以原设计要在 8° 和 15° 之间留死区。改成二选一后这个隐患直接消失，只需判定左右两个方向。

---

## 二、素材清单与缺口

### 2.1 已就位

| 用途 | 文件 | 规格 |
| ---- | ---- | ---- |
| 数字 0~9 | `Assets/数字/0.png` ~ `9.png` | 615×615，深蓝主体 + 黑描边，透明底 |
| 加号 | `Assets/数字/加.png` | 615×615，黄色 |
| 减号 | `Assets/数字/减号.png` | 615×615，黄色 |
| 等号 | `Assets/数字/等号.png` | 615×615，黄色 |
| 问号 | `Assets/数字/问号.png` | 615×615，黄色 |
| 网格纸背景 | `Assets/背景/底图.png` | 1024×1536，无透明通道 |
| 题目底板 | `Assets/背景/矩形题目底板.png` | 615×615，浅蓝圆角 |
| 答案按钮 | `Assets/背景/橘色答案按钮.png`、`紫罗兰紫色答案按钮.png` | 615×615 |
| 分数底板 | `Assets/背景/黑色半透明扁平分数底板.png` | 615×615 |
| 生命红心 | `Assets/背景/爱心.png` | 615×615 |

透明通道已验证正常（左上角 alpha = 0）。

### 2.2 缺口

| 缺什么 | 为什么需要 | 优先级 |
| ---- | ---- | ---- |
| **斜杠 `/`** | 分数要显示成 `3/10`，现有素材没有斜杠 | 🔴 必须 |
| **白色数字 0~9** | 按钮上的答案和分数是白字，现有只有深蓝一套 | 🔴 必须 |
| 答对 / 答错反馈 | 选完给个即时反馈，否则只有分数跳变 | 🟡 建议 |
| 空心爱心 | 若要做生命值，扣血得有空心态 | ⚪ 看是否用 |

> **白色数字有个省事的办法**：把数字重出成**白色主体 + 黑描边**，再用 `IFSprite2d.colorTint` 染色 —— 黑描边乘任何颜色仍是黑，白色主体乘目标色就变成目标色，一套素材通吃题干深蓝和按钮白色。前提是像塑的 `colorTint` 为乘法混色，**需真机实测确认**，可行的话能省掉一整套素材。

> **生命红心当前规则里没有用到**。素材先留着，要不要做「答错扣心、扣光提前结束」是后续决定 —— 现在是固定 10 题跑完。

### 2.3 体积

入库素材合计 **4.41 MB**，其中 `底图.png` 一张占 1.9 MB，已逼近特效包 5 MB 上限。**上线前必须压缩**：

- 数字素材 615×615 → **256×256**（屏幕实际显示才 100~150px，615 是纯浪费）
- 底图过一遍 TinyPNG
- 目标：全部素材压到 1.5 MB 以内

`Assets/temp.folder/` 是 AI 出图的原始产物（20 MB），已在 `.gitignore` 里排除，不要入库。

---

## 三、场景搭建

### 3.1 等宽槽位方案

数字是图片，一个 Sprite 只能显示一个字符，所以「56 + 22 = ?」需要 7 个 Sprite 拼出来。而算式长度是变化的（`7 + 8 = ?` 只有 5 个字符），于是有了**等宽槽位**方案：

> **摆固定数量的等宽槽位，按内容长度居中填充，用不到的槽隐藏。**

这样只需要控制每个槽的 `texture` 和 `enabled` 两个属性，**完全不用在运行时改节点位置** —— 省掉了变长排版的坐标计算，也不依赖未经验证的 transform API。素材都是 615×615 等宽，等距摆放天然对齐。

举例（题干 9 个槽）：

```
槽位:   0    1    2    3    4    5    6    7    8
内容:   ·    5    6    +    2    2    =    ?    ·      ← "56+22=?" 共 7 字符，居中占 1~7
内容:   ·    ·    7    +    8    =    ?    ·    ·      ← "7+8=?"   共 5 字符，居中占 2~6
```

### 3.2 节点结构

在场景中按下表创建节点。**同一组的槽位必须等距横向排列**，间距按素材实际显示宽度调，命名务必与表格一致（脚本按属性绑定，名字对不上会漏绑）。

| 节点 | 类型 | 数量 | 位置 | 说明 |
| ---- | ---- | ---- | ---- | ---- |
| `Bg` | Sprite | 1 | 铺满全屏 | 网格纸底图 |
| `ScorePanel` | Sprite | 1 | 左上角 | 黑色半透明底板 |
| `ScoreSlots` | Sprite | **5** | 分数板内，等距 | 显示 `X/10`，最长 `10/10` 占 5 位 |
| `Heart` | Sprite | 1 | 分数板右侧 | 生命红心（当前规则未使用） |
| `QuestionPanel` | Sprite | 1 | 上方 | 浅蓝圆角题目底板 |
| `QuestionSlots` | Sprite | **9** | 题目板内，等距 | 算式，最长 `100+100=?` 占 9 位 |
| `BtnLeft` | Sprite | 1 | 左下 | 橘色按钮 |
| `LeftSlots` | Sprite | **3** | 橘色按钮内，等距 | 左侧答案，最大 3 位数 |
| `BtnRight` | Sprite | 1 | 右下 | 紫色按钮 |
| `RightSlots` | Sprite | **3** | 紫色按钮内，等距 | 右侧答案，最大 3 位数 |
| `FinalPanel` | Sprite | 1 | 屏幕正中 | 结算底板，**初始隐藏** |
| `FinalSlots` | Sprite | **5** | 结算板内，等距 | 最终成绩，**初始隐藏** |

**槽位数量的来历**：a、b 都取 1~100，和最大 200（3 位），所以算式最长是 `100+100=?` = 3+1+3+1+1 = **9 位**，答案最长 3 位，分数最长 `10/10` = 5 位。

### 3.3 贴图资源绑定

脚本需要在检查器里绑定这些贴图（不是场景节点，是素材资源）：

| 属性 | 绑定 |
| ---- | ---- |
| `digitTextures` | 数组，按 **0~9 的顺序**依次拖入 `Assets/数字/0.png` ~ `9.png` |
| `texAdd` | `加.png` |
| `texSub` | `减号.png` |
| `texEq` | `等号.png` |
| `texQuestion` | `问号.png` |
| `texSlash` | 斜杠素材（**待补**） |

> `digitTextures` 的顺序至关重要 —— 脚本直接用 `digitTextures[数字]` 取图，拖错顺序会出现「显示 3 实际是 7」这种诡异 bug，且不会报错。

---

## 四、核心脚本

新建脚本组件 `MathQuiz.js`，挂到场景根节点，按 3.2 / 3.3 绑定好节点与贴图。

```javascript
const APJS = require('amazingpro.js');

// ---- 可调参数 ----
const TOTAL_QUESTIONS = 10;   // 总题数，改 5 就是 5 题模式
const YAW_THRESHOLD   = 15;   // 摇头判定角度（度）
const ANSWER_COOLDOWN = 2.0;  // 每题开始后的答题冷却（秒）
const RESULT_DELAY    = 1.5;  // 答完停留多久出下一题（秒）
const WRONG_MIN_GAP   = 6;    // 干扰答案与正确答案的最小差值
const WRONG_MAX_GAP   = 22;   // 干扰答案与正确答案的最大差值

class MathQuiz extends APJS.ScriptComponent {

    onStart() {
        // 绑定的节点（检查器中拖拽赋值）：
        //   this.questionSlots[9]  this.leftSlots[3]  this.rightSlots[3]
        //   this.scoreSlots[5]     this.finalSlots[5]
        //   this.questionPanel  this.btnLeft  this.btnRight
        //   this.scorePanel     this.finalPanel
        // 绑定的贴图：
        //   this.digitTextures[10]  this.texAdd  this.texSub
        //   this.texEq  this.texQuestion  this.texSlash

        this.questionIndex = 0;      // 已答题数
        this.correctCount  = 0;      // 答对数
        this.leftIsCorrect = false;  // 本题正确答案是否在左边
        this.cd            = 0;      // 答题冷却剩余
        this.resultTimer   = -1;     // 出下一题的倒计时，-1 表示未启动
        this.finished      = false;  // 是否已结算

        this.finalPanel.enabled = false;
        this.hideSlots(this.finalSlots);

        this.updateScore();
        this.newQuestion();
    }

    onUpdate(dt) {
        if (this.finished) {
            return;
        }

        // 答题冷却
        if (this.cd > 0) {
            this.cd -= dt;
        }

        // 结果展示期：倒计时结束后出下一题或结算
        if (this.resultTimer > 0) {
            this.resultTimer -= dt;
            if (this.resultTimer <= 0) {
                this.resultTimer = -1;
                if (this.questionIndex >= TOTAL_QUESTIONS) {
                    this.showFinal();
                } else {
                    this.newQuestion();
                }
            }
            return; // 展示结果期间不接受输入
        }

        // 摇头判定
        const yaw = this.getFaceYaw();
        if (yaw > YAW_THRESHOLD) {
            this.checkAnswer(false);      // 头右转 → 选右
        } else if (yaw < -YAW_THRESHOLD) {
            this.checkAnswer(true);       // 头左转 → 选左
        }
    }

    // ---------- 渲染 ----------

    /**
     * 把一串贴图居中填进等宽槽位，多余的槽隐藏。
     * 这是整套显示逻辑的核心：不改坐标，只改 texture 和 enabled。
     */
    renderSlots(slots, textures) {
        const start = Math.floor((slots.length - textures.length) / 2);
        for (let i = 0; i < slots.length; i++) {
            const idx = i - start;
            if (idx >= 0 && idx < textures.length) {
                slots[i].texture = textures[idx];
                slots[i].enabled = true;
            } else {
                slots[i].enabled = false;
            }
        }
    }

    hideSlots(slots) {
        for (let i = 0; i < slots.length; i++) {
            slots[i].enabled = false;
        }
    }

    /** 数字 → 逐位贴图数组，如 56 → [贴图5, 贴图6] */
    numToTextures(n) {
        const str = String(n);
        const out = [];
        for (let i = 0; i < str.length; i++) {
            out.push(this.digitTextures[Number(str.charAt(i))]);
        }
        return out;
    }

    // ---------- 出题 ----------

    randInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /** 干扰答案：与正确值差 6~22，且不为负 */
    makeWrongAnswer(correct) {
        const offset = this.randInt(WRONG_MIN_GAP, WRONG_MAX_GAP);
        let wrong = Math.random() > 0.5 ? correct + offset : correct - offset;
        if (wrong < 0) {
            wrong = correct + offset;  // 减出负数就改成加，避免出现没有素材的负号
        }
        return wrong;
    }

    newQuestion() {
        const a = this.randInt(1, 100);
        const b = this.randInt(1, 100);

        let trueAns;
        let chars;

        if (Math.random() > 0.5) {
            // 加法
            trueAns = a + b;
            chars = this.numToTextures(a)
                .concat([this.texAdd])
                .concat(this.numToTextures(b));
        } else {
            // 减法：大数减小数，保证非负
            const big   = Math.max(a, b);
            const small = Math.min(a, b);
            trueAns = big - small;
            chars = this.numToTextures(big)
                .concat([this.texSub])
                .concat(this.numToTextures(small));
        }
        chars = chars.concat([this.texEq, this.texQuestion]);
        this.renderSlots(this.questionSlots, chars);

        // 两个选项，正确答案随机落左或右
        const wrong = this.makeWrongAnswer(trueAns);
        this.leftIsCorrect = Math.random() > 0.5;

        this.renderSlots(this.leftSlots,
            this.numToTextures(this.leftIsCorrect ? trueAns : wrong));
        this.renderSlots(this.rightSlots,
            this.numToTextures(this.leftIsCorrect ? wrong : trueAns));

        this.cd = ANSWER_COOLDOWN;
    }

    // ---------- 判题与结算 ----------

    checkAnswer(pickLeft) {
        if (this.finished || this.cd > 0 || this.resultTimer > 0) {
            return; // 冷却中 / 正在展示结果 / 已结束，忽略输入
        }

        if (pickLeft === this.leftIsCorrect) {
            this.correctCount++;
        }
        this.questionIndex++;
        this.updateScore();

        this.resultTimer = RESULT_DELAY;
    }

    /** 分数区：答对数 / 总题数 */
    updateScore() {
        const chars = this.numToTextures(this.correctCount)
            .concat([this.texSlash])
            .concat(this.numToTextures(TOTAL_QUESTIONS));
        this.renderSlots(this.scoreSlots, chars);
    }

    /** 结算：中间显示最终成绩，其余全部隐藏 */
    showFinal() {
        this.finished = true;

        this.questionPanel.enabled = false;
        this.btnLeft.enabled       = false;
        this.btnRight.enabled      = false;
        this.scorePanel.enabled    = false;
        this.hideSlots(this.questionSlots);
        this.hideSlots(this.leftSlots);
        this.hideSlots(this.rightSlots);
        this.hideSlots(this.scoreSlots);

        this.finalPanel.enabled = true;
        const chars = this.numToTextures(this.correctCount)
            .concat([this.texSlash])
            .concat(this.numToTextures(TOTAL_QUESTIONS));
        this.renderSlots(this.finalSlots, chars);
    }

    /** 从人脸追踪组件读取头部 Yaw 角度（度）——具体 API 见第五章 */
    getFaceYaw() {
        // TODO: 接入人脸追踪的 Yaw 输出
        return 0;
    }
}

exports.MathQuiz = MathQuiz;
```

### 4.1 几处设计说明

| 点 | 说明 |
| ---- | ---- |
| **干扰答案防负数** | `makeWrongAnswer` 里 `correct - offset` 可能为负（如 `5-2=3`，offset=22 → −19）。数字素材没有负号，会直接显示不出来。所以为负时改成加法。 |
| **`questionIndex` 在判题时自增** | 不是在出题时。这样 `questionIndex` 语义是「已答题数」，和 `TOTAL_QUESTIONS` 比较最直观。 |
| **冷却与结果期分开** | `cd` 防的是刚出题时头还没回正就误触；`resultTimer` 防的是结果展示期间重复输入。两者都为 0 才接受摇头。 |
| **结算只隐藏组件不销毁** | 便于后续加「再来一局」，重置变量再 `enabled = true` 即可。 |

---

## 五、摇头交互与调参

### 5.1 判定表

引入组件：**人脸追踪 → 头部横向旋转角度（Yaw 偏航角）**。

| 判定条件 | 含义 | 执行 |
| ---- | ---- | ---- |
| Yaw > 15° | 头部右转 | `checkAnswer(false)` 选右侧 |
| Yaw < −15° | 头部左转 | `checkAnswer(true)` 选左侧 |
| 其余 | 未选择 | 无动作 |

> ⚠️ `getFaceYaw()` 在脚本里是占位实现。人脸 Yaw 的具体读取 API 尚未在像塑运行时库中定位到确切签名 —— **建议用可视化的人脸追踪节点把 Yaw 接出来**，再传给脚本，比在脚本里硬找 API 稳妥。

### 5.2 调参对照

| 现象 | 调整 |
| ---- | ---- |
| 摇头太灵敏，容易误选 | `YAW_THRESHOLD` 15 → 18 |
| 转头没反应 | `YAW_THRESHOLD` 15 → 12 |
| 想改题数 | `TOTAL_QUESTIONS` 10 → 5 |
| 出题太快跟不上 | `ANSWER_COOLDOWN` 调大 |
| 结果一闪而过 | `RESULT_DELAY` 调大 |
| 干扰答案太好猜 | `WRONG_MIN_GAP` 调小（但别小于 5） |

---

## 六、真机预览调试

1. 点击工具右上角「扫码预览」，用抖音 APP 扫码加载；
2. 正对摄像头，确认第 1 题正常显示，两个按钮各有一个数字；
3. 左右摇头，逐项验证：选中判定、分数递增、自动出下一题；
4. **重点看排版** —— 分别遇到 1 位数、2 位数、3 位数的题目时，算式是否都居中、没有错位或压边；
5. 连答 10 题，确认结算面板出现且其他元素全部隐藏；
6. 调整素材显示尺寸与槽位间距，保证竖屏下清晰可读。

---

## 七、发布上线

| 字段 | 建议内容 |
| ---- | ---- |
| 特效名称 | 摇头口算大挑战丨小学生 100 以内加减法 |
| 特效简介 | 左右摇头选答案，10 道口算题看你能对几道，适合亲子打卡合拍 |
| 封面图 | 截取答题界面，突出「摇头选择」和分数 |

审核要点：素材全部为 AI 生成的原创图形，无第三方版权素材；无敏感内容、无诱导付费，常规审核 1 个工作日内完成。

---

## 八、避坑清单

- ❌ **`digitTextures` 拖拽顺序错了不会报错**，只会显示错数字 —— 绑完先逐个核对；
- ❌ **摇头阈值别设太小**，人脸微动会造成连续误答，10 题瞬间跑完；
- ❌ **干扰答案差值别小于 5**，太接近容易蒙对，失去练习意义；
- ❌ **素材别直接用 615×615 上线**，包体会撑爆 5 MB 限制；
- ❌ **不要导入外部背景音乐**，用平台内置免费音效，规避版权驳回；
- ✅ **减法必须大数减小数**，且干扰答案不能为负 —— 没有负号素材。

---

## 九、拓展方案

- **答对 / 答错即时反馈**：选完弹一个 ✓ / ✗，比只有分数跳变更有反馈感；
- **生命值玩法**：用上现有的爱心素材，答错扣心、扣光提前结束（需补空心爱心）；
- **限时答题**：每题 5 秒倒计时，超时判错；
- **难度分级**：1~20 简单模式、1~100 挑战模式；
- **再来一局**：结算面板加一个重开入口，重置变量即可；
- **成绩梗图**：结算时按分数段显示不同评语（10/10「学神」、0/10「回去补课」），提升合拍传播性。

---

## 分支约定

见仓库根目录 [README](../README.md)。

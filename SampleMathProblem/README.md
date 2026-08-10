# 摇头口算大挑战 — 抖音互动特效开发手册

> 连续出 10 道 100 以内加减法，左右摇头二选一，红绿边框反馈对错，结束显示总成绩。

| 项目 | 说明 |
| ---- | ---- |
| 工程目录 | `SampleMathProblem/` |
| 创作工具 | 像塑 PC 端（工程内部标识 `Douyin AR`），官网 effect.douyin.com |
| 工具版本 | 9.1.3 |
| 实现方式 | **纯蓝图**（可视化编程），不含任何自定义代码 |
| 工程来源 | 由官方示例 [`PhotoSelect`](../PhotoSelect/) 改造 |
| 当前规模 | 247 节点 / 306 连线 / 25 变量 |

---

## 目录

1. [快速上手](#一快速上手)
2. [⚠️ 像塑的文件回写机制](#二️-像塑的文件回写机制必读)
3. [场景结构](#三场景结构)
4. [蓝图四段链路](#四蓝图四段链路)
5. [变量表](#五变量表)
6. [关键技术发现](#六关键技术发现踩坑记录)
7. [遗留与待办](#七遗留与待办)
8. [改造方法论](#八改造方法论)

---

## 一、快速上手

**打开**：用像塑打开 `effect.dyehpj`。

**玩法链路一句话**：开拍 → 随机出一道算式 → 左右歪头选答案 → 红绿边框反馈 → 1.2 秒后下一题 → 满 10 题显示「得分：X/10」。

**改难度**：出题链里两个 `Index Generator` 的 `To` 参数（默认 100），改成 20 就是 20 以内口算。

**改题数**：结算判断处 `Greater or Equal` 的 `B`（默认 10）。

**改停留时间**：`Wait for Seconds` 的 `Start`（默认 1.2 秒）。

---

## 二、⚠️ 像塑的文件回写机制（必读）

**这是本项目踩得最多的坑，会让所有外部改动白费。**

像塑的工作方式是：

```
打开工程 → 复制一份到 Instances/Instance1 工作区 → 在副本上编辑 → 保存时写回工程目录
```

由此产生两条铁律：

| 情况 | 后果 |
| ---- | ---- |
| 像塑开着时改工程文件 | 编辑器**不会重新读**，你的改动看不到；它一保存还会**用旧副本覆盖**你的改动 |
| 改完文件后不重启像塑 | 加载的仍是旧副本，测的是旧逻辑 |

**正确顺序**：

```
1. 完全关闭像塑（任务管理器确认没有 Douyin AR.exe，窗口关掉不等于进程退出）
2. 外部修改文件
3. 重新打开像塑与工程
4. 测试
5. 要再改？回到第 1 步
```

判断编辑器加载的是不是新版：改动前后节点数会变，在蓝图搜索框搜新加的节点名（如 `数据类型转换`），搜不到就是加载了旧副本。

---

## 三、场景结构

```
面部面具 / 面部面具摄像机
特效
  摄像机
  3D 跟踪头模          ← 摇头角度的唯一数据源，勿删
2D 前景
  2D 摄像机
    标题
    选择题
      题目 > 前色 > 题目(Text)      ← 算式
      左 > 底色 / 前 > 内容-左(Text) > 选中(Image)
      右 > 底色 / 内容-右(Text) > 选中(Image) / 前
      爱心底 > 爱心
    提示(Text)          ← "左右摇头进行选择"，开拍后隐藏
    结果(Text)          ← "得分：X/10"，编辑态隐藏，10 题后显示
```

### 关键对象的 guid

蓝图靠 guid 引用组件，改名不影响，但**删除重建会导致引用失效**：

| 对象 | 组件 | guid |
| ---- | ---- | ---- |
| 题目 | Text | `5036185406514246442, 9480604486381581443` |
| 内容-左 | Text | `4706024832568924559, 17303935785047165621` |
| 内容-右 | Text | `4846556965779036151, 4582100466301663160` |
| 结果 | Text | `4809202211536185422, 2795402550609078450` |
| 左选中框 | ImageRenderer | `5256048455005326714, 14127253681309217417` |
| 右选中框 | ImageRenderer | `4659374728382722262, 12819839291382783121` |
| 结果 | **Entity**（显隐用） | `4914739517148219460, 9551616506918485639` |

> `Set Visibility` 要的是 **Entity guid**，属性节点要的是**组件 guid**，两者不同。用错不会报错，但运行时找不到对象。

### 边框染色

左右「选中」框**共用一张纯白的 `边框.png`**（不透明像素 R=G=B=255），靠 `color` 属性染色。所以红/绿/默认三态**不需要三张贴图**，改颜色即可：

| 状态 | RGBA |
| ---- | ---- |
| 默认（紫） | `0.5254902, 0.3568628, 0.945098, 1` |
| 正确（绿） | `0.2, 0.85, 0.4, 1` |
| 错误（红） | `1.0, 0.3, 0.3, 1` |

---

## 四、蓝图四段链路

### 4.1 摇头判定（继承自 PhotoSelect，未改动）

```
Get Component Property(localEulerAngles) ← 3D 跟踪头模的 Transform
        ↓  Vector3f
      Peek → Split.Z
        ↓  Double
  Greater or Equal ─┐
                    ├→ And → If.Condition
  Less or Equal   ──┘
        ↑
    Update.Next（每帧驱动）
```

**⚠️ 角度是 0~360 度制，不是 ±15。头左转是 330~345，不是负数。**

| 状态 | 区间 |
| ---- | ---- |
| 头右转 | `15 ≤ Z ≤ 30` |
| 头左转 | `330 ≤ Z ≤ 345` |
| 回正死区 | `0~10` 与 `350~360` |

所以判定必须用**两组比较夹出区间**（`Greater + Less + And`），写成 `Z > 15` 这种单边判断会在 0/360 环绕处失效。这套参数是示例调好的，直接沿用。

### 4.2 出题链

入口是名为 **「出题入口」** 的 Sequence 节点。

```
Index Generator(Random,1~100) → NumA
Index Generator(Random,1~100) → NumB
Index Generator(Random,0~1) → Equal(=1) → IsAdd
        ↓
      If(IsAdd)
   ┌────┴────┐
 加法        减法
 DispA=NumA  Greater or Equal(NumA,NumB)
 DispB=NumB    ├ True :  DispA=NumA, DispB=NumB
 Right=A+B     └ False:  DispA=NumB, DispB=NumA
 OpSymbol="+"  Right = DispA - DispB, OpSymbol="-"
   └────┬────┘
        ↓
干扰答案：Index Generator(1~20)=偏移, Index Generator(0~1)=符号
  And(是减号, Right≥偏移) ? Wrong=Right-偏移 : Wrong=Right+偏移
        ↓
Index Generator(0~1) → CorrectSide（0=左 1=右）
        ↓
DispA →[数据类型转换]→ 合并字符串.String 0
OpSymbol →             合并字符串.String 1
DispB →[数据类型转换]→ 合并字符串.String 2
常量 "=?" →            合并字符串.String 3
        └→ 设文本(题目)
        ↓
If(CorrectSide==0)
  True :  左=RightAnswer, 右=WrongAnswer
  False:  左=WrongAnswer, 右=RightAnswer   （均经数据类型转换）
```

**随机数用的是 `Index Generator` 的 Random 模式**，实现即 `Math.floor(Math.random()*(to-from+1))+from`，所以不需要额外的 Random Integer / Random Boolean 节点。

**减法防负数没有用「交换两个变量」** —— 蓝图里 `NumA=NumB` 执行完，`NumB=NumA` 拿到的已是新值，两个变量会变成同一个数。改用比大小后分别写入 `DispA`/`DispB`。

### 4.3 判定链

入口是名为 **「判定入口」** 的 Sequence 节点，由摇头触发：

```
Sequence#0(右转终点).Procedure 3 → PickSide=1 → 判定入口
Sequence#1(左转终点).Procedure 3 → PickSide=0 → 判定入口
        ↓
If(LockAnswer)
  True  → 丢弃（答题锁定中）
  False → LockAnswer=true
        ↓
    If(PickSide == CorrectSide)
   ┌────────┴────────┐
 答对                答错
 己方框绿            己方框红 + 对侧框绿
 Score+1
```

### 4.4 推进与结算

```
Wait for Seconds(1.2s)
   → CurQuestion+1
   → 左右框恢复紫色
   → LockAnswer=false
   → If(CurQuestion ≥ 10)
        False → 回「出题入口」（循环）
        True  → 隐藏「选择题」→ 显示「结果」
                → 合并字符串("得分："+ Score +"/10") → 设文本(结果)
```

---

## 五、变量表

### 本项目新增（14 个）

| 变量 | 类型 | 用途 |
| ---- | ---- | ---- |
| `NumA` / `NumB` | Number | 两个随机运算数 |
| `DispA` / `DispB` | Number | **显示用**的两个数（减法时已排好大小） |
| `IsAdd` | Boolean | true=加法 |
| `OpSymbol` | String | 运算符 `+` / `-` |
| `RightAnswer` | Number | 正确结果 |
| `WrongAnswer` | Number | 干扰答案 |
| `CorrectSide` | Number | 正确答案在哪边，0=左 1=右 |
| `PickSide` | Number | 玩家选了哪边，0=左 1=右 |
| `CurQuestion` | Number | 已答题数 |
| `Score` | Number | 答对数 |
| `LockAnswer` | Boolean | 答题锁，防一次摇头重复判定 |
| `MaxNumber` | Number | ⚠️ 预留未接线，当前范围硬编码在 Index Generator 的 To |

### 示例遗留（11 个）

`选项内容` `随机内容` `右内容` `题目内容` `正确边`（题库数组，已停用）、
`开拍` `i` `time` `选中` `执行1次` `左右`（原 PhotoSelect 逻辑，部分仍在用）。

---

## 六、关键技术发现（踩坑记录）

### 6.1 数值不能直连字符串端口

官方文档说「数值可直接连文本端口，引擎自动转字符串」—— **实测不成立**。7 处 `Double → String` 连线全部被标记 `isValid=false`，静默失效，画面表现为文字不更新。

**必须插入「数据类型转换」节点**（`Data Convert`）。它一个 `Input(Double)` 进，多种类型输出并存（二维向量/三维向量/四维向量/颜色/**字符串**），**接哪个输出就转成哪个类型**，不用改选型。

### 6.2 一个输入端口只能接一条线

复用旧节点时如果不断开它原有的数据源，**新接的线会被静默丢弃**。本项目「题目」文本一直显示默认值，就是因为 `Value` 端口还连着题库遗留的 `Get Item from Array`。

**改造旧节点时，先查它的输入端口有没有旧连线。**

### 6.3 复制节点必须重写端口的 owner

从现有节点复制来造新节点时，除了 `__uniqueId` / `_IdentityId`，**端口的 `owner.__referenceId` 也必须指向新节点**。漏改会导致端口归属错乱，编辑器报「链接错误：数据类型错误」红线 —— 报的是类型错误，实际错在归属。

### 6.4 变量实体存在子图里

`GraphVariable` 的完整定义在 `nodeList[9].subContainer.graph.variableList`（Do Once 子图），主图的 `variableList` 只存 `{__referenceId}` 引用。这是 JSON 的对象引用机制：首次出现写完整定义，后续写引用。**新增变量要往子图里放实体、主图里放引用。**

### 6.5 像塑没有的东西

| 找过但没有 | 替代方案 |
| ---- | ---- |
| 数字转字符串（独立节点） | `Data Convert` 接字符串输出 |
| Random Integer / Random Boolean | `Index Generator` 的 Random 模式 |
| 添加脚本组件（`.js` 挂到节点上） | **不支持**，菜单里只有「可视化编程组件」 |
| 自定义 TS 节点（`@customNode`）| **不支持**，`Library/CompiledScripts/Types/` 只是编辑器的类型提示 |

`Library/CompiledScripts/Types/` 里确实有 `BasicScriptNode.d.ts`、`OrionDecorators.d.ts`，看起来像支持自定义节点，但官方确认不可用 —— **别被这些类型定义误导**。

### 6.6 蓝图硬编码坐标不会跟随场景

`Set Component Property(anchoredPosition)` 里的坐标是写死的。**在编辑器里挪动对象后，运行时会被蓝图拉回旧位置**。本项目曾因爱心从 Y=460 挪到 420，运行时又跳回 460。

改布局后要同步检查蓝图里的位置/缩放节点。

### 6.7 字符串常量可以直接填在端口里

UI 上「合并字符串」的端口不让输入文字，但 `portValue` 在 JSON 层就是 `{"type":"String","value":""}`，**外部编辑可以直接填**。所以 `+`、`-`、`=?` 这些符号不需要额外的「字符串常量」节点。

---

## 七、遗留与待办

### 可以清理（当前无害）

题库方案的 5 个数组变量仍在：`选项内容[30]` `随机内容[0]` `右内容[30]` `题目内容[30]` `正确边[30]`。

其中 `选项内容` 被 `Array Info` 读取，用来给初始化链路的 `For Loop` 提供循环次数 —— **`For Loop` 现在实际上只起「初始化触发器」的作用**（跑完 30 次空循环后触发出题）。想彻底清理的话，把 `开拍[写].Trigger` 直接接到 `CurQuestion=0`，再删掉 For Loop 与题库链路。

### 未接线

- `MaxNumber` 变量预留未用，难度范围目前硬编码在两个 `Index Generator` 的 `To`
- 爱心飞行动画（`Transit by Time` ×15）保留自示例，未与答对事件关联

### 未验证

- 数字是否会显示成浮点（如 `37.0`）—— 若出现需在转换前加取整
- 10 题结算后是否需要屏蔽摇头（目前 `finished` 由 `CurQuestion ≥ 10` 判断，但摇头链路仍在跑）

---

## 八、改造方法论

这套工程是靠**直接编辑 `Graph/graph.json`** 改出来的，不是在编辑器里连线。可复用的做法：

### 节点从模板构造

`Graph/ScriptTemplate/<名字>/node.json` 定义了每个节点的端口。**工程里没用过的节点没有模板**，必须先在编辑器里拖一个出来保存，之后就能靠脚本批量复制。

构造节点时需要：复制一个结构相近的现有实例 → 重写 `__uniqueId` / `_IdentityId` / **所有端口的 id 和 owner** → 按 `node.json` 的定义重建端口。

### 连线结构

```json
{ "__class": "Edge", "__uniqueId": "...",
  "owner": { "__referenceId": "<graph 的 __uniqueId>" },
  "sourcePortId": "<源端口 __uniqueId>",
  "targetPortId": "<目标端口 __uniqueId>",
  "type": "BEZIER", "isValid": true }
```

连线用端口的 `__uniqueId`（不是 `_IdentityId`）。

### 每次改完必查

| 检查项 | 方法 |
| ---- | ---- |
| id 唯一 | 收集所有节点/端口/连线 id，比对 `Set` 大小 |
| 端点可解析 | 每条边的两个 portId 都能在端口表里找到 |
| owner 一致 | 每个端口的 `owner.__referenceId` == 所属节点 id |
| 类型匹配 | 连线两端 `valueTypeName` 相同（Double/Int/Number 互通） |
| 场景 guid 有效 | 节点引用的 guid 在 `main.scene` 里存在 |
| 孤立节点 | 没有任何连线的节点 |

这六项全绿再提交，能挡掉绝大多数低级错误。**但挡不住逻辑错误** —— 结构合法不代表跑得对，最终还得在编辑器里验证。

---

## 分支约定

见仓库根目录 [README](../README.md)。

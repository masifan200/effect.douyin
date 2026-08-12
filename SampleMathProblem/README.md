# 摇头口算大挑战 — 抖音互动特效开发手册

> 连续出 5 道 100 以内加减法，左右摇头二选一，红绿边框反馈对错，结束显示总成绩。

| 项目 | 说明 |
| ---- | ---- |
| 工程目录 | `SampleMathProblem/` |
| 创作工具 | 像塑 PC 端（工程内部标识 `Douyin AR`），官网 effect.douyin.com |
| 工具版本 | 9.2.2（`effect.dyehpj` 的 `version` 字段；工程最初由 5.3.0 创建） |
| 实现方式 | **纯蓝图**（可视化编程），不含任何自定义代码 |
| 工程来源 | 由官方示例 [`PhotoSelect`](../PhotoSelect/) 改造 |
| 当前规模 | 276 节点 / 347 连线 / 21 变量 |

---

## 目录

1. [快速上手](#一快速上手)
2. [⚠️ 像塑的文件回写机制](#二️-像塑的文件回写机制必读)
3. [场景结构](#三场景结构)
4. [蓝图链路](#四蓝图链路) — [摇头判定](#41-摇头判定继承自-photoselect未改动) · [出题](#42-出题链) · [判定](#43-判定链) · [推进结算](#44-推进与结算) · [开局初始化](#45-开局初始化)
5. [变量表](#五变量表)
6. [关键技术发现](#六关键技术发现踩坑记录)
7. [遗留与待办](#七遗留与待办)
8. [改造方法论](#八改造方法论)

---

## 一、快速上手

**打开**：用像塑打开 `effect.dyehpj`。

**玩法链路一句话**：进特效即随机出题 → 点开拍不换题 → 左右歪头选答案 → 红绿边框反馈 → 1.2 秒后下一题 → 满 5 题显示「得分：X/5」。

**改难度**：变量 `MaxNumber` 的初值（默认 100），改成 20 就是 20 以内口算。两个出题用的 `Index Generator` 的 `To` 都读它，只改这一处即可。

**改题数**：结算判断处 `Greater or Equal` 的 `B`（默认 5），以及结果文本里的 `"/5"`。

**改停留时间**：答完停留是 `Wait for Seconds` 1.2 秒；写文本前另有一个 0.05 秒的延时（防 iPhone 上 UI 未就绪，同时是开拍瞬间的闪烁窗口，不建议删）。

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
1. 强杀像塑，确认进程为零（窗口关掉不等于进程退出）
2. 外部修改文件
3. 重新打开像塑与工程
4. 测试
5. 要再改？回到第 1 步
```

强杀命令 —— **按镜像名杀**：

```bash
taskkill //IM "Douyin AR.exe" //F
sleep 5
tasklist | grep -qi "Douyin AR" && echo "仍在运行，中止" && exit 1
```

> ⚠️ **不要**用 `tasklist | grep -i "Douyin AR" | awk '{print $2}'` 取 PID。
> 进程名 `Douyin AR.exe` 含空格，第 2 列是 `AR.exe` 而不是 PID，
> `taskkill //PID AR.exe` 只会报「没有找到进程」。本项目有好几轮
> 「✅ 已确认退出」是假的，实际进程一直活着。

**`effect.dyehpj` 不需要跟着改。** 它只存项目元信息（名称、图层名、`projectID`、预览视频、上传记录、工具版本），**不含任何蓝图或场景数据**。改 `graph.json` / `main.scene` 后无需同步它。

**工作区残留也不用清。** `%LOCALAPPDATA%\DouyinAR\Instances\Instance1\` 下有 `Backup/*.tmp/Graph/graph.json` 和 `Preview/` 缓存，但都是历史快照；重新打开工程时读的是工程目录本身，不会被它们污染。看到旧内容只有一个原因 —— **进程没退出**。

**怎么判断编辑器加载的是不是新版**：

| 方法 | 说明 |
| ---- | ---- |
| 比时间 | `graph.json` 的修改时间 vs 像塑进程的启动/存活时间，文件比进程新 = 加载的是旧副本 |
| 搜节点 | 蓝图搜索框搜新加的节点名，搜不到就是旧副本 |
| 看规模 | 改动前后节点数会变 |

**症状识别**：如果改了十几轮、用户反馈的现象却一个都没变，先查像塑是不是从头到脑一直开着 —— 这比继续排查逻辑有效得多。本项目发生过一次：连续多个提交全部生效在文件里，但测的始终是旧逻辑。

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
    结果(Text)          ← "得分：X/5"，编辑态隐藏，5 题后显示
```

**场景静态值即预览画面。** 未开拍时显示的就是场景里 Text 的静态内容，
本项目设为一道完整的展示题（题目 `50+49=?`、左 `99`、右 `98`），
与出题逻辑写入的值风格一致，UI 重建时不会露馅。详见 [6.14](#614-一个-text-有四处内容字段必须同改) / [6.15](#615-ui-重建会露出场景静态值)。

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

## 四、蓝图链路

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
Index Generator(Random, 1~MaxNumber) → NumA
Index Generator(Random, 1~MaxNumber) → NumB
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
Sequence#0(左转终点).Procedure 3 → PickSide=0 → 判定入口
Sequence#1(右转终点).Procedure 3 → PickSide=1 → 判定入口
        ↓
If(LockAnswer)
  True  → 丢弃（答题锁定中）
  False → LockAnswer=true
        ↓
    If(PickSide == CorrectSide)
   ┌────────┴────────┐
 答对                答错
 爱心×3 绿           爱心×3 红
 己方框绿            己方框红
 对侧框红            对侧框绿
 Score+1
```

爱心是三个对象一起染色（`爱心` / `爱心(2)` / `扩散`），飞行位移作用在它们的父节点上，
颜色各自渲染，互不冲突。飞出的第一帧就是判定色（`Transit by Time` 的 `Begin` 端口
在动画启动同帧就往下串），一直保持到 1.2 秒复位转紫。

**`PickSide` 必须和 `CorrectSide` 用同一套左右编码（0=左、1=右）。** 两者一起喂给 `Equal` 判对错，编码相反时判定会整体取反 —— 表现为爱心与边框颜色互相矛盾（爱心绿配己方框红）。曾因 `PickSide` 写成 1=左 踩过这个坑。

**左右两框的状态强制成对。** 左右「选中」边框在场景里是独立实体、`selfvisible: false`。早前的做法是「摇头只亮己方框，对侧等判定链再显示」，一旦判定没走到（锁未解开、流程被打断）就卡在单侧亮着。现在改为**摇头时两框一起亮**，判定链只管成对着色、不碰显隐：

```
摇头     左显示 → 右显示
判定     左绿 → 右红 ／ 右绿 → 左红 ／ 左红 → 右绿 ／ 右红 → 左绿
切题复位 左紫 → 右紫 → 左隐藏 → 右隐藏
```

配对性靠[审计脚本](#616-成对的-ui-状态要做配对审计)保证，9 组操作全部左右对等。

**摇头锁不能在动画结束时解锁。** 摇头链的 `Do Once` 原先由「动画结束亮框」节点 Reset，t=1.0s 就解锁；此时玩家的头还偏着，角度判定立刻二次命中，会再飞一遍（爱心已随复位转紫）。而 t=1.2s 复位又把两框刷紫 —— 对侧色实际只存活 0.2 秒还被二次飞行盖住，看起来就是"对侧根本没变色"。改为由切题时的 `LockAnswer=false` 解锁。

`LockAnswer` 四个写入点的语义（改动前务必分清）：

| 节点 | 值 | 时机 |
| ---- | ---- | ---- |
| 判定入口后 | `true` | 判定时上锁 |
| 切题链 | `false` | **切题时解锁 ← 摇头锁的正确 Reset 源** |
| Start 链 | `false` | 初始化 |
| 结算分支 | `true` | 答满后锁死 |

### 4.4 推进与结算

```
Wait for Seconds(1.2s)
   → CurQuestion+1
   → 左右框恢复紫色 → 隐藏左右框 → 爱心恢复紫色
   → LockAnswer=false
   → If(CurQuestion ≥ 5)
        False → 回「出题入口」（循环）
        True  → LockAnswer=true（锁死，防止结算后继续判定）
                → 隐藏答题 UI → 隐藏「选择题」→ 显示「结果」
                → 合并字符串("得分："+ Score +"/5") → 设文本(结果)
```

题数正好 5：初始化写 `CurQuestion=0` 出第 1 题，此后每答一题 +1，答完第 5 题时累到 5 触发结算。

定为 5 题是因为抖音默认录制档位是 15 秒：单题固定开销约 1.35s（摇头动画 1.0s 与判定同帧 + 答完停留 1.2s + 写新题 0.05s），加玩家看题转头 2~3s，实际单题 3~4s。10 题需 30~40s 会被截断，5 题约 15~20s 勉强适配，60 秒档宽裕。**五个官方示例无一有计时器/倒计时节点**，本项目也不设超时 —— 玩家不摇头就一直等当前题，不自动跳题也不判负。

**结算分支要自己锁 `LockAnswer`。** `LockAnswer=false` 那个节点在切题链上，结算走的是 `If` 的另一个分支、不经过它。不补这一步的话，结果页显示后继续摇头仍会触发判定，`Score` 和 `CurQuestion` 会接着涨。

### 4.5 出题入口与预览一致性

**核心约束：预览画面与开拍后必须是同一道题。** 做法是「出题只有一个入口，开拍只重绘」。

```
出题（三源共用一把 Do Once 锁，先到者出题，后到者被挡）
  Start（特效启动，category=Event，走 onStart 生命周期）
  Video Record.未开拍时（每帧轮询）
  Update → Sequence.Procedure 2（每帧）
        ↓
  Do Once → CurQuestion=0 → 结果隐藏 → Score=0 → LockAnswer=false
        → 「出题入口」→ 随机 → 写文本

开拍（只读变量重绘，绝不随机）
  隐藏提示 → 隐藏结果 → 开拍=true → ⏱0.05s → 写题目/左/右
```

**三个源都接是有意为之** —— 它们在预览阶段的可靠性不一致，共用一把锁就不会重复出题。`Start` 节点需要从示例工程移植，见 [6.13](#613-节点模板随工程走搜不到不等于没有)。

**开拍时严禁任何出题逻辑。** 只允许接 UI（隐藏提示、重绘文本）。「点开相机题目跳变」的根源就是开拍时额外跑了一套随机 —— 本项目为此反复返工多次。可达性自查：从 `On Start` 出发 BFS，可达节点中不得出现 `Index Generator`、不得触达「出题入口」、不得改写 `NumA`/`NumB`/答案类变量。

**别用「读布尔变量判断是否已初始化」。** 变量未写入时 `If` 可能两个分支都不走，初始化链看着完整却一次都没执行。`Do Once` 不依赖任何变量，更可靠。

---

## 五、变量表

### 本项目新增（15 个）

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
| `LockAnswer` | Boolean | 答题锁，防一次摇头重复判定；结算时也要置 true |
| `MaxNumber` | Number | 出题数值上限（初值 100），`#132` / `#134` 两个 Index Generator 的 `To` 都读它 |
| `Inited` | Boolean | ⚠️ 已停用，初始化改用 `Do Once` |

`CorrectSide` 与 `PickSide` **必须共用同一套左右编码**，否则判定整体取反，详见 [4.3](#43-判定链)。

### 示例遗留（11 个）

`选项内容` `随机内容` `右内容` `题目内容` `正确边`（题库数组，已停用，读取点全在死链）、
`开拍` `i` `time` `选中` `执行1次` `左右`（原 PhotoSelect 逻辑，部分仍在用）。

其中两个容易误判：

- **`开拍`** 不是"是否在录制"，而是**摇头动画进行中的锁**。摇头触发时置 `false` 锁住防重复，动画结束（`Transit by Time.End`）置回 `true`。首次解锁靠 `Video Record.On Start` 链。
- **`time`** 给 12 个 `Transit by Time` 供 `Duration`，写 0 次读 2 次，靠 `initialValue: 1` 取值。**不是 bug**，PhotoSelect 原版也这样，见 [6.4](#64-变量实体存在子图里)。

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

实体的关键字段是 `variableName` / `variableType` / **`initialValue`**（数组变量则是 `isArray: true` + `arrayValue`）。

**变量的初值来自 `initialValue`，不是靠 SETTER 赋值。** 所以「写 0 次、读 N 次」的变量不等于 nil —— 例如 `time` 从没有写入点，却给 12 个 `Transit by Time` 供 `Duration`，靠的就是 `initialValue: 1`；PhotoSelect 原版同样是写 0 读 2。排查 nil 时别被"未写入"误导，先去变量实体里看初值。

### 6.5 像塑没有的东西

| 找过但没有 | 替代方案 |
| ---- | ---- |
| 数字转字符串（独立节点） | `Data Convert` 接字符串输出 |
| Random Integer / Random Boolean | `Index Generator` 的 Random 模式 |

> **以下两条曾被记为「不支持」，是错的，已更正：**
>
> **自定义 JS/TS 脚本组件 —— 支持。** 编辑器可直接新建脚本组件，生成的是 TypeScript 模板：
> ```ts
> @component()
> export class Foo extends APJS.BasicScriptComponent {
>   onInit() {}                        // 组件加入 SceneObject 后
>   onStart() {}                       // 第一帧更新前
>   onUpdate(deltaTime: number) {}     // 每帧
> }
> ```
> `APJS` 是全局对象，不需要 `require`。`tsconfig.json` 已开 `experimentalDecorators`、
> `include` 含 `Assets/**/*.ts`。场景里挂载后表现为 `__class: JSScriptComponent`
> （3D 跟踪头模挂的 `js/FaceFitting3D.js` 就是现成样例）。
> 脚本里取组件：`this.getSceneObject().scene.findSceneObject('名字').getComponent('Text')`，
> 改文字用属性赋值 `text.text = '...'`（**不是** `setText()`）。
>
> **自定义节点 `@customNode()` —— 定义齐全。** `OrionDecorators.d.ts` 里
> `@customNode()` / `@component()` / `@input()` / `@output()` / `@serializeProperty`
> 都有完整签名与示例。本项目最终没用上（纯蓝图已够），但不应再当作"不支持"。

### 6.6 蓝图硬编码坐标不会跟随场景

`Set Component Property(anchoredPosition)` 里的坐标是写死的。**在编辑器里挪动对象后，运行时会被蓝图拉回旧位置**。本项目曾因爱心从 Y=460 挪到 420，运行时又跳回 460。

改布局后要同步检查蓝图里的位置/缩放节点。

### 6.7 字符串常量可以直接填在端口里

UI 上「合并字符串」的端口不让输入文字，但 `portValue` 在 JSON 层就是 `{"type":"String","value":""}`，**外部编辑可以直接填**。所以 `+`、`-`、`=?` 这些符号不需要额外的「字符串常量」节点。

### 6.8 算术/比较节点必须选定 `curSelectedType`

`Add` `Subtract` `Equal` `Greater or Equal` `Less or Equal` 这些节点是**多态**的（Double / Vector2f / Vector3f / String…），靠 `curSelectedType` 决定用哪个运算实现。

复制节点时这个字段会是**空串**，等于没绑定任何实现，**输出恒为 nil**，下游 `Data Convert` 拿到 nil 就把 `"nil"` 原样显示出来。

本项目的答案长期显示 `nil` 就是这个原因，而且极难定位 —— 数据连线、变量引用、GETTER 形态查下来全是对的。**辨认特征：凡是直连变量或用端口内置值的地方都有值，凡是中间过了算术节点的一律 nil。**

对照工程里 PhotoSelect 原生带的节点即可确认：

```
#62 Subtract  curSelectedType = "Double"    ← 原生，正常
#145 Add      curSelectedType = ""          ← 复制来的，输出 nil
```

数值运算填 `"Double"`。注意别误改字符串比较（本项目 `#107`/`#111` 比较「左右」，应保持 `"String"`）。

### 6.9 新增节点的 `__uniqueId` 必须是 UUID 字符串

本工程的 id 全部是 `945b6261-d21c-6035-599e-5ab07c11e948` 这种 UUID **字符串**。给新节点分配数字 id（哪怕数值上不重复）会让像塑解析不到引用，**整张图直接不执行** —— 连和改动毫不相干的链路都停摆。

踩过的具体形态：脚本里用

```js
if (typeof o.__uniqueId === 'number' && o.__uniqueId > maxId) maxId = o.__uniqueId
```

求最大 id 再自增。由于全图没有一个 number 型 id，该条件从不成立，`maxId` 恒为 0，新节点拿到了 `1..12`。

**这类错误常规自查抓不到**：重复检测若用 `Set` 存原值，`"1"` 和 `1` 不相等，`dup` 报 0，六项校验全绿，图却是坏的。**校验时要把 id 统一 `String()` 归一，并且额外断言"所有 id 均为 string 类型"。**

### 6.10 端口的 `isConnected` 要与实际连线保持一致

端口上有个 `isConnected` 布尔位。**外部改连线时如果只动 `Edge`、不同步这个位，节点可能不执行。**

本项目开局初始化连续几轮都不生效就卡在这里：`Do Once` 子图逻辑正确、`Enter` 确实接在 `Sequence.Procedure 2` 上、`nodeSettings` 与工作正常的 `#70` 完全一致，唯一的差别是 —— `#247.Procedure 1` 明明连着摇头判定（一直在跑）却标着 `isConnected: false`。做全图校正后开局恢复正常。

校正方法：先收集所有 `Edge` 用到的端口 id，再遍历每个 `ScriptPort` 令 `isConnected = used.has(id)`。本项目一次改掉 17 处（8 个漏标 true、9 个多标 true）。

> 严格说因果没有 100% 坐实 —— 同一轮里也重开了工程。但这是当时唯一能解释「结构全对却不执行」的差异，而且校正本身无副作用，建议**每次改完连线都跑一遍**，已加入[必查清单](#每次改完必查)。

### 6.11 `Video Record` 四个引脚的触发机制不同

工程内 `Graph/ScriptTemplate/RecordVideo/CGRecordVideo.js` 就是它的实现：

```js
class CGRecordVideo extends BaseNode {
  constructor() { this._videoRecordFlag = false }

  onUpdate(e, t) {                                                        // ← 帧循环
    if (this.nexts[1] != null &&  this._videoRecordFlag) this.nexts[1]()  // 开拍过程中
    if (this.nexts[3] != null && !this._videoRecordFlag) this.nexts[3]()  // 未开拍时
  }
  _onRecordingStarted() { this._videoRecordFlag = true;  this.nexts[0]() } // 开拍时
  _onRecordingEnded()   { this._videoRecordFlag = false; this.nexts[2]() } // 停止时
}
```

| 引脚 | 机制 | 说明 |
| ---- | ---- | ---- |
| 开拍时 / 停止时 | 引擎录制事件回调 | 与帧循环无关，必定触发 |
| 未开拍时 / 开拍过程中 | 写在 `onUpdate` 里 | 「未开拍时」= 每帧检查一次，若不在录制中就触发 |

即「未开拍时」并不是一个启动事件，而是**每帧轮询**，和 `Update` 节点吃同一套帧循环。它每帧都触发，直接接出题逻辑会让数字狂刷，**必须配布尔锁**（`Do Once` 就是现成的锁）。

> 曾据此推断「预览阶段没有帧循环，纯蓝图无法在开拍前出题」，**这个结论是错的**。实测未开拍阶段 `Not Recording` 与 `Update` 都能执行。当时之所以看不到效果，是我把这两个驱动源都断开了、只留一个未生效的入口，然后拿断开后的结果当证据 —— 排查时务必确认「没效果」是真没执行，而不是自己把源砍了。

### 6.12 Pulse 输出不能一对多，分叉必须用 Sequence

**数据输出可以一对多**（`Index Generator.Index` 同时喂三个计算节点是正常的），但**执行流（Pulse）输出接多条线会导致只有一条生效**。

本项目曾把两个 `Do Once.Reset` 直接挂到 `LockAnswer=false` 的 Pulse 输出上，使其变成一对三（原有的结算判断 + 两个 Reset），结果**切题与结算整段被跳过** —— 题目卡在首题、答满也不出结果，而结构校验全绿。

判断依据很硬：PhotoSelect 原版 **0 处** Pulse 一对多。原生从不这么接。

需要分叉就插一个 `Sequence`，用它的 `Procedure 1/2/3` 分发。已列入[必查清单](#每次改完必查)。

### 6.13 节点模板随工程走，搜不到不等于没有

`Graph/ScriptTemplate/<节点名>/` 只包含**本工程用过的**节点。没用过的节点既不在目录里，**编辑器的节点搜索框也搜不到**。

本项目为此绕了很大弯路：一直找不到「特效启动时」这类事件，几乎认定平台不支持、准备改用 JS 脚本。最后在官方示例工程「脚本组件」里找到了：

```
Graph/ScriptTemplate/OnStart/node.json
  name        : Start
  category    : Event
  nodeEvent   : ["onStart"]
  description : Execute the next node when an effect starts.
CGOnStart.js
  class CGOnStart extends BaseNode { onStart(sys) { this.nexts[0]() } }
```

它走 `onStart` 生命周期、不依赖帧循环。**移植办法**：把 `ScriptTemplate/OnStart/` 整个目录复制过来，再从示例工程的 `graph.json` 里复制一份节点实例，重写 id 与 `owner`。

> 找不到某个节点时，先去其他示例工程的 `ScriptTemplate` 目录翻一遍，比猜「平台是否支持」有效得多。

### 6.14 一个 Text 有四处内容字段，必须同改

```yaml
_inner_input: !<str> 50+49=?     # 输入框的值，UI 重建时的初值来源
letters:                          # 逐字符排版缓存
  - utf8: !<str> 5
    initialPosition: {x: -1870.834, y: 6.25}   # x 是字符中心坐标
    ...
str:     !<str> 50+49=?          # 实际渲染内容
richStr: !<str> 50+49=?
```

只改其中一处，会在**别的时机**露出旧值：早前只改了 `_inner_input`，画布和运行时都没变化（那两处读 `str`）；后来只改 `str`/`letters`，点相机 UI 重建时又冒出 `_inner_input` 的旧值。

改 `letters` 时注意：`x` 是**字符中心坐标**，字符数不变就只换 `utf8` 值（最安全）；字符数变化要增删块并重算坐标（题目 7 字符中心距约 590，单字符居中时 x≈0）。运行时引擎会重排 letters，手写坐标只影响 UI 重建那一瞬。**最稳的做法仍是在编辑器里双击文本框修改，引擎会自动重建全部缓存。**

### 6.15 UI 重建会露出场景静态值

点相机时 UI 组件重建，Text 先回落到场景静态值，再被蓝图写回目标值 —— 两者不一致时那一瞬就是可见的闪烁。

治标是缩短赋值前的延时，**治本是让静态值等于目标值**。本项目把场景静态值设成一道完整的展示题（`50+49=?` / `99` / `98`），与首题对齐后闪烁彻底消失。

> 「先判断内容是否相同、相同则跳过赋值」这个思路解决不了它：判断读到的是重建后的当前值，静态值不对齐时判断必然不等、照样赋值。而静态值一旦对齐，闪烁本身就没了。

### 6.16 成对的 UI 状态要做配对审计

「左框绿则右框必红、左紫则右必紫」这类**成对约束**，靠逐条链人工检查很容易漏。做法是：把所有对左/右的操作按「颜色」「显隐」两类分组，沿 Pulse 链聚成连续组，统计每组内左右各出现几次，不相等即为不成对。

本项目据此查出三处破坏成对性的地方：摇头只亮己方框（对侧要等判定链，判定没走到就卡在单侧）、判定链里已冗余的显示节点、动画结束链里「隐藏单侧」后紧跟「显示两侧」（净效果成对但中间有一帧不同步）。

### 6.17 变量引用检查必须递归子图

判断某个变量能否删除时，**只扫主图 `nodeList` 会误判**。`TemplateGroup` 类节点（如 `Do Once`）的 `subContainer.graph.nodeList` 里也有 `VariableNode`。

本项目差点误删 `随机内容` —— 主图确实没有引用了，但两个子图里还各有一个节点在用，删完立刻出现 2 处悬空引用（已回滚）。

正确做法是全树递归收集 `__referenceId`，而不是只看 `containers[0].graph.nodeList`。

---

## 七、遗留与待办

### 可以清理（当前无害）

**出题是纯随机的，没有题库** —— 两个 `Index Generator(Random, 1~MaxNumber)` 出运算数，再随机加减号，现算现出。

早期曾走过预设题库方案，留下这些残骸：

| 残骸 | 状态 |
| ---- | ---- |
| ~~`题库.json`~~ | 已删（30 道预设题，工程内无任何文件引用它，当初只是生成数据的中间产物） |
| `选项内容[30]` `右内容[30]` `题目内容[30]` `正确边[30]` `随机内容[0]` | 数组数据内嵌在 `GraphVariable.arrayValue` 里，不读外部文件；读取点全在死链 |
| `Array Info` / `For Loop` / `Get Item from Array` 链路 | 初始化改用 `Do Once` 后整体脱离活跃链 |

从入口做可达性 BFS：活跃 176 / 全图 299 节点，差额基本就是这批遗留。留着不影响运行，想彻底清理可以连节点一起删。

### 未接线

- 干扰答案的偏移范围（1~20）仍硬编码在对应 `Index Generator` 的 `To`，未抽成变量
- `随机内容` 变量主图已无引用，但两个子图里还各有一个节点在用，**不能删**（见 [6.17](#617-变量引用检查必须递归子图)）

### 已验证（PC 端预览，2026-08-11）

打开工程即出第 1 题 → 连续答题、题目与左右选项每题刷新 → 摇头选中侧边框与三个爱心同色（答对绿、答错红）、对侧显示反色 → 答满隐藏答题 UI、显示得分。

### 待真机复验（改动较多，尚未整轮跑通）

以下几项在 PC 端改完后未做完整真机验证，是下一轮测试的重点：

| 项 | 预期 |
| ---- | ---- |
| 预览随机出题 | 进特效即显示随机题，不是场景静态的 `50+49=?` |
| 点开拍不换题 | 与预览同一道题，无跳变 |
| 左右框成对 | 左绿必右红、左紫必右紫，不出现单侧变色 |
| 无二次飞行 | 一次摇头只飞一次，摇头锁到切题才解开 |
| 切题与结算 | 答满 5 题隐藏答题 UI、显示「得分：X/5」 |
| 数字是否显浮点 | 如出现 `37.0` 需在转换前加取整（目前未见） |

### 已解决

- ~~结算后摇头链路仍在跑~~ → 结算分支补了 `LockAnswer=true`，见 [4.4](#44-推进与结算)
- ~~爱心飞行动画未与答对事件关联~~ → 已随判定着色，见 [4.3](#43-判定链)
- ~~预览与开拍题目不一致~~ → 出题收敛到单一入口 + 开拍只重绘，见 [4.5](#45-出题入口与预览一致性)
- ~~左右边框状态不同步~~ → 摇头时成对亮起 + 配对审计，见 [6.16](#616-成对的-ui-状态要做配对审计)
- ~~切题与结算被跳过~~ → Pulse 一对多改用 Sequence 分流，见 [6.12](#612-pulse-输出不能一对多分叉必须用-sequence)

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
| **id 均为字符串** | 断言全图 `typeof __uniqueId === 'string'`，见 [6.9](#69-新增节点的-__uniqueid-必须是-uuid-字符串) |
| id 唯一 | 收集所有 id **`String()` 归一后**比对 `Set` 大小 |
| 悬空引用 | 每个 `__referenceId` 都能在 id 表里找到 |
| 端点可解析 | 每条边的两个 portId 都能在端口表里找到 |
| owner 一致 | 每个端口的 `owner.__referenceId` == 所属节点 id |
| **多态节点已选型** | 算术/比较节点的 `curSelectedType` 非空，见 [6.8](#68-算术比较节点必须选定-curselectedtype) |
| **isConnected 一致** | 每个端口的 `isConnected` == 是否真有边连着，见 [6.10](#610-端口的-isconnected-要与实际连线保持一致) |
| **Pulse 无一对多** | 执行流输出只能接一条线，分叉用 Sequence，见 [6.12](#612-pulse-输出不能一对多分叉必须用-sequence) |
| **成对状态已配对** | 左右框之类的成对 UI，按颜色/显隐分类做配对审计，见 [6.16](#616-成对的-ui-状态要做配对审计) |
| **变量引用含子图** | 判断变量能否删除时递归 `subContainer`，见 [6.17](#617-变量引用检查必须递归子图) |
| 数据口单源 | 非 Pulse 输入端口最多接一条线，见 [6.2](#62-一个输入端口只能接一条线) |
| 链尾断点数 | 与基线比对（本项目 26，全是 `Set Component Property.Next` 自然结束，不是断链） |
| 孤立节点 | 没有任何连线的节点 |
| 场景 guid 有效 | 节点引用的 guid 在 `main.scene` 里存在 |

全绿再提交，能挡掉绝大多数低级错误。**但挡不住逻辑错误** —— 结构合法不代表跑得对，最终还得在编辑器里验证。

### 比结构校验更管用的两招

**① 路径枚举。** 从入口沿 Pulse 走，`If` 处分叉展开，得到所有可能的执行路径；再统计每条路径上关键变量的写入次数。`>1` 说明后写覆盖前写，`0` 说明该分支漏赋值。本项目出题链 8 条路径，`RightAnswer` / `WrongAnswer` / `CorrectSide` / `DispA` / `DispB` 应当各写一次。这能查出"节点都在、连线也对，但某条分支上变量被写了两遍"这类结构校验完全看不见的问题。

**② 可达性染色。** 从真实入口（`Update` / `Screen Image Tap` / `Video Record`）做 Pulse BFS，把节点分成活跃与死链两类。用途有二：确认新加的逻辑真的挂在活跃链上；确认遗留代码的读取点都在死链、不会把 nil 带进来。

注意 **BFS 可达 ≠ 实际执行** —— BFS 会把 `If` 的两个分支都算进去，而运行时只走一条。判断"这个节点到底跑没跑"要用路径枚举，不能只看可达性。

---

## 分支约定

见仓库根目录 [README](../README.md)。

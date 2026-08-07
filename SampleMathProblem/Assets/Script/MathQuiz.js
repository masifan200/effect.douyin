/**
 * 摇头口算大挑战 —— 出题 / 判题 / 计分 / 结算
 *
 * 运行时随机生成算式，不依赖题库数组。
 *
 * 摇头判定的角度制与阈值来自原 PhotoSelect 示例的蓝图（已调校过）：
 *   角度是 0~360 度制，不是 ±15。头左转是 330~345，不是负数。
 *   读的是「3D 跟踪头模」Transform 的 localEulerAngles.z。
 *
 * 挂载：场景根节点（或任意常驻节点）
 * 绑定：见 onStart 的绑定清单
 */

const APJS = require('amazingpro.js');

// ---------------- 可调参数 ----------------

const TOTAL_QUESTIONS = 10;    // 总题数

const YAW_RIGHT_MIN = 15;      // 头右转区间
const YAW_RIGHT_MAX = 30;
const YAW_LEFT_MIN  = 330;     // 头左转区间（0~360 度制，330 即 -30）
const YAW_LEFT_MAX  = 345;
const YAW_CENTER    = 10;      // 回正死区：0~10 与 350~360

const RESULT_DELAY  = 1.2;     // 答完停留多久出下一题（秒）

const NUM_MIN = 1;             // 随机数范围
const NUM_MAX = 100;
const MAX_ANSWER = 999;        // 答案上限，超了版面装不下

// 边框颜色
const COLOR_RIGHT   = { r: 0.20, g: 0.85, b: 0.40, a: 1 };  // 绿：正确
const COLOR_WRONG   = { r: 1.00, g: 0.30, b: 0.30, a: 1 };  // 红：错误
const COLOR_DEFAULT = { r: 0.5254902, g: 0.3568628, b: 0.945098, a: 1 };  // 紫：默认（原素材色）

/**
 * 干扰答案策略与权重。
 *
 * 不用纯随机 —— 那样要么差得离谱一眼排除，要么全靠蒙。
 * 按真实的口算错误类型构造，让一部分题出现「两个答案看着都对」的犹豫感。
 * 想整体调难：加大 near / swap；想调简单：加大 far。
 */
const WRONG_STRATEGIES = [
    { name: 'far',   weight: 40 },  // 差 6~22，一眼排除，给玩家喘息
    { name: 'carry', weight: 20 },  // 差 ±10，进位/借位错误，最常见的真实失误
    { name: 'unit',  weight: 15 },  // 只改个位，十位对个位错
    { name: 'near',  weight: 15 },  // 差 ±1~3，必须真算一遍
    { name: 'swap',  weight: 10 },  // 交换十位个位，视觉迷惑最强
];

class MathQuiz extends APJS.ScriptComponent {

    onStart() {
        // 节点自动按名字查找，无需在检查器里逐个拖拽绑定。
        // 若已手动绑定同名属性，则优先使用绑定值。
        this.autoBind();

        this.questionIndex = 0;      // 已答题数
        this.correctCount  = 0;      // 答对数
        this.leftIsCorrect = false;  // 本题正确答案是否在左边
        this.locked        = false;  // 答题锁定，防止一次摇头重复触发
        this.resultTimer   = -1;     // 出下一题的倒计时，-1 表示未启动
        this.finished      = false;

        this.setBoxColor(this.leftBox,  COLOR_DEFAULT);
        this.setBoxColor(this.rightBox, COLOR_DEFAULT);
        if (this.resultText) { this.resultText.enabled = false; }

        this.newQuestion();
    }

    onUpdate(dt) {
        if (this.finished) {
            return;
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
            return;
        }

        const yaw = this.readYaw();
        if (yaw === null) {
            return;                       // 没检测到人脸
        }

        // 回正后解锁，这样一次摇头只判一次
        if (this.isCentered(yaw)) {
            this.locked = false;
            return;
        }
        if (this.locked) {
            return;
        }

        if (yaw >= YAW_RIGHT_MIN && yaw <= YAW_RIGHT_MAX) {
            this.locked = true;
            this.checkAnswer(false);      // 头右转 → 选右
        } else if (yaw >= YAW_LEFT_MIN && yaw <= YAW_LEFT_MAX) {
            this.locked = true;
            this.checkAnswer(true);       // 头左转 → 选左
        }
    }

    // ---------------- 自动绑定 ----------------

    /** 取当前场景，几种可能的访问路径都试一遍 */
    getScene() {
        return this.scene
            || (this.entity && this.entity.scene)
            || (this.sceneObject && this.sceneObject.scene)
            || null;
    }

    /** 按名字找场景对象，可限定父节点（同名的「选中」靠这个区分） */
    find(name, parent) {
        const scene = this.getScene();
        if (!scene || !scene.findSceneObject) { return null; }
        try {
            return parent ? scene.findSceneObject(name, parent) : scene.findSceneObject(name);
        } catch (err) {
            return null;
        }
    }

    /** 取节点上的组件，失败返回 null */
    comp(node, type) {
        if (!node || !node.getComponent) { return null; }
        try { return node.getComponent(type); } catch (err) { return null; }
    }

    /**
     * 自动查找所有需要的节点。
     * 场景层级：
     *   选择题 > 题目 > 前色 > 题目(Text)
     *          > 左 > 前 > 内容-左(Text) > 选中(ImageRenderer)
     *          > 右 > 内容-右(Text) > 选中(ImageRenderer)
     *   结果(Text)   特效 > 3D 跟踪头模
     */
    autoBind() {
        const nLeft  = this.find('内容-左');
        const nRight = this.find('内容-右');

        if (!this.questionText) {
            // 「题目」既是容器名也是文字节点名，从「前色」下面找更准
            const front = this.find('前色');
            const nTitle = this.find('题目', front) || this.find('题目');
            this.questionText = this.comp(nTitle, 'Text');
        }
        if (!this.leftText)   { this.leftText   = this.comp(nLeft,  'Text'); }
        if (!this.rightText)  { this.rightText  = this.comp(nRight, 'Text'); }
        if (!this.resultText) { this.resultText = this.comp(this.find('结果'), 'Text'); }

        // 两个「选中」同名，必须限定父节点
        if (!this.leftBox)  { this.leftBox  = this.comp(this.find('选中', nLeft),  'ImageRenderer'); }
        if (!this.rightBox) { this.rightBox = this.comp(this.find('选中', nRight), 'ImageRenderer'); }

        if (!this.headNode) { this.headNode = this.find('3D 跟踪头模'); }

        const missing = [];
        if (!this.questionText) { missing.push('题目文本'); }
        if (!this.leftText)     { missing.push('内容-左'); }
        if (!this.rightText)    { missing.push('内容-右'); }
        if (!this.resultText)   { missing.push('结果'); }
        if (!this.leftBox)      { missing.push('左选中框'); }
        if (!this.rightBox)     { missing.push('右选中框'); }
        if (!this.headNode)     { missing.push('3D 跟踪头模'); }
        if (missing.length) {
            console.log('[MathQuiz] 未找到：' + missing.join('、') + ' —— 请在检查器手动绑定这几项');
        } else {
            console.log('[MathQuiz] 全部节点自动绑定成功');
        }
    }

    // ---------------- 人脸角度 ----------------

    /** 0~10 与 350~360 都算回正 */
    isCentered(yaw) {
        return yaw <= YAW_CENTER || yaw >= (360 - YAW_CENTER);
    }

    /**
     * 读「3D 跟踪头模」的 Transform 旋转 Z 分量，即摇头角度。
     * 与蓝图 Get Component Property(localEulerAngles) → Split.Z 是同一个数据源。
     */
    readYaw() {
        if (!this.headNode) {
            return null;
        }
        const t = this.headNode.transform || this.headNode;
        const e = t && t.localEulerAngles;
        if (!e) {
            return null;
        }
        let yaw = e.z;
        if (yaw === undefined || yaw === null) {
            return null;
        }
        yaw = yaw % 360;
        if (yaw < 0) { yaw += 360; }      // 统一成 0~360
        return yaw;
    }

    // ---------------- 显示 ----------------

    setBoxColor(box, c) {
        if (!box) { return; }
        // Color 可能需要构造，也可能直接赋字段，两种都兼容
        if (APJS.Color) {
            try { box.color = new APJS.Color(c.r, c.g, c.b, c.a); return; } catch (err) { /* 落到下面 */ }
        }
        box.color = { r: c.r, g: c.g, b: c.b, a: c.a };
    }

    // ---------------- 出题 ----------------

    randInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    pickStrategy() {
        let total = 0;
        for (let i = 0; i < WRONG_STRATEGIES.length; i++) { total += WRONG_STRATEGIES[i].weight; }
        let r = Math.random() * total;
        for (let i = 0; i < WRONG_STRATEGIES.length; i++) {
            r -= WRONG_STRATEGIES[i].weight;
            if (r <= 0) { return WRONG_STRATEGIES[i].name; }
        }
        return 'far';
    }

    applyStrategy(name, correct) {
        switch (name) {
            case 'near': {
                const d = this.randInt(1, 3);
                return Math.random() > 0.5 ? correct + d : correct - d;
            }
            case 'carry':
                return Math.random() > 0.5 ? correct + 10 : correct - 10;
            case 'unit': {
                const base = Math.floor(correct / 10) * 10;
                const unit = correct % 10;
                let nu = this.randInt(0, 9);
                if (nu === unit) { nu = (unit + 1 + this.randInt(0, 8)) % 10; }
                return base + nu;
            }
            case 'swap': {
                // 交换最后两位，不是整串颠倒 —— 125 颠倒成 521 首位差太远，
                // 一眼就能排除；换成 152 才够迷惑。
                const s = String(correct);
                if (s.length < 2) { return -1; }
                const last2 = s.slice(-2);
                if (last2.charAt(0) === last2.charAt(1)) { return -1; }
                return Number(s.slice(0, -2) + last2.charAt(1) + last2.charAt(0));
            }
            default: {
                const off = this.randInt(6, 22);
                return Math.random() > 0.5 ? correct + off : correct - off;
            }
        }
    }

    /** 非负、不等于正确答案、不超 3 位 */
    isValidWrong(w, correct) {
        return w >= 0 && w !== correct && w <= MAX_ANSWER;
    }

    makeWrongAnswer(correct) {
        let w = this.applyStrategy(this.pickStrategy(), correct);
        if (this.isValidWrong(w, correct)) { return w; }
        w = this.applyStrategy('far', correct);
        if (this.isValidWrong(w, correct)) { return w; }
        const off = this.randInt(6, 22);
        w = correct + off;
        return w > MAX_ANSWER ? correct - off : w;
    }

    newQuestion() {
        const a = this.randInt(NUM_MIN, NUM_MAX);
        const b = this.randInt(NUM_MIN, NUM_MAX);

        let trueAns, expr;
        if (Math.random() > 0.5) {
            trueAns = a + b;
            expr = a + "+" + b + "=?";
        } else {
            // 减法：大数减小数，保证结果非负
            const big = Math.max(a, b), small = Math.min(a, b);
            trueAns = big - small;
            expr = big + "-" + small + "=?";
        }

        const wrong = this.makeWrongAnswer(trueAns);
        this.leftIsCorrect = Math.random() > 0.5;

        this.questionText.str = expr;
        this.leftText.str  = String(this.leftIsCorrect ? trueAns : wrong);
        this.rightText.str = String(this.leftIsCorrect ? wrong : trueAns);

        this.setBoxColor(this.leftBox,  COLOR_DEFAULT);
        this.setBoxColor(this.rightBox, COLOR_DEFAULT);
    }

    // ---------------- 判题与结算 ----------------

    /**
     * 选对：己方绿。
     * 选错：己方红，同时对侧强制绿 —— 让玩家看到正确答案在哪。
     */
    checkAnswer(pickLeft) {
        if (this.finished || this.resultTimer > 0) { return; }

        const isRight = (pickLeft === this.leftIsCorrect);
        if (isRight) { this.correctCount++; }
        this.questionIndex++;

        const pickedBox = pickLeft ? this.leftBox  : this.rightBox;
        const otherBox  = pickLeft ? this.rightBox : this.leftBox;
        if (isRight) {
            this.setBoxColor(pickedBox, COLOR_RIGHT);
        } else {
            this.setBoxColor(pickedBox, COLOR_WRONG);
            this.setBoxColor(otherBox,  COLOR_RIGHT);   // 对侧亮出正确答案
        }

        this.resultTimer = RESULT_DELAY;
    }

    /** 结算：隐藏答题 UI，中间显示总分 */
    showFinal() {
        this.finished = true;

        this.questionText.enabled = false;
        this.leftText.enabled     = false;
        this.rightText.enabled    = false;
        if (this.leftBox)  { this.leftBox.enabled  = false; }
        if (this.rightBox) { this.rightBox.enabled = false; }

        if (this.resultText) {
            this.resultText.enabled = true;
            this.resultText.str = "得分：" + this.correctCount + "/" + TOTAL_QUESTIONS;
        }
    }

    // ---------------- 调试 ----------------

    /** 不接人脸时可手动调用，验证答题流程 */
    debugPickLeft()  { this.locked = false; this.checkAnswer(true);  }
    debugPickRight() { this.locked = false; this.checkAnswer(false); }
}

exports.MathQuiz = MathQuiz;

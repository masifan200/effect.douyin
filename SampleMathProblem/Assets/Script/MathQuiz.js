/**
 * 摇头口算大挑战 —— 出题 / 判题 / 计分 / 结算
 *
 * 场景结构（对应像塑对象面板）：
 *   通用                        答题界面，10 题结束后整体隐藏
 *     背景_计算 > 文字            算式，如 1+2=?
 *     按钮_左边 > 文字            左侧答案
 *     按钮_右边 > 文字            右侧答案
 *   2D 前景                     结算界面，开局隐藏
 *     最终分数                    如 8/10
 *
 * 显隐控制走组件的 enabled，不依赖 Entity 可见性，
 * 所以「通用部分消失」= 把算式、两个按钮图和它们的文字一起 disable。
 */

const APJS = require('amazingpro.js');

// ---------------- 可调参数 ----------------

const TOTAL_QUESTIONS = 10;   // 总题数，改 5 就是 5 题模式
const YAW_THRESHOLD   = 15;   // 摇头判定角度（度）
const ANSWER_COOLDOWN = 2.0;  // 每题开始后的答题冷却（秒）
const RESULT_DELAY    = 1.5;  // 答完停留多久出下一题（秒）
const NUM_MIN         = 1;    // 随机数下限
const NUM_MAX         = 100;  // 随机数上限
const WRONG_MIN_GAP   = 6;    // far 策略的最小差值
const WRONG_MAX_GAP   = 22;   // far 策略的最大差值
const MAX_ANSWER      = 999;  // 答案上限

/**
 * 干扰答案生成策略与权重。
 *
 * 不用纯随机 —— 那样要么一眼排除、要么全靠蒙。这里按**真实的口算错误类型**
 * 来构造干扰项，让一部分题目出现「两个答案看着都对」的犹豫感。
 *
 * 权重可自由调整，不必凑成 100，代码按总和归一化。
 * 想整体调难：加大 near / swap 的权重；想调简单：加大 far。
 */
const WRONG_STRATEGIES = [
    { name: 'far',   weight: 40 },  // 差 6~22，一眼就能排除，给玩家喘息
    { name: 'carry', weight: 20 },  // 差 ±10，进位/借位错误，最常见的真实失误
    { name: 'unit',  weight: 15 },  // 只改个位，如 78 → 73，十位对个位错
    { name: 'near',  weight: 15 },  // 差 ±1~3，非常接近，需要认真算
    { name: 'swap',  weight: 10 },  // 交换十位个位，如 78 → 87，视觉迷惑最强
];

class MathQuiz extends APJS.ScriptComponent {

    onStart() {
        // ---- 绑定清单（检查器中拖拽赋值）----
        // 文字组件：
        //   this.questionText   背景_计算 > 文字
        //   this.leftText       按钮_左边 > 文字
        //   this.rightText      按钮_右边 > 文字
        //   this.finalText      2D 前景 > 最终分数
        // 图片组件（结算时要一起隐藏，否则会剩下空按钮和空底板）：
        //   this.questionImage  背景_计算 的图片组件
        //   this.leftImage      按钮_左边 的图片组件
        //   this.rightImage     按钮_右边 的图片组件

        this.questionIndex = 0;      // 已答题数
        this.correctCount  = 0;      // 答对数
        this.leftIsCorrect = false;  // 本题正确答案是否在左边
        this.cd            = 0;      // 答题冷却剩余秒数
        this.resultTimer   = -1;     // 出下一题的倒计时，-1 表示未启动
        this.finished      = false;  // 是否已结算
        this.currentYaw    = 0;      // 头部 Yaw，由外部每帧写入

        // 开局：答题界面显示，结算界面隐藏
        this.setQuizVisible(true);
        this.finalText.enabled = false;

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
        const yaw = this.currentYaw;
        if (yaw > YAW_THRESHOLD) {
            this.checkAnswer(false);      // 头右转 → 选右
        } else if (yaw < -YAW_THRESHOLD) {
            this.checkAnswer(true);       // 头左转 → 选左
        }
    }

    // ---------------- 显隐 ----------------

    /** 答题界面整体显隐：算式 + 两个按钮（图和字一起） */
    setQuizVisible(visible) {
        this.questionText.enabled = visible;
        this.leftText.enabled     = visible;
        this.rightText.enabled    = visible;

        // 图片组件是可选绑定 —— 没绑也不会报错，只是结算时按钮底图还留着
        if (this.questionImage) { this.questionImage.enabled = visible; }
        if (this.leftImage)     { this.leftImage.enabled     = visible; }
        if (this.rightImage)    { this.rightImage.enabled    = visible; }
    }

    // ---------------- 出题 ----------------

    randInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /** 按权重抽一个干扰策略 */
    pickStrategy() {
        let total = 0;
        for (let i = 0; i < WRONG_STRATEGIES.length; i++) {
            total += WRONG_STRATEGIES[i].weight;
        }
        let r = Math.random() * total;
        for (let i = 0; i < WRONG_STRATEGIES.length; i++) {
            r -= WRONG_STRATEGIES[i].weight;
            if (r <= 0) {
                return WRONG_STRATEGIES[i].name;
            }
        }
        return 'far';
    }

    /**
     * 按指定策略生成一个候选干扰值。
     * 可能返回非法值（负数、与正确答案相同、超出位数），由调用方校验后回退。
     */
    applyStrategy(name, correct) {
        switch (name) {
            case 'near': {
                // 差 1~3：必须真算一遍才能分辨
                const d = this.randInt(1, 3);
                return Math.random() > 0.5 ? correct + d : correct - d;
            }
            case 'carry': {
                // 差 10：模拟进位/借位算错，如 56+22 答 68 而不是 78
                return Math.random() > 0.5 ? correct + 10 : correct - 10;
            }
            case 'unit': {
                // 十位保持不变，只改个位，如 78 → 73
                const base = Math.floor(correct / 10) * 10;
                const unit = correct % 10;
                let newUnit = this.randInt(0, 9);
                if (newUnit === unit) {
                    newUnit = (unit + 1 + this.randInt(0, 8)) % 10;
                }
                return base + newUnit;
            }
            case 'swap': {
                // 交换十位和个位，如 78 → 87、125 → 152。
                //
                // 注意是「交换最后两位」而不是「整串颠倒」：125 整串颠倒是 521，
                // 首位差太远反而一眼就能排除，失去迷惑性。
                //
                // 个位数（无法交换）和末两位相同的数（11、100）返回 -1，
                // 由校验拒绝后回退到 far。
                const s = String(correct);
                if (s.length < 2) {
                    return -1;
                }
                const last2 = s.slice(-2);
                if (last2.charAt(0) === last2.charAt(1)) {
                    return -1;
                }
                return Number(s.slice(0, -2) + last2.charAt(1) + last2.charAt(0));
            }
            case 'far':
            default: {
                const offset = this.randInt(WRONG_MIN_GAP, WRONG_MAX_GAP);
                return Math.random() > 0.5 ? correct + offset : correct - offset;
            }
        }
    }

    /**
     * 干扰答案必须满足：
     *   非负             —— 减法题结果可能很小，减去偏移会出负数
     *   不等于正确答案    —— 否则两个按钮显示同一个数，玩家怎么选都算错
     *   不超过 3 位       —— 保持版面整齐
     */
    isValidWrong(wrong, correct) {
        return wrong >= 0 && wrong !== correct && wrong <= MAX_ANSWER;
    }

    /** 生成干扰答案：先按权重抽策略，非法则逐级回退，保证一定产出合法值 */
    makeWrongAnswer(correct) {
        let wrong = this.applyStrategy(this.pickStrategy(), correct);
        if (this.isValidWrong(wrong, correct)) {
            return wrong;
        }

        // 一级回退：far 策略
        wrong = this.applyStrategy('far', correct);
        if (this.isValidWrong(wrong, correct)) {
            return wrong;
        }

        // 二级保底：只加不减，且不会超上限
        const offset = this.randInt(WRONG_MIN_GAP, WRONG_MAX_GAP);
        wrong = correct + offset;
        if (wrong > MAX_ANSWER) {
            wrong = correct - offset;
        }
        return wrong;
    }

    newQuestion() {
        const a = this.randInt(NUM_MIN, NUM_MAX);
        const b = this.randInt(NUM_MIN, NUM_MAX);

        let trueAns;
        let expr;

        if (Math.random() > 0.5) {
            // 加法
            trueAns = a + b;
            expr = a + "+" + b + "=?";
        } else {
            // 减法：大数减小数，保证结果非负
            const big   = Math.max(a, b);
            const small = Math.min(a, b);
            trueAns = big - small;
            expr = big + "-" + small + "=?";
        }
        this.questionText.str = expr;

        // 两个选项，正确答案随机落左或右
        const wrong = this.makeWrongAnswer(trueAns);
        this.leftIsCorrect = Math.random() > 0.5;

        this.leftText.str  = String(this.leftIsCorrect ? trueAns : wrong);
        this.rightText.str = String(this.leftIsCorrect ? wrong : trueAns);

        this.cd = ANSWER_COOLDOWN;
    }

    // ---------------- 判题与结算 ----------------

    checkAnswer(pickLeft) {
        if (this.finished || this.cd > 0 || this.resultTimer > 0) {
            return; // 冷却中 / 正在展示结果 / 已结束，忽略输入
        }

        if (pickLeft === this.leftIsCorrect) {
            this.correctCount++;
        }
        this.questionIndex++;

        this.resultTimer = RESULT_DELAY;
    }

    /** 结算：答题界面整体消失，中间显示最终成绩 */
    showFinal() {
        this.finished = true;
        this.setQuizVisible(false);
        this.finalText.enabled = true;
        this.finalText.str = this.correctCount + "/" + TOTAL_QUESTIONS;
    }

    // ---------------- 外部输入 ----------------

    /**
     * 由可视化节点每帧调用，把头部 Yaw 角度写进来。
     *
     * 之所以不在脚本里直接读，是因为像塑提供了两条路径
     * （effect.Amaz.FaceAction.HEAD_YAW 动作枚举，
     *   以及人脸信息结构里的 yaw 角度字段），确切签名需真机实测。
     * 用可视化节点接出来最稳，也方便单独调试角度值。
     */
    setYaw(yaw) {
        this.currentYaw = yaw;
    }

    /** 调试用：不接人脸时可由触摸/按键调用，验证答题流程 */
    debugPickLeft()  { this.cd = 0; this.checkAnswer(true);  }
    debugPickRight() { this.cd = 0; this.checkAnswer(false); }
}

exports.MathQuiz = MathQuiz;

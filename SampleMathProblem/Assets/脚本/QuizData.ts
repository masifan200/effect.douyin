// 题目数据 —— 由脚本在 onInit 阶段生成，供「渲染」与「桥接给蓝图」共用。
//
// 为什么需要它：脚本无法读写蓝图的 GraphVariable（APJS 里没有相应 API），
// 所以用模块级静态成员做中转 —— ProbeOnInit（@component）在 onInit 生成并写 UI，
// 之后由 @customNode 节点读出、@output 交给蓝图，保证预览与开拍是同一道题。
//
// 出题规则与蓝图出题链保持一致：
//   运算数    1 ~ MaxNumber（蓝图为两个 Index Generator，From=1、To=MaxNumber）
//   加减      各 50%（Index Generator 0~1）
//   减法      大数在前，避免负数
//   干扰答案  正确答案 ± 偏移，偏移 1~20（蓝图 #148 的 To=20）
//   正确边    0=左 1=右（Index Generator 0~1）

export class QuizData {

  /** 与蓝图变量 MaxNumber 的初值保持一致 */
  static maxNumber: number = 100;

  static dispA: number = 0;      // 显示用左运算数（减法时已排好大小）
  static dispB: number = 0;      // 显示用右运算数
  static isAdd: boolean = true;
  static rightAnswer: number = 0;
  static wrongAnswer: number = 0;
  static correctSide: number = 0; // 0=左 1=右

  /** onInit 是否已生成过，避免重复出题 */
  static ready: boolean = false;

  static generate(): void {
    const a = QuizData._rand(1, QuizData.maxNumber);
    const b = QuizData._rand(1, QuizData.maxNumber);
    QuizData.isAdd = QuizData._rand(0, 1) === 1;

    if (QuizData.isAdd) {
      QuizData.dispA = a;
      QuizData.dispB = b;
      QuizData.rightAnswer = a + b;
    } else {
      // 减法：大数在前，结果不为负
      QuizData.dispA = a >= b ? a : b;
      QuizData.dispB = a >= b ? b : a;
      QuizData.rightAnswer = QuizData.dispA - QuizData.dispB;
    }

    // 干扰答案：在正确答案上下浮动，且不与正确答案相同、不为负
    const offset = QuizData._rand(1, 20);
    let wrong = QuizData._rand(0, 1) === 1
      ? QuizData.rightAnswer + offset
      : QuizData.rightAnswer - offset;
    if (wrong < 0) {
      wrong = QuizData.rightAnswer + offset;
    }
    if (wrong === QuizData.rightAnswer) {
      wrong = QuizData.rightAnswer + 1;
    }
    QuizData.wrongAnswer = wrong;

    QuizData.correctSide = QuizData._rand(0, 1);
    QuizData.ready = true;
  }

  /** 题面，如 "50+49=?" */
  static get questionText(): string {
    return QuizData.dispA + (QuizData.isAdd ? '+' : '-') + QuizData.dispB + '=?';
  }

  /** 左选项文字 */
  static get leftText(): string {
    return String(QuizData.correctSide === 0 ? QuizData.rightAnswer : QuizData.wrongAnswer);
  }

  /** 右选项文字 */
  static get rightText(): string {
    return String(QuizData.correctSide === 0 ? QuizData.wrongAnswer : QuizData.rightAnswer);
  }

  /** 闭区间 [min, max] 内的随机整数，与 Index Generator 的 Random 模式同语义 */
  private static _rand(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

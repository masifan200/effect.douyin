// 桥接节点 —— 把脚本在 onInit 生成的题目数据交给蓝图。
//
// 背景：脚本无法读写蓝图的 GraphVariable（APJS 无相应 API），
// 而判定、着色、计分这些逻辑都在蓝图里，需要 RightAnswer / CorrectSide 等变量。
// 自定义节点是唯一的通路：它是蓝图节点，@output 的值可以直接连到蓝图的变量写入节点。
//
// 用法（蓝图侧）：
//   开拍时 → 本节点 → 把六个输出分别写入 DispA / DispB / IsAdd /
//            RightAnswer / WrongAnswer / CorrectSide → 再写文本
//   于是首题复用脚本已生成的那道，不再随机；第二题起仍走蓝图原有的随机出题链。
//
// 注意：本节点只负责「读出」，不负责生成。题目由 ProbeOnInit.onInit 生成，
// 那时帧循环尚未启动、蓝图还没跑，正好赶在预览画面之前。
// 若 QuizData 尚未生成（理论上不会），这里兜底生成一次，避免输出全零。

import { QuizData } from './QuizData';

@customNode()
export class QuizBridge extends BasicScriptNode {

  /** 显示用左运算数（减法时已排好大小） */
  @output()
  dispA: number = 0;

  /** 显示用右运算数 */
  @output()
  dispB: number = 0;

  /** true=加法，false=减法 */
  @output()
  isAdd: boolean = true;

  /** 正确答案 */
  @output()
  rightAnswer: number = 0;

  /** 干扰答案 */
  @output()
  wrongAnswer: number = 0;

  /** 正确答案在哪边：0=左 1=右（与蓝图 CorrectSide 编码一致） */
  @output()
  correctSide: number = 0;

  /** 题面文本，如 "56+74=?"，可直接接「赋值文本」 */
  @output()
  questionText: string = '';

  /** 左选项文本 */
  @output()
  leftText: string = '';

  /** 右选项文本 */
  @output()
  rightText: string = '';

  execute(): void {
    if (!QuizData.ready) {
      // 兜底：正常情况下 ProbeOnInit.onInit 已经生成过
      QuizData.generate();
    }
    this.dispA = QuizData.dispA;
    this.dispB = QuizData.dispB;
    this.isAdd = QuizData.isAdd;
    this.rightAnswer = QuizData.rightAnswer;
    this.wrongAnswer = QuizData.wrongAnswer;
    this.correctSide = QuizData.correctSide;
    this.questionText = QuizData.questionText;
    this.leftText = QuizData.leftText;
    this.rightText = QuizData.rightText;
  }
}

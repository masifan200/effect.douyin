// 桥接节点 —— 把脚本在 onInit 生成的题目数据交给蓝图。
//
// 为什么需要它：脚本读写不了蓝图的 GraphVariable（APJS 没有相应 API），
// 而判定、着色、计分都在蓝图里，需要 RightAnswer / CorrectSide 等变量。
// 自定义节点是唯一通路 —— 它本身是蓝图节点，@output 的值可直接连到变量写入节点。
//
// 分工（勿混淆）：
//   ProbeOnInit  @component  场景组件，有 onInit 生命周期，开拍前执行，负责**生成**题目
//   QuizBridge   @customNode 蓝图节点，仅在链路触发时跑 execute()，负责**读出**数据
// 自定义节点没有独立生命周期，替代不了 onInit。
//
// 蓝图接法：
//   开拍时 → 本节点 → 把输出分别写入 DispA / DispB / IsAdd /
//            RightAnswer / WrongAnswer / CorrectSide → 再写文本
//   首题即复用脚本已生成的那道，不再随机；第二题起仍走蓝图原有的随机出题链。
//
// 类名沿用编辑器生成的 CustomNodeTS —— 节点靠 resourceId + userScriptName 关联
// （graph.json 里 resourceId=fc91bea6…，即本文件 extra 的 guid），
// 但运行时加载仍可能依赖类名，故不改动。

import { QuizData } from './QuizData';

@customNode()
export class CustomNodeTS extends BasicScriptNode {

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

  /**
   * 由蓝图触发。只读出、不生成 ——
   * 题目在 ProbeOnInit.onInit 里就已生成（那时帧循环尚未启动，正赶在预览画面之前）。
   */
  execute() {
    if (!QuizData.ready) {
      // 兜底：正常情况下 onInit 已经生成过
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

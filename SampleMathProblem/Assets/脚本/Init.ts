// 探针：验证脚本生命周期能否在「摄像头未启动」阶段执行。
//
// 背景：蓝图的所有事件（Start / 未开拍时 / Update）底层都走帧循环，
// 而真机在未开拍时会冻结帧循环，导致预览阶段出不了题。
// 若脚本组件的 onInit / onStart 不受此限制，就能在开拍前把第一题准备好，
// 预览与开拍共用同一份数据，彻底消除换题与闪烁。
//
// 判定方法：真机扫码进入特效，**不要点开拍**，看最上方标题文字。
//
//   INIT-OK    onInit 在预览阶段已执行   → 脚本路线可行，出题逻辑可搬进来
//   START-OK   onInit 没跑但 onStart 跑了，仍在开拍前 → 同样可行
//   UPDATE-OK  前两者都被推迟，只有帧循环起来才执行 → 脚本路线无效，退回纯蓝图
//   标题没变    脚本未加载或挂载失败
//
// 改「标题」而不改题目：场景里有两层同名的「题目」，外层不带 Text 组件，
// findSceneObject 取到外层会误判成「脚本没跑」。标题是顶层 Text，一次就能取到。
//
// 本组件挂在「选择题」对象上。结论出来后本文件会改成正式实现或删除。

@component()
export class Init extends APJS.BasicScriptComponent {

  private _done: boolean = false;

  /** 组件加入 SceneObject 后调用，理论上不依赖帧循环 —— 本次要验证的就是它 */
  onInit() {
    this._mark('INIT-OK');
  }

  /** 第一帧更新前调用 */
  onStart() {
    if (!this._done) {
      this._mark('START-OK');
    }
  }

  /** 每帧调用。若只有它生效，说明生命周期全被推迟到帧循环启动之后 */
  onUpdate(deltaTime: number) {
    if (!this._done) {
      this._mark('UPDATE-OK');
    }
  }

  private _mark(tag: string) {
    try {
      const obj = this.getSceneObject().scene.findSceneObject('标题');
      if (!obj) {
        return;
      }
      const text = obj.getComponent('Text') as APJS.Text;
      if (!text) {
        return;
      }
      text.text = tag;
      this._done = true;
    } catch (e) {
      // 生命周期里抛异常可能导致整个特效加载失败，这里吞掉
    }
  }
}

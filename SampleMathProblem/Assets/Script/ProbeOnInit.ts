// 探针：确认用户脚本的生命周期能否在「摄像头未启动」阶段执行。
//
// 判定方法：扫码进入特效后，不要点开拍，看最上方标题。
//   INIT-OK   → onInit 在预览阶段已执行，脚本方案可行
//   START-OK  → onInit 未跑但 onStart 跑了，仍在开拍前，方案同样可行
//   UPDATE-OK → 前两者都被推迟，只有帧循环起来后才执行，脚本路线放弃
//   标题没变   → 脚本没加载，检查组件挂载
//
// 改标题而不改题目，是因为场景里有两层同名的「题目」，外层不带 Text 组件；
// 标题是顶层 Text，findSceneObject 一次就能取到，不会误判。
//
// 验证完请删除本文件与其组件挂载。

@component()
export class ProbeOnInit extends APJS.BasicScriptComponent {

  private _done: boolean = false;

  /** 组件被添加到 SceneObject 后调用，不依赖帧循环 —— 本次要验证的就是它 */
  onInit() {
    this._write('INIT-OK');
  }

  /** 第一帧更新前调用 */
  onStart() {
    if (!this._done) {
      this._write('START-OK');
    }
  }

  /** 每帧调用。若只有它生效，说明生命周期全被推迟到帧循环启动之后 */
  onUpdate(deltaTime: number) {
    if (!this._done) {
      this._write('UPDATE-OK');
    }
  }

  private _write(tag: string) {
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

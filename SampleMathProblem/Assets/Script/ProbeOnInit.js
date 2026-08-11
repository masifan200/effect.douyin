// 最小验证脚本：确认用户脚本的 onInit / onStart 能否在「摄像头未启动」阶段执行。
//
// 判定方法：扫码进入特效、不点开拍，观察题目文字。
//   显示 "INIT-OK"  → onInit 在预览阶段就执行了，脚本方案可行
//   显示 "START-OK" → onInit 没跑但 onStart 跑了（仍在开拍前，方案同样可行）
//   仍是 "50+49=?"  → 两个生命周期都被延迟到开拍之后，脚本路线放弃
//
// 挂载：像塑编辑器里选中任一场景对象 → 添加组件 → 脚本组件 → 选本文件。
// 验证完请删除本文件及其挂载。

const APJS = require('amazingpro');

// 「题目」文字所在对象名。场景里同名对象有两层（Entity「题目」与其孙节点 Text「题目」），
// findSceneObject 取第一个匹配；若写不进去，把这里换成 "内容-左" 再试。
const TARGET_NAME = '题目';

class ProbeOnInit extends APJS.BasicScriptComponent {
  onInit() {
    this._write('INIT-OK');
  }

  onStart() {
    // onInit 若已写成功，这里不再覆盖，便于区分是哪个钩子生效
    if (!this._done) this._write('START-OK');
  }

  _write(tag) {
    try {
      const scene = this.getSceneObject().scene;
      const obj = scene.findSceneObject(TARGET_NAME);
      if (!obj) return;
      const text = obj.getComponent('Text');
      if (!text) return;
      text.text = tag;
      this._done = true;
    } catch (e) {
      // 生命周期里抛异常可能导致整个特效不加载，这里吞掉
    }
  }
}

exports.ProbeOnInit = ProbeOnInit;

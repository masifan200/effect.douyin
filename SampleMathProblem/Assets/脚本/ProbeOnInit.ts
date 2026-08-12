// 开局初始化 —— 在 onInit 阶段生成第一道题并直接写进 UI。
//
// 为什么必须用脚本：蓝图的所有事件（Start / 未开拍时 / Update）底层都走帧循环，
// 而真机在未开拍时冻结帧循环，导致预览阶段出不了题、只能显示场景静态值，
// 点开拍后蓝图才随机出题 —— 于是预览与开拍是两道不同的题。
// 脚本组件的 onInit 不受帧循环限制（已实测：预览阶段标题即变为 INIT-OK），
// 在这里出题就能让预览画面直接显示随机题。
//
// 数据存在 QuizData 里，后续由 @customNode 节点交给蓝图，
// 开拍时蓝图复用同一份数据、不再随机，做到预览与开拍完全一致。
//
// 本组件挂在「2D 摄像机」上，挂载记录见 main.scene.extra：
//   objGuid Guid(5117433001502212277, 11203550331010629017) / rttiType ProbeOnInit
// 类名沿用 ProbeOnInit（原为探针名）—— 改名会使挂载失效，需在编辑器里重新绑定。

import { QuizData } from './QuizData';

@component()
export class ProbeOnInit extends APJS.BasicScriptComponent {

  /** 组件加入 SceneObject 后调用，早于帧循环 —— 出题时机就在这里 */
  onInit() {
    if (!QuizData.ready) {
      QuizData.generate();
    }
    this._render();
  }

  /** 兜底：万一 onInit 阶段 Text 组件尚未就绪，第一帧前再写一次 */
  onStart() {
    this._render();
  }

  /** 把 QuizData 的内容写进三个文本组件 */
  private _render(): void {
    this._setText('题目', QuizData.questionText);
    this._setText('内容-左', QuizData.leftText);
    this._setText('内容-右', QuizData.rightText);
  }

  private _setText(objectName: string, value: string): void {
    try {
      const text = this._findText(objectName);
      if (text) {
        text.text = value;
      }
    } catch (e) {
      // 生命周期里抛异常可能导致整个特效加载失败，这里吞掉
    }
  }

  /**
   * 按名字找带 Text 组件的对象。
   * 不能直接用 findSceneObject —— 场景里有两层同名的「题目」
   * （外层 Entity 不带 Text，内层才带），取到外层就写不进去。
   * 故遍历全部对象，返回第一个同名且确实带 Text 组件的。
   */
  private _findText(objectName: string): APJS.Text | null {
    const all = this.getSceneObject().scene.getAllSceneObjects();
    for (let i = 0; i < all.length; i++) {
      const obj = all[i];
      if (obj.name !== objectName) {
        continue;
      }
      const comp = obj.getComponent('Text') as APJS.Text;
      if (comp) {
        return comp;
      }
    }
    return null;
  }
}

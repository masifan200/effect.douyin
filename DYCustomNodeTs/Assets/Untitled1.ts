import { printB } from "Libs/SubLibs/PrintB";

@customNode()
export class CustomNodeTS extends BasicScriptNode{
 
  @input('float')
  intensity: number = 12.0;

  @input()
  objectName: string;

  @input('SceneObject')
  object: APJS.SceneObject;

  execute() {
      //user logic
      //this.scene
      printB("Hello CustomNode1");
  }
}
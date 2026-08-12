import {PrintLog} from "Print";
import {print} from './Libs/SubLibs/PrintA';
import {add} from './Libs/MyLib';

@customNode()
export class CustomNodeTS extends BasicScriptNode{


  @input('float')
  speed: number = 3.0;

  objectName: string;

  @input('SceneObject')
  object: APJS.SceneObject;

  @input('Transform')
  cubeTrans: APJS.Transform;

  @input('Transform')
  cubeTrans1: APJS.Transform;

  @input('Vector3f')
  pos: APJS.Vector3f = new APJS.Vector3f();

  rotateY: number = 0.0;

  @input('bool')
  switch: boolean;

  constructor() {
    super();
    this.pos.x = 1.0;
    this.pos.y = 5.0;
    this.pos.z = 2.0; 
  }

  execute() {
      //user logic
      //this.scene
      const rotation_amount = this.speed;
      let rotation = this.cubeTrans.localRotation;
      //const angles = rotation.toEulerAngles(rotation);
      let addive = new APJS.Vector3f();
      addive.y = this.rotateY;
      this.rotateY += rotation_amount;
      if (this.switch) {
        this.cubeTrans.localRotation = APJS.Quaternionf.makeFromEulerAngles(addive);
      } else {
        this.cubeTrans1.localRotation =  APJS.Quaternionf.makeFromEulerAngles(addive);
      }
      print('Hello CustomNode : ' + add(this.speed, 1));
      //(0, add)(1, 2);
      PrintLog('Hello World');
  }
}
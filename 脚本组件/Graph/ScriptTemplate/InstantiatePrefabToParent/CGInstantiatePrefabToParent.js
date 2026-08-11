const {BaseNode} = require('../Utils/BaseNode');
const {GraphManager} = require('../Utils/GraphManager');
const APJS = require('../../../amazingpro');

const tempPrefabInstantiateMap = new Set();
class CGInstantiatePrefabToParent extends BaseNode {
  constructor() {
    super();
  }

  beforeStart(sys) {
    this.sys = sys;
  }

  execute() {
    const prefab = this.inputs[1]();
    const parent = this.inputs[2]();
    const limit = Math.max(this.inputs[3](), 0);

    if (prefab === null || prefab === undefined) {
      console.error('Prefab asset is null');
      return;
    }

    this.prefabGuid = prefab.guid.toString();

    if (parent === null || parent === undefined) {
      console.error('Parent entity is null');
      return;
    }

    let currentCount = GraphManager.getInstance().prefabInstanceCountMap.get(this.prefabGuid);

    if (currentCount === undefined) {
      currentCount = 0;
    }

    if (limit !== undefined && currentCount >= limit) {
      console.error(`Prefab instance count exceeds the limit: ${limit}`);
      return;
    }
    if (tempPrefabInstantiateMap.has(prefab)) {
      console.error('Create Prefab recursively');
      return;
    }
    tempPrefabInstantiateMap.add(prefab);
    const instance = prefab.instantiate(parent);
    if (!instance) {
      return;
    }
    tempPrefabInstantiateMap.delete(prefab);

    // console.log('----- Prefab Instance -----');
    // this.debugPrintEntityTree(instance);

    // TODO: wait for APJS to fix SceneObject release issue and we can use below simple guid cache method
    // instance.graphSystemPrefabGuid = this.prefabGuid; // flag to indicate instantiation source, used in resetOnRecord, only set to root
    this.setInstanceToGuidMap(instance);

    this.addEntityToParent(instance, parent);

    // parent.getChildren().forEach(sceneObj => {
    //   if (sceneObj.prefab) {
    //     console.log(
    //       'addEntityToParent',
    //       sceneObj.name,
    //       sceneObj.getNative().guid.toString(),
    //       sceneObj.getNative().graphSystemPrefabGuid
    //     );
    //   }
    // });

    // console.log('----- Scene Tree -----');
    // this.debugPrintSceneTree(parent.scene);

    this.outputs[1] = instance;

    currentCount++;
    GraphManager.getInstance().prefabInstanceCountMap.set(this.prefabGuid, currentCount);

    this.outputs[2] = currentCount;

    // console.log('----- Scene Tree -----');
    // this.debugPrintSceneTree(parent.scene)

    if (this.nexts[0]) {
      this.nexts[0]();
    }
  }

  addEntityToParent(entity, parent, pushBack = true, sibling = null) {
    const transform = entity.getComponent('Transform');

    if (entity.parent) {
      entity.parent = null;
    }

    // If the parent exists, modify the transform parent-child relationship
    const parentTransform = parent.getComponent('Transform');
    const childEntities = parent.getChildren();

    //to send add transform event;
    transform.getSceneObject().parent = parentTransform.getSceneObject();
    // childTransforms.popBack();

    if (sibling && childEntities.includes(sibling)) {
      const index = childEntities.indexOf(sibling);
      pushBack
        ? APJS.SceneUtils.moveSceneObjectUnderRoot(parent, entity, index + 1)
        : APJS.SceneUtils.moveSceneObjectUnderRoot(parent, entity, Math.max(0, index - 1));
    } else {
      pushBack
        ? APJS.SceneUtils.moveSceneObjectUnderRoot(parent, entity, -1)
        : APJS.SceneUtils.moveSceneObjectUnderRoot(parent, entity, 0);
    }
  }

  resetOnRecord(sys) {
    const scene = sys.APJScene;
    const prefab = this.inputs[1]();
    if (prefab === null || prefab === undefined) {
      console.error('Prefab asset is null');
      return;
    }
    const instanceGuidSet = GraphManager.getInstance().prefabGuidToInstanceMap.get(this.prefabGuid);
    if (!instanceGuidSet) {
      return;
    }

    const entitiesToBeRemoved = new Set();

    scene.getAllSceneObjects().forEach(sceneObj => {
      // TODO: wait for APJS to fix SceneObject release issue and we can use below simple guid cache method
      // if (sceneObj.graphSystemPrefabGuid !== undefined && sceneObj.prefab && sceneObj.prefab.equals(prefab)) {
      //   entitiesToBeRemoved.add(sceneObj);
      //   console.log('entitiesToBeRemoved', sceneObj.name);
      // }
      if (sceneObj.prefab && sceneObj.prefab.equals(prefab) && instanceGuidSet.has(sceneObj.guid.toString())) {
        entitiesToBeRemoved.add(sceneObj);
      }
    });

    console.log('instancesToBeReset', entitiesToBeRemoved.size);

    entitiesToBeRemoved.forEach(entity => this.removeEntityFromScene(scene, entity));

    let currentCount = GraphManager.getInstance().prefabInstanceCountMap.get(this.prefabGuid);

    if (currentCount === undefined) {
      currentCount = 0;
    }

    if (currentCount > 0) {
      currentCount -= entitiesToBeRemoved.size;
    }
    currentCount = Math.max(currentCount, 0);

    GraphManager.getInstance().prefabInstanceCountMap.set(this.prefabGuid, currentCount);

    entitiesToBeRemoved.clear();
    tempPrefabInstantiateMap.clear();
  }

  forEachVector(vector, callback) {
    if (!vector) {
      return;
    }
    for (let i = 0; i < vector.size(); i++) {
      callback(vector.get(i), i);
    }
  }

  removeEntityFromScene(scene, entity) {
    const parentEntity = this.getParentEntity(entity);
    const transform = entity.getComponent('Transform');

    const worldPosition = transform.getWorldPosition();
    const worldOrientation = transform.getWorldRotation();
    const worldScale = transform.getWorldScale();

    if (parentEntity) {
      entity.parent = null;
    }
    // Remove the entity from the scene
    const removed = scene.removeSceneObject(entity);

    // preserve world transform
    transform.setWorldPosition(worldPosition);
    transform.setWorldRotation(worldOrientation);
    transform.setWorldScale(worldScale);
  }

  getParentEntity(entity) {
    return entity.parent ? entity.parent : undefined;
  }

  debugPrintEntityTree(entity, depth = 0) {
    if (!entity) {
      return;
    }

    const spaces = ' '.repeat(depth * 2);

    console.log(spaces + `dep${depth}: ${entity.name}`);

    entity.getComponents().forEach((component, index) => {
      console.log(spaces + `- ${entity.name} C${index}:${component.RTTI.Name}`);
      if (component.mesh) {
        console.log(spaces + `-- ${entity.name} mesh: ${component.mesh.RTTI.Name} ${component.mesh.name}`);
      }
      if (component.material) {
        console.log(spaces + `-- ${entity.name} material: ${component.material.RTTI.Name} ${component.material.name}`);
      }
      if (component.sharedMaterial) {
        console.log(
          spaces +
            `-- ${entity.name} sharedMaterial: ${component.sharedMaterial.RTTI.Name} ${component.sharedMaterial.name}`
        );
      }
      if (component.sharedMaterials) {
        console.log(
          spaces +
            `-- ${entity.name} sharedMaterials: ${
              component.sharedMaterials.RTTI.Name
            } ${component.sharedMaterials.size()}`
        );
      }
    });

    const children = entity.getChildren();
    for (let i = 0; i < children.length; i++) {
      const childTransform = children.get(i);
      const childEntity = childTransform.entity;
      this.debugPrintEntityTree(childEntity, depth + 1);
    }
  }

  setInstanceToGuidMap(instance) {
    let instanceGuidSet = GraphManager.getInstance().prefabGuidToInstanceMap.get(this.prefabGuid);
    if (!instanceGuidSet) {
      instanceGuidSet = new Set();
    }
    instanceGuidSet.add(instance.guid.toString());
    GraphManager.getInstance().prefabGuidToInstanceMap.set(this.prefabGuid, instanceGuidSet);
  }

  debugPrintSceneTree(scene) {
    if (!scene) {
      return;
    }

    const entities = scene.entities;
    const entityCount = entities.size();
    const children = [];
    for (let i = 0; i < entityCount; i++) {
      const entity = entities.get(i);
      const transform = entity.getComponent('Transform');
      if (transform && transform.parent === null) {
        children.push(entity);
      }
    }

    for (let i = 0; i < children.length; i++) {
      const entity = children[i];
      this.debugPrintEntityTree(entity);
    }
  }

  getOutput(index) {
    if (!this.sys) {
      return this.outputs[index];
    }
    if (index === 2) {
      const currentCount = GraphManager.getInstance().prefabInstanceCountMap.get(this.prefabGuid) || 0;
      this.outputs[2] = currentCount;
      return currentCount;
    }
    return this.outputs[index];
  }
}

exports.CGInstantiatePrefabToParent = CGInstantiatePrefabToParent;

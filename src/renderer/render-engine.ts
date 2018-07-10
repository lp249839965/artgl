import { GLRenderer } from "./webgl-renderer";
import { RenderList } from "./render-list";
import { LightList } from "./light-list";
import { RenderObject } from "../core/render-object";
import { Camera } from "../core/camera";

export class ARTEngineAdaptor {
  constructor(engine: ARTEngine) {
    this.engine = engine;
  }
  engine: ARTEngine;

  update() {
    
  }
}



export class ARTEngine {
  constructor(renderer: GLRenderer) {
    this.renderer = renderer;
  }

  renderer: GLRenderer;

  renderList: RenderList = new RenderList();
  lightList: LightList = new LightList();
  activeCamera: Camera;

  adaptor: ARTEngineAdaptor;

  useAdaptor(adaptor: ARTEngineAdaptor) {
    this.adaptor = adaptor;
  }

  setCamera(camera: Camera) {
    this.activeCamera = camera;
  }

  // render renderList
  render() {
    const opaqueList = this.renderList.opaqueList;
    const transparentList = this.renderList.transparentList;
    for (let i = 0; i < opaqueList.length; i++) {
      const object = opaqueList[i];
      this.renderObject(object);
    }

    for (let i = 0; i < transparentList.length; i++) {
      const object = transparentList[i];
      this.renderObject(object);
    }

  }

  renderObject(object: RenderObject) {
    const material = object.material;
    this.renderer.useProgram(material.program)
  }

}
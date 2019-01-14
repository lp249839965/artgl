import ARTGL from '../../src/export';
import { ARTEngine, Mesh, PerspectiveCamera, Interactor, OrbitController } from '../../src/artgl';
import { Scene } from '../../src/scene/scene';
import { SceneNode } from '../../src/scene/scene-node';

export class Application{
  engine: ARTEngine;
  el: HTMLCanvasElement;
  hasInitialized: boolean = false;
  scene: Scene = new Scene();
  active: boolean = true;
  interactor: Interactor;
  orbitControler: OrbitController;
  initialize(canvas: HTMLCanvasElement) {
    this.el = canvas;
    this.engine = new ARTEngine(canvas);
    this.engine.camera.transform.position.set(20, 10, 10)
    this.interactor = new Interactor(canvas);
    this.orbitControler = new OrbitController(this.engine.camera as PerspectiveCamera);
    this.orbitControler.registerInteractor(this.interactor);
    this.hasInitialized = true;
    this.createScene(this.scene);
    window.requestAnimationFrame(this.render);
    window.addEventListener('resize', this.onContainerResize);
    this.onContainerResize();
  }

  unintialize() {
    window.removeEventListener('resize', this.onContainerResize);
  }

  private onContainerResize = () => {
    const width = this.el.offsetWidth;
    const height = this.el.offsetHeight;
    this.engine.renderer.setSize(width, height);
    (this.engine.camera as PerspectiveCamera).aspect = width / height;
  }
  notifyResize() {
    this.onContainerResize();
  }

  createScene(scene: Scene): Scene {
    let testGeo = new ARTGL.SphereGeometry(1, 40, 40);
    let testMat = new ARTGL.NormalTechnique();
    for (let i = 0; i < 5; i++) {
      const node = new SceneNode();
      node.transform.position.x = i;
      scene.root.addChild(node);
      for (let j = 0; j < 5; j++) {
        const node2 = new SceneNode();
        node2.transform.position.y = j;
        node.addChild(node2);
        for (let k = 0; k < 5; k++) {
          const testMesh = new Mesh();
          testMesh.geometry = testGeo;
          testMesh.technique = testMat;
          node2.transform.position.z = k;
          testMesh.transform.scale.set(0.3, 0.3, 0.3);
          node2.addChild(testMesh);
        }
      }
    }
    return scene;
  }

  render = () => {
    if (this.active) {
      this.orbitControler.update();
      this.engine.connectCamera();
      this.engine.render(this.scene);
    }
    window.requestAnimationFrame(this.render);
  }

  run() {
    this.active = true;
  }

  stop() {
    this.active = false;
  }

}

export let GLApp: Application = new Application();
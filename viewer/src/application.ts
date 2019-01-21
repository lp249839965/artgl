import ARTGL from '../../src/export';
import { ARTEngine, Mesh, PerspectiveCamera, Interactor, OrbitController } from '../../src/artgl';
import { Scene } from '../../src/scene/scene';
import { SceneNode } from '../../src/scene/scene-node';
import { RenderGraph } from '../../src/render-graph/render-graph';
import { DimensionType, PixelFormat } from '../../src/render-graph/interface';
import { DOFTechnique } from '../../src/technique/technique-lib/dof-technique';
import { DepthTechnique } from '../../src/technique/technique-lib/depth-technique';
import { Vector4 } from '../../src/math/vector4';
export class Application{
  graph: RenderGraph;
  engine: ARTEngine;
  el: HTMLCanvasElement;
  hasInitialized: boolean = false;
  scene: Scene = new Scene();
  active: boolean = false;
  interactor: Interactor;
  orbitControler: OrbitController;
  initialize(canvas: HTMLCanvasElement) {
    this.el = canvas;
    this.engine = new ARTEngine(canvas);
    this.graph = new RenderGraph(this.engine);
    this.engine.camera.transform.position.set(20, 10, 10)
    this.interactor = new Interactor(canvas);
    this.orbitControler = new OrbitController(this.engine.camera as PerspectiveCamera);
    this.orbitControler.registerInteractor(this.interactor);
    this.hasInitialized = true;
    this.createScene(this.scene);
    window.addEventListener('resize', this.onContainerResize);
    this.onContainerResize();

    this.graph.registSource('All',this.scene)
    this.graph.registTechnique('depthTech', new DepthTechnique())
    this.graph.registTechnique('dofTech', new DOFTechnique())
    this.graph.setGraph({
      renderTextures: [
        {
          name: 'sceneResult',
          format: {
            pixelFormat: PixelFormat.rgba,
            dimensionType: DimensionType.fixed,
            width: 500,
            height: 500
          },
        },
        {
          name: 'TAAHistoryNew',
          format: {
            pixelFormat: PixelFormat.rgba,
            dimensionType: DimensionType.fixed,
            width: 500,
            height: 500
          },
        },
        {
          name: 'TAAHistoryOld',
          format: {
            pixelFormat: PixelFormat.rgba,
            dimensionType: DimensionType.fixed,
            width: 500,
            height: 500
          },
        },
      ],
      passes: [
        { // general scene origin
          name: "SceneOrigin",
          output: "sceneResult",
          source: ['All'],
        },
        {
          name: "genNewTAAHistory",
          inputs: ["sceneResult", "TAAHistory"],
          technique: 'dofTech',
          source: ['artgl.screenQuad'],
          output: 'TAAHistory',
          // onPassExecuted: () => {
            
          // }
        },
        { //
          name: "CopyToScreen",
          inputs: ["TAAHistory", "sceneHistoryBuffer"],
          output: "screen",
          technique: 'depthTech',
          enableColorClear:false,
          clearColor: new Vector4(0, 0, 0, 1),
          source: ['artgl.screenQuad'],
        },
      ]
    })
  }

  unintialize() {
    this.active = false;
    window.cancelAnimationFrame(this.tickId);
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
    let testTec = new ARTGL.NormalTechnique();
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
          testMesh.technique = testTec;
          testMesh.transform.position.z = k;
          testMesh.transform.scale.set(0.3, 0.3, 0.3);
          node2.addChild(testMesh);
        }
      }
    }
    return scene;
  }

  render = () => {
    this.orbitControler.update();
    this.engine.connectCamera();

    // this.engine.renderer.setRenderTargetScreen();
    // this.engine.render(this.scene);

    this.graph.render();
    if (this.active) {
      window.requestAnimationFrame(this.render);
    }
  }

  tickId;
  run() {
    this.active = true;
    this.interactor.enabled = true;
    this.tickId = window.requestAnimationFrame(this.render);
  }

  stop() {
    this.active = false;
    this.interactor.enabled = false;
  }

}

export let GLApp: Application = new Application();
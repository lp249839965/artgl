import { GLFramebuffer } from "../webgl/gl-framebuffer";
import { ARTEngine } from "../engine/render-engine";
import { Technique } from "../core/technique";
import { RenderGraph } from "./render-graph";
import { PassDefine, PassInputMapInfo } from "./interface";
import { RenderTargetNode } from "./node/render-target-node";
import { Vector4 } from "../math/vector4";
import { Nullable } from "../type";

export class RenderPass{
  constructor(graph: RenderGraph, define: PassDefine) {
    this.graph = graph;
    this.define = define;
    this.name = define.name;
    if (define.technique !== undefined) {
      const overrideTechnique = define.technique;
      if (overrideTechnique === undefined) {
        throw `technique '${define.technique}' not defined`
      }
      this.overrideTechnique = overrideTechnique;
    }

    this.clearColor = define.clearColor;
    this.enableColorClear = define.enableColorClear === undefined ? true : define.enableColorClear
    this.enableDepthClear = define.enableDepthClear === undefined ? true : define.enableDepthClear

    this.beforePassExecute = define.beforePassExecute;
    this.afterPassExecute = define.afterPassExecute;

  }

  updateInputTargets(inputs: PassInputMapInfo) {
    this.inputTarget.clear();
    Object.keys(inputs).forEach(inputKey => {
      const mapTo = inputs[inputKey];
      this.inputTarget.set(inputKey, mapTo)
    })
  }

  private graph: RenderGraph;
  readonly define: PassDefine;
  public name: string;

  private clearColor: Vector4;
  private enableDepthClear: boolean = true;
  private enableColorClear: boolean = true;

  private afterPassExecute?: () => any;
  private beforePassExecute?: () => any;
  
  private overrideTechnique: Nullable<Technique> = null;

  // key: uniformName ;   value: inputFramebufferName
  private inputTarget: Map<string, string> = new Map();
  private outputTarget: GLFramebuffer
  setOutPutTarget(renderTargetNode: RenderTargetNode) {
    if (renderTargetNode.name === RenderGraph.screenRoot) {
      this.outputTarget = undefined;
      this.isOutputScreen = true;
    } else {
      this.outputTarget = renderTargetNode.framebuffer;
      this.isOutputScreen = false;
    }
  }
  private isOutputScreen: boolean = true;

  renderDebugResult(engine: ARTEngine) {
    engine.renderDebugFrameBuffer(this.outputTarget)
    // this will cause no use draw TODO
    this.inputTarget.forEach((inputFramebufferName, uniformName) => {
      const framebuffer = engine.renderer.framebufferManager.getFramebuffer(inputFramebufferName);
      engine.renderDebugFrameBuffer(framebuffer)
    })
  }

  renderDebugFramebuffer(engine: ARTEngine, framebuffer: GLFramebuffer) {
    engine.renderer.setRenderTargetScreen();
  }

  static screenDebugViewPort = new Vector4(200, 0, 200, 200)
  execute() {
    const engine = this.graph.engine;

    // setup viewport and render target
    if (this.isOutputScreen) {
      engine.renderer.setRenderTargetScreen();
      if (this.graph.enableDebuggingView) {
        const debugViewPort = RenderPass.screenDebugViewPort;
        engine.renderer.state.setViewport(
          debugViewPort.x, debugViewPort.y,
          debugViewPort.z, debugViewPort.w
        );

      } else {
        engine.renderer.state.setFullScreenViewPort();
      }
    } else {
      engine.renderer.setRenderTarget(this.outputTarget);
      engine.renderer.state.setViewport(0, 0, this.outputTarget.width, this.outputTarget.height);
    }
  
    // input binding 
    if (this.overrideTechnique !== null) {
      engine.overrideTechnique = this.overrideTechnique;
      this.inputTarget.forEach((inputFramebufferName, uniformName) => {
        (engine.overrideTechnique as Technique).shading.getProgram(engine).defineFrameBufferTextureDep(
          inputFramebufferName, uniformName
        );
      })
    }

    // clear setting
    if (this.enableColorClear) {
      if (this.clearColor !== undefined) {
        engine.renderer.state.colorbuffer.setClearColor(this.clearColor);
      }
      engine.renderer.state.colorbuffer.clear();
    }
    if (this.enableDepthClear) {
      if (!this.isOutputScreen && this.outputTarget.enableDepth) {
        engine.renderer.state.depthbuffer.clear();
      }
    }

    if (this.beforePassExecute !== undefined) {
      this.beforePassExecute();
    }

    //////  render //////
    this.define.source.forEach(source => {
      engine.render(source);
    })
    /////////////////////

    if (this.afterPassExecute !== undefined) {
      this.afterPassExecute();
    }

    engine.overrideTechnique = null;
    engine.renderer.state.colorbuffer.resetDefaultClearColor();


    if (this.graph.enableDebuggingView && !this.isOutputScreen) {
      this.renderDebugResult(engine);
    }

  }

  checkIsValid() {
    if (this.isOutputScreen) {
      return
    }
    const target = this.outputTarget.name;
    this.inputTarget.forEach(input => {
      if (input === target) {
        throw `you cant output to the render target which is depend on: 
Duplicate target: ${this.outputTarget.name};`
      }
    })
  }
}
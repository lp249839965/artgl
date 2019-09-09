import { RenderGraph } from "./render-graph";
import { PassDefine } from "./interface";
import { Nullable } from "../type";
import { RenderTargetNode } from "./node/render-target-node";
import { PassGraphNode } from "./node/pass-graph-node";
import { Vector4Like } from "../math/interface";
import { Vector4 } from "../math";
import { Shading } from "../artgl";
import { RenderEngine } from "../engine/render-engine";
import { GLFramebuffer } from "../webgl/gl-framebuffer";

export type uniformName = string;
type framebufferName = string;

export class RenderPass {
  constructor(define: PassDefine) {
    this.define = define;
    this.name = define.name;
    if (define.shading !== undefined) {
      const overrideShading = define.shading;
      if (overrideShading === undefined) {
        throw `technique '${define.shading}' not defined`
      }
      this.overrideShading = overrideShading;
    }

    if (define.clearColor !== undefined) {
      this.clearColor = define.clearColor;
    }
    this.enableColorClear = define.enableColorClear === undefined ? true : define.enableColorClear
    this.enableDepthClear = define.enableDepthClear === undefined ? true : define.enableDepthClear

    this.beforePassExecute = define.beforePassExecute;
    this.afterPassExecute = define.afterPassExecute;

  }

  readonly define: PassDefine;
  public name: string;

  private clearColor: Vector4Like = new Vector4(1, 1, 1, 1);
  private beforeClearColor: Vector4Like = new Vector4(1, 1, 1, 1);
  private enableDepthClear: boolean = true;
  private enableColorClear: boolean = true;

  private afterPassExecute?: () => any;
  private beforePassExecute?: () => any;

  private overrideShading: Nullable<Shading> = null;

  uniformNameFBOMap: Map<uniformName, framebufferName> = new Map();
  uniformRenderTargetNodeMap: Map<uniformName, RenderTargetNode> = new Map();
  framebuffersDepends: Set<RenderTargetNode> = new Set();

  passNode: Nullable<PassGraphNode> = null;
  // outputInfos
  outputTarget: Nullable<RenderTargetNode> = null;

  get hasNodePrepared() {
    return this.passNode !== null && this.outputTarget !== null;
  }

  get isOutputScreen() {
    if (this.outputTarget === null) {
      return false;
    }
    return this.outputTarget.isScreenNode;
  }

  renderDebugResult(
    engine: RenderEngine,
    framebuffer: GLFramebuffer
  ) {
    if (!this.hasNodePrepared) {
      throw `pass is not prepared, passNode or TargetNode not provided`
    }
    const debugOutputViewport = this.outputTarget!.debugViewPort;
    engine.renderFrameBuffer(framebuffer, debugOutputViewport)
    // this will cause no use draw TODO optimize
    this.uniformNameFBOMap.forEach((inputFramebufferName, uniformName) => {
      const dependFramebuffer = engine.getFramebuffer(inputFramebufferName)!;
      const debugInputViewport = this.uniformRenderTargetNodeMap.get(uniformName)!.debugViewPort;
      engine.renderFrameBuffer(dependFramebuffer, debugInputViewport)
    })
  }

  execute(
    engine: RenderEngine,
    graph: RenderGraph,
    framebuffer: GLFramebuffer
  ) {

    if (!this.hasNodePrepared) {
      throw `pass is not prepared, passNode or TargetNode not provided`
    }

    this.checkIsValid();
    let outputTarget: GLFramebuffer;

    // setup viewport and render target
    if (this.isOutputScreen) {
      engine.setRenderTargetScreen();
      if (graph.enableDebuggingView) {
        const debugViewPort = graph.screenNode!.debugViewPort;
        engine.setViewport(
          debugViewPort.x, debugViewPort.y,
          debugViewPort.z, debugViewPort.w
        );

      } else {
        engine.setFullScreenViewPort();
      }
    } else {
      outputTarget = framebuffer;
      engine.setRenderTarget(outputTarget);
      engine.setViewport(0, 0, this.outputTarget!.widthAbs, this.outputTarget!.heightAbs);
    }

    // input binding 
    const overrideShading = this.overrideShading;
    if (overrideShading !== null) {
      engine.setOverrideShading(overrideShading);
      this.uniformNameFBOMap.forEach((inputFramebufferName, uniformName) => {
        overrideShading.defineFBOInput(
          inputFramebufferName, uniformName
        );
      })
    }


    engine.getClearColor(this.beforeClearColor);
    // clear setting
    if (this.enableColorClear) {
      engine.setClearColor(this.clearColor);
      engine.clearColor();
    }
    if (this.enableDepthClear) {
      if (!this.isOutputScreen && this.outputTarget!.enableDepth) {
        engine.clearDepth();
      }
    }

    if (this.beforePassExecute !== undefined) {
      this.beforePassExecute();
    }

    //////  render //////
    this.define.source.forEach(source => {
      source(engine);
    })
    /////////////////////

    if (this.afterPassExecute !== undefined) {
      this.afterPassExecute();
    }

    engine.setOverrideShading(null);
    engine.setClearColor(this.beforeClearColor);


    if (graph.enableDebuggingView && !this.isOutputScreen) {
      this.renderDebugResult(engine, framebuffer);
    }

  }

  checkIsValid() {
    if (this.isOutputScreen) {
      return
    }
    if (!this.hasNodePrepared) {
      throw `pass is not prepared, passNode or TargetNode not provided`
    }
    const target = this.outputTarget!.name;
    this.uniformNameFBOMap.forEach(input => {
      if (input === target) {
        throw `you cant output to the render target which is depend on: 
Duplicate target: ${this.outputTarget!.name};`
      }
    })
  }
}
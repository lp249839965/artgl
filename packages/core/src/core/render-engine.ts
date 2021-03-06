
import { RenderObject, RenderRange } from "./render-object";
import { Geometry } from "./render-entity/geometry";
import { BufferData } from "./render-entity/buffer-data";
import { Material } from "./render-entity/material";
import { Nullable, FloatArray, Observable } from "@artgl/shared";
import { QuadSource, RenderSource } from './render-source';
import { Shading } from "./shading";
import { Interactor } from "../../../scene-graph/src/interact/interactor";
import { Renderable, GeometryWebGLDataProvider } from "./interface";
import { Camera } from "./camera";
import { PerspectiveCamera, PerspectiveCameraInstance } from "../camera/perspective-camera";
import { Matrix4, Vector4, Vector4Like, Matrix3 } from "@artgl/math";
import { Texture } from "./render-entity/texture";
import { CubeTexture } from "./render-entity/texture-cube";
import {
  GLReleasable, GLRenderer, GLProgram, GLFramebuffer,
  GLTextureUniform, VAOCreateCallback
} from "@artgl/webgl";
import { Size, ShaderUniformProvider } from "./interface";
import { ChannelType } from "@artgl/shader-graph";
import { RenderGraphBackEnd } from "@artgl/render-graph";
import { CopyShading } from "../built-in-lib/copy";
import { NormalShading } from "../built-in-lib/normal";

const copyShading = new Shading().decorate(new CopyShading());
const quad = new QuadSource();

interface RenderEngineConstructConfig {
  el: HTMLCanvasElement;
  useUBO?: boolean;
  preferVAO?: boolean;
}

const uboKeys = new Array(100).fill("").map((_, index) => {
  return 'ubo' + index;
})

export class RenderEngine implements GLReleasable, RenderGraphBackEnd {
  constructor(config: RenderEngineConstructConfig) {
    this.renderer = new GLRenderer(config.el);
    this.interactor = new Interactor(config.el);

    this.preferVAO = config.preferVAO !== undefined ? config.preferVAO : true;
    const supportUBO = this.renderer.ctxVersion === 2;
    if (config.useUBO !== undefined) {
      if (!supportUBO && config.useUBO) {
        console.warn(`ubo support is disabled, since your ctx cant support webgl2`)
      }
    } else {
      config.useUBO = true;
    }
    this.UBOEnabled = supportUBO && config.useUBO;
  }

  readonly interactor: Interactor

  readonly renderer: GLRenderer;
  readonly UBOEnabled: boolean;

  _preferVAO: boolean = true;
  _VAOEnabled: boolean = false;
  get VAOEnabled(): boolean { return this._VAOEnabled };
  get preferVAO(): boolean { return this._preferVAO };
  set preferVAO(val: boolean) {
    this._preferVAO = val;
    if (val) {
      if (!this.renderer.vaoManager.isSupported) {
        console.warn(`prefer vao is set to true, but your environment cant support vao, VAOEnabled is false`)
      }
      this._VAOEnabled = true
    } else {
      this.renderer.vaoManager.releaseGL();
      this._VAOEnabled = false
    }
  }

  // resize
  readonly resizeObservable: Observable<Size> = new Observable<Size>();
  setSize(width: number, height: number) {
    if (this.renderer.setSize(width, height)) {
      this.resizeObservable.notifyObservers({
        width, height
      })
    }
  }
  setActualSize(width: number, height: number) {
    if (this.renderer.setRawRenderSize(width, height)) {
      this.resizeObservable.notifyObservers({
        width, height
      })
    }
  }

  hookResize(callback: () => void) {
    this.resizeObservable.add(callback);
  }
  ////


  //// render APIs
  render(source: RenderSource) {
    source.render(this);
  }

  renderObject(source: Renderable, transform?: Matrix4) {
    source.render(this, transform === undefined ? RenderObject.defaultTransform : transform);
  }

  renderFrameBuffer(framebuffer: GLFramebuffer, debugViewPort: Vector4) {
    this.renderer.setRenderTargetScreen();
    this.renderer.state.setViewport(
      debugViewPort.x, debugViewPort.y,
      debugViewPort.z, debugViewPort.w
    );

    this.overrideShading = copyShading;
    this.overrideShading.defineFBOInput(
      framebuffer.name, 'copySource'
    );
    this.render(quad);
    this.overrideShading = null;
  }
  ////


  //// low level resource binding
  private activeCamera: Camera = new PerspectiveCamera()
  renderObjectWorldMatrix = new Matrix4();
  useCamera(camera: Camera) {
    this.activeCamera = camera;
  }



  private lastUploadedShaderUniformProvider: Map<ShaderUniformProvider, number> = new Map();
  private lastProgramRendered: Nullable<GLProgram> = null;

  private currentShading: Nullable<Shading> = null;
  private currentProgram: Nullable<GLProgram> = null;

  useShading(shading: Nullable<Shading>) {

    // todo
    this.activeCamera.renderObjectWorldMatrix = this.renderObjectWorldMatrix


    if (shading === null) {
      this.currentShading = null;
      this.currentProgram = null;
      return;
    }

    // get program, refresh provider cache if changed
    const program = shading.getProgram(this);
    if (this.lastProgramRendered !== program) {
      this.lastUploadedShaderUniformProvider.clear();
    }

    this.currentProgram = program;
    this.currentShading = shading;
    this.renderer.useProgram(program);

    const shadingParams = shading.params;
    let providerCount = -1;
    shading._decorators.forEach(defaultDecorator => {

      let overrideDecorator
      // decorator override use
      if (shadingParams !== undefined) {
        overrideDecorator = shadingParams.get(defaultDecorator)
      }
      // decoCamera support
      if (overrideDecorator === undefined && defaultDecorator instanceof Camera) {
        overrideDecorator = this.activeCamera
      }
      const decorator = overrideDecorator === undefined ? defaultDecorator : overrideDecorator;

      decorator.foreachProvider(provider => {
        providerCount++;
        if (provider.uploadCache === undefined) { // some provider not provide uniform
          return;
        }
        const syncedVersion = this.lastUploadedShaderUniformProvider.get(provider)
        if (syncedVersion !== undefined
          && syncedVersion === provider.uploadCache._version // no new change
        ) {
          // if we found this uniform provider has updated before and not changed, we can skip!
          return;
        }

        if (provider.uploadCache.blockedBuffer === null) {
          const layouts = program.queryUBOLayoutIfExist(uboKeys[providerCount]);
          if (layouts === undefined) {
            provider.uploadCache.blockedBuffer = new Float32Array(0); // this mark for checked
          } else {
            provider.uploadCache.blockedBuffer = new Float32Array(layouts.all / 4);
            let i = 0;
            provider.uploadCache.uniforms.forEach((g) => { // this is inset order, is same like shader
              g.blockedBufferStartIndex = layouts.offsets[i] / 4;
              i++;
            })
          }
        }

        provider.uploadCache.uniforms.forEach((value, key) => {
          if (value instanceof Texture || value instanceof CubeTexture) {
            program.setTextureIfExist(value.uniformName, value.getGLTexture(this));
          } else {
            if (this.UBOEnabled && provider.shouldProxyedByUBO) { // when use ubo, we update ubo buffer
              if (value.isUploadCacheDirty) {
                if (typeof value.value === 'number') {
                  provider.uploadCache.blockedBuffer![value.blockedBufferStartIndex] = value.value;
                } else {
                  value.value.toArray(provider.uploadCache.blockedBuffer!, value.blockedBufferStartIndex);
                }
                value.isUploadCacheDirty = false;
              }
            } else { // else, we update each flatten uniform array and directly upload
              if (value.isUploadCacheDirty) {
                if (typeof value.value === 'number') {
                  value.uploadCache = value.value;
                } else {
                  value.uploadCache = value.value.toArray(value.uploadCache as FloatArray);
                }
                value.isUploadCacheDirty = false;
              }
              program.setUniformIfExist(value.uniformName, value.uploadCache);
            }

          }
        })

        // when use ubo, we final do ubo recreate and upload
        if (this.UBOEnabled && provider.shouldProxyedByUBO &&
          provider.uploadCache.uniforms.size !== 0 // no uniform provide by this provider
        ) {
          // provider _version has make sure we can get refreshed one
          const ubo = this.renderer.uboManager!.getUBO(provider);
          program.setUBOIfExist(uboKeys[providerCount], ubo);
        }
        this.lastUploadedShaderUniformProvider.set(provider, provider.uploadCache._version)
      })
    })

  }

  useMaterial(material?: Material) {
    if (this.currentProgram === null) {
      throw 'shading not exist'
    }
    this.currentProgram.textures.forEach((tex: GLTextureUniform) => {
      let glTexture: WebGLTexture | undefined;

      // acquire texture from material
      if (material !== undefined) {
        const texture = material.getChannelTexture(tex.name as ChannelType);
        glTexture = texture.getGLTexture(this);
      }

      // acquire texture from framebuffer
      if (glTexture === undefined) {
        const framebufferName = this.currentShading!.framebufferTextureMap[tex.name];
        if (framebufferName !== undefined) {
          glTexture = this.renderer.framebufferManager.getFramebufferTexture(framebufferName);
        }
      }

      if (glTexture === undefined) {
        return
        // throw `texture <${tex.name}>bind failed, for framebuffer texture, setup program.framebufferTextureMap`
      }

      tex.useTexture(glTexture);
    })
  }

  useGeometry(geometry: GeometryWebGLDataProvider) {

    const program = this.currentProgram;
    if (program === null) {
      throw 'shading not exist'
    }

    // vao check
    let vaoUnbindCallback: VAOCreateCallback | undefined;
    if (this._VAOEnabled) {
      vaoUnbindCallback = this.renderer.vaoManager.connectGeometry(geometry, this.currentShading!)
      if (vaoUnbindCallback === undefined) {
        return;// vao has bind, geometry buffer is ok;
      }
    }

    // common procedure
    program.attributes.forEach(att => {
      att.useBuffer(geometry.getAttributeWebGLBuffer(this, att.name));
    })

    if (program.useIndexDraw) {
      program.indexUINT = geometry.needIndexUint32();
      program.useIndexBuffer(geometry.getIndexAttributeWebGLBuffer(this));
    }

    // create vao
    if (this._VAOEnabled) {
      if (vaoUnbindCallback! !== undefined) {
        vaoUnbindCallback.unbind();
        this.renderer.vaoManager.useVAO(vaoUnbindCallback.vao)
      }
    }
  }

  useRange(geometry: Geometry, range?: RenderRange) {
    const program = this.currentProgram;
    if (program === null) {
      throw 'shading not exist'
    }
    let start = 0;
    let count = 0;
    if (range === undefined) {
      if (geometry.indexBuffer !== null) {
        count = geometry.indexBuffer.data.length;
      } else {
        throw 'range should be set if use none index geometry'
      }
    } else {
      start = range.start;
      count = range.count;
    }
    program.drawFrom = start;
    program.drawCount = count;
  }


  private overrideShading: Nullable<Shading> = null;
  public defaultShading: Shading = new Shading()
    .decorate(PerspectiveCameraInstance)
    .decorate(new NormalShading());
  setOverrideShading(shading: Nullable<Shading>): void {
    this.overrideShading = shading;
  }
  getOverrideShading(): Nullable<Shading> {
    return this.overrideShading;
  }
  getRealUseShading(object: RenderObject) {
    // // get shading, check override, default situation
    let shading: Shading;
    if (this.overrideShading !== null) {
      shading = this.overrideShading;
    } else if (object.shading !== undefined) {
      shading = object.shading;
    } else {
      shading = this.defaultShading;
    }
    return shading;
  }



  createFramebuffer(key: string, width: number, height: number, hasDepth: boolean): GLFramebuffer {
    return this.renderer.framebufferManager.createFrameBuffer(key, width, height, hasDepth);
  }
  getFramebuffer(key: string): GLFramebuffer | undefined {
    return this.renderer.framebufferManager.getFramebuffer(key);
  }
  deleteFramebuffer(fbo: GLFramebuffer): void {
    this.renderer.framebufferManager.deleteFramebuffer(fbo);
  }
  setRenderTargetScreen(): void {
    this.renderer.setRenderTargetScreen();
  }
  setRenderTarget(framebuffer: GLFramebuffer): void {
    this.renderer.setRenderTarget(framebuffer);
  }
  renderBufferWidth(): number {
    return this.renderer.width;
  }
  renderBufferHeight(): number {
    return this.renderer.height;
  }




  setViewport(x: number, y: number, width: number, height: number): void {
    this.renderer.state.setViewport(x, y, width, height);
  }
  setFullScreenViewPort(): void {
    this.renderer.state.setViewport(0, 0, this.renderBufferWidth(), this.renderBufferHeight());
  }
  setClearColor(color: Vector4Like): void {
    this.renderer.state.colorbuffer.setClearColor(color);
  }
  getClearColor(color: Vector4Like): Vector4Like {
    return color.copy(this.renderer.state.colorbuffer.currentClearColor);
  }
  resetDefaultClearColor(): void {
    this.renderer.state.colorbuffer.resetDefaultClearColor();
  }
  clearColor(): void {
    this.renderer.state.colorbuffer.clear();
  }
  clearDepth(): void {
    this.renderer.state.depthbuffer.clear();
  }



  //  GL resource acquisition
  getProgram(shading: Shading) {
    return this.renderer.programManager.getProgram(shading, this.UBOEnabled);
  }

  deleteProgram(shading: Shading) {
    this.renderer.programManager.deleteProgram(shading);
  }

  getGLAttributeBuffer(bufferData: BufferData) {
    return this.renderer.attributeBufferManager.getGLBuffer(bufferData.data.buffer as ArrayBuffer);
  }

  createOrUpdateAttributeBuffer(
    bufferData: BufferData,
    useForIndex: boolean): WebGLBuffer {
    return this.renderer.attributeBufferManager.updateOrCreateBuffer(
      bufferData.data.buffer as ArrayBuffer, useForIndex, bufferData._version);
  }





  releaseGL() {
    this.renderer.releaseGL();
  }

  dispose() {
    this.resizeObservable.clear();
    this.releaseGL();
    this.interactor.dispose();
  }


}
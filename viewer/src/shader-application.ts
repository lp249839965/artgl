import { ShaderGraph, ShaderGraphNodeInputType } from '../../src/shader-graph/shader-graph';
import { InnerSupportUniform } from '../../src/webgl/uniform/uniform';
import { ARTEngine } from '../../src/artgl';
import { GLDataType } from '../../src/webgl/shader-util';
import { ShaderFunction } from '../../src/shader-graph/shader-function';

export class ShaderApplication {

  canvas: HTMLCanvasElement;
  graph: ShaderGraph = new ShaderGraph();

  engine: ARTEngine;


  init(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.engine = new ARTEngine(canvas);

    this.graph.registShaderFunction(new ShaderFunction({
      name: 'diffuse',
      source: `
      return vec4(diffuseColor);
        `,
      inputs: [
        {
          name: "diffuseColor",
          type: GLDataType.floatVec3
        }
      ],
      returnType: GLDataType.floatVec4
    }))


    this.graph.setGraph({

      // decalare your fragment shader graph
      // fragment shader graph should have a root node
      // which output is gl_FragColor as the screen fragment output
      effect: [
        {
          name: "result",
          type: "composeAddVec4",
          input: {
            sourceA: {
              type: ShaderGraphNodeInputType.shaderFunctionNode,
              value: "diffuse"
            },
            sourceB: {
              type: ShaderGraphNodeInputType.shaderFunctionNode,
              value: "IBL"
            },
          }
        },
        {
          name: "diffuse",
          type: "diffuse",
          input: {
            diffuseColor: {
              type: ShaderGraphNodeInputType.commenUniform,
            }
          }
        },
        {
          name: "IBL",
          type: "envTex_cal",
          input: {
            envTex: {
              type: ShaderGraphNodeInputType.textureUniform,
            }
          }
        },
      ],
      effectRoot:"result",
    
      // declare your vertex shader graph
      // like frag, we export the graph root as gl_Position
      transform: [
        {
          name: "root",
          type: "VPtransfrom",
          input: {
            VPMatrix: {
              type: ShaderGraphNodeInputType.commenUniform,
              isInnerValue: true,
              value: InnerSupportUniform.VPMatrix
            },
            position: {
              type: ShaderGraphNodeInputType.attribute,
            }
          }
        },
      ],
      transformRoot:"result",
    
    
    })
  }

  uninit() {
    this.canvas = null;
    this.engine = null;
  }


}


export let ShaderApp: ShaderApplication = new ShaderApplication();
import { ShaderFunction, ShaderFunctionNode, ShaderFunctionInput } from "./shader-function";
import { GLDataType, getGLDataTypeDefaultDefaultValue } from "../webgl/shader-util";
import { AttributeUsage, AttributeDescriptor } from "../webgl/attribute";
import { InnerSupportUniform, InnerUniformMapDescriptor, UniformDescriptor } from "../webgl/uniform/uniform";
import { GLProgramConfig, VaryingDescriptor } from "../webgl/program";
import { findFirst } from "../util/array";
import { BuildInShaderFuntions } from "./built-in/index";
import { genFragmentShader } from "./code-gen";

export enum ShaderGraphNodeInputType {
  commenUniform,
  textureUniform,

  shaderFunctionNode,
  attribute,
  varying,
}


export interface ShaderGraphDefineInput {
  type: ShaderGraphNodeInputType,
  typeInfo?: any,
  isInnerValue?: boolean,
  value?: any
}

export interface ShaderGraphNodeDefine {
  name: string,
  type: string,
  input: { [index: string]: ShaderGraphDefineInput }
}


export interface ShaderGraphDefine {
  effect: ShaderGraphNodeDefine[],
  effectRoot: string,
  transform?: ShaderGraphNodeDefine[],
  transformRoot: string

}



export class ShaderGraph {

  constructor() {
    BuildInShaderFuntions.forEach(fun => {
      this.registShaderFunction(fun);
    })
  }

  define: ShaderGraphDefine;

  functionNodeFactories: Map<string, ShaderFunction> = new Map();

  functionNodes: ShaderFunctionNode[] = [];

  // map shaderNodes define name to 
  functionNodesMap: Map<string, ShaderFunctionNode> = new Map();

  setGraph(define: ShaderGraphDefine): void {
    this.reset();
    this.define = define;
    this.constructVertexGraph();
    this.constructFragmentGraph();
  }

  constructVertexGraph() {
    // this.define.transform.
  }

  constructFragmentGraph() {
    this.define.effect.forEach(nodeDefine => {
      const factory = this.functionNodeFactories.get(nodeDefine.type);
      if (!factory) {
        throw "cant find node type: " + nodeDefine.type
      }
      const node = factory.createNode(nodeDefine);
      this.functionNodes.push(node);
      this.functionNodesMap.set(nodeDefine.name, node);
    })
    this.functionNodes.forEach(node => {
      Object.keys(node.define.input).forEach((key, index) => {
        const input = node.define.input[key];
        if (input.type === ShaderGraphNodeInputType.shaderFunctionNode) {
          const fromNode = this.functionNodesMap.get(input.value);
          if (!fromNode) {
            console.warn(key);
            console.warn(node);
            throw "constructFragmentGraph failed: cant find from node"
          }
          this.checkDataTypeIsMatch(node, fromNode, index);
          fromNode.connectTo(node);
        }
      })
      
    });
  }

  private checkDataTypeIsMatch(node: ShaderFunctionNode, nodeInput:ShaderFunctionNode, inputIndex: number) {
    const result = node.factory.define.inputs[inputIndex].type === nodeInput.factory.define.returnType;
    if (!result) {
      console.warn("node:", node);
      console.warn("inputnode:", nodeInput);
      throw "constructFragmentGraph failed: type missmatch"
    }
  }

  reset() {
    this.functionNodesMap.clear();
    this.functionNodes = [];
  }

  compile(): GLProgramConfig {
    return {
      attributes: this.collectAttributeDepend(),
      uniforms: this.collectUniformDepend(),
      uniformsIncludes: this.collectInnerUniformDepend(),
      varyings: this.collectVaryDepend(),
      vertexShaderString: this.compileVertexSource(),
      fragmentShaderString: this.compileFragSource(),
      autoInjectHeader: true,
    };
  }

  private visiteAllNodesInput(visitor: (
    node: ShaderFunctionNode,
    input: ShaderGraphDefineInput,
    inputDefine: ShaderFunctionInput,
    inputKey: string) => any) {
    this.functionNodes.forEach(node => {
      Object.keys(node.define.input).forEach((key, index) => {
        const input = node.define.input[key];
        const inputDefine = node.factory.define.inputs[index];
        visitor(node, input, inputDefine, key);
      })
    })
  }

  collectVaryDepend(): VaryingDescriptor[] {
    const varyingList: VaryingDescriptor[] = [];
    this.visiteAllNodesInput((node, input, inputDefine, key) => {
      if (input.type === ShaderGraphNodeInputType.varying) {
        varyingList.push({
          name: key,
          type: inputDefine.type
        })
      }
    })
    return varyingList;
  }

  collectAttributeDepend(): AttributeDescriptor[] {
    const attributeList: AttributeDescriptor[] = [];
    this.visiteAllNodesInput((_node, input, inputDefine, key) => {
      if (input.type === ShaderGraphNodeInputType.attribute) {
        let attusage = AttributeUsage.unset;
        if (input.typeInfo && input.typeInfo.usage) {
          attusage = input.typeInfo.usage
        }
        attributeList.push({
          name: key,
          type: inputDefine.type,
          usage: attusage
        })
      }
    })
    return attributeList;
  }

  collectUniformDepend(): UniformDescriptor[] {
    const uniformList: UniformDescriptor[] = [];
    this.visiteAllNodesInput((_node, input, inputDefine, key) => {
      if (input.type === ShaderGraphNodeInputType.varying) {
        uniformList.push({
          name: key,
          type: inputDefine.type,
        })
      }
    })
    return uniformList;
  }

  collectInnerUniformDepend(): InnerUniformMapDescriptor[] {
    const innerUniformList: InnerUniformMapDescriptor[] = [];
    this.visiteAllNodesInput((_node, input, _inputDefine, key) => {
      if (input.type === ShaderGraphNodeInputType.commenUniform
      && input.isInnerValue) {
        innerUniformList.push({
          name: key,
          mapInner: input.value,
        })
      }
    })
    return innerUniformList;
  }

  compileVertexSource(): string {
    return ""
  }

  compileFragSource(): string {
    return genFragmentShader(this);
  }

  registShaderFunction(shaderFn: ShaderFunction) {
    this.functionNodeFactories.set(shaderFn.define.name, shaderFn);
  }

  getEffectRoot(): ShaderFunctionNode {
    return this.functionNodesMap.get(this.define.effectRoot);
  }
}


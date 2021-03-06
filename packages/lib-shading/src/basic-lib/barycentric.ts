import {
  shader, ShaderFunction, ShadingComponent, BaseEffectShading,
  MarkNeedRedecorate, ShaderGraph, constValue, Vector3,
  CommonAttribute, GLDataType, ShadingUniform
} from "@artgl/core";


const addBarycentricWireFrame = shader(`
vec4 addBarycentricWireFrame(
  vec4 origin, 
  vec3 barycentric_co, 
  float threshold, 
  vec3 lineColor
  ){
  if(
    barycentric_co.x > threshold &&
    barycentric_co.y > threshold &&
    barycentric_co.z > threshold
    ){
    return origin;
  }
  else{
    return vec4(lineColor, 1);
  }
} 
`)

const addBarycentricWireFrameScreenSpace = new ShaderFunction({
  source:
    `
  vec4 addBarycentricWireFrame(
    vec4 origin, 
    vec3 barycentric_co, 
    float threshold, 
    vec3 lineColor,
    ){
    vec3 d = fwidth(barycentric_co * threshold);
    vec3 a3 = smoothstep(vec3(0.0), d, barycentric_co);
    return mix(vec4(lineColor, 1.0), origin, min(min(a3.x, a3.y), a3.z));
  }
  
    `,
  needDerivative: true
})


@ShadingComponent()
export class BarycentricWireFrame extends BaseEffectShading<BarycentricWireFrame> {

  @ShadingUniform("barycentricLine_threshold")
  barycentricLine_threshold: number = 0.01;

  @ShadingUniform("screenSpaceRatio")
  screenSpaceRatio: number = 0.5;

  @MarkNeedRedecorate
  useScreenSpace: boolean = false;

  getWireFrameType(graph: ShaderGraph) {
    if (this.useScreenSpace) {
      return addBarycentricWireFrameScreenSpace.make()
        .input("origin", graph.getFragRoot())
        .input("barycentric_co", graph.getVary("v_barCentric"))
        .input("threshold", this.getPropertyUniform('screenSpaceRatio'))
        .input("lineColor", constValue(new Vector3(0, 0, 0)))
    } else {
      return addBarycentricWireFrame.make()
        .input("origin", graph.getFragRoot())
        .input("barycentric_co", graph.getVary("v_barCentric"))
        .input("threshold", this.getPropertyUniform('barycentricLine_threshold'))
        .input("lineColor", constValue(new Vector3(0, 0, 0)))
    }
  }

  decorate(graph: ShaderGraph): void {
    const barCentric = graph.getOrMakeAttribute(CommonAttribute.baryCentric, GLDataType.floatVec3);

    graph
      .setVary("v_barCentric", barCentric)
      .setFragmentRoot(this.getWireFrameType(graph))
  }

}
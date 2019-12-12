// uniform mat4 modelMatrix;
// uniform mat4 modelViewMatrix;
// uniform mat4 projectionMatrix;
// uniform mat4 viewMatrix;
// uniform mat3 normalMatrix;
// uniform vec3 cameraPosition;

// attribute vec3 position;
// attribute vec3 normal;
// attribute vec2 uv;

use crate::webgl::programs::make_webgl_program;
use fnv::FnvHasher;
use core::hash::BuildHasherDefault;
use std::collections::HashMap;
use crate::webgl::renderer::uploadMatrix4f;
use crate::webgl::renderer::WebGLRenderer;
use web_sys::WebGlProgram;
use web_sys::WebGlUniformLocation;
use crate::webgl::programs::ProgramWrap;
use std::rc::Rc;
use web_sys::WebGlRenderingContext;
use crate::scene_graph::*;
use crate::math::mat4::Mat4;

pub struct PureColorShading {
  index: usize,
  vertex: String,
  frag: String,

  // uniforms
  projection_matrix: Mat4<f32>,
  world_matrix: Mat4<f32>,
  camera_inverse_matrix: Mat4<f32>,
}

impl Shading for PureColorShading {
  fn get_index(&self)-> usize{
    self.index
  }
  fn get_vertex_str(&self) -> &str{
    &self.vertex
  }
  fn get_fragment_str(&self) -> &str{
    &self.frag
  }
  fn make_program(&self, gl: Rc<WebGlRenderingContext>) -> Rc<dyn ProgramWrap>{

    let program = make_webgl_program(&gl, &self.vertex, &self.frag).unwrap();

    let mut attributes = HashMap::with_hasher(BuildHasherDefault::<FnvHasher>::default());
    vec![String::from("position")].iter().for_each(|name| {
      attributes.insert(name.clone(), gl.get_attrib_location(&program, name));
    });

    let projection_matrix = gl.get_uniform_location(&program, "projection_matrix").unwrap();
    let world_matrix = gl.get_uniform_location(&program, "world_matrix").unwrap();
    let camera_inverse_matrix = gl.get_uniform_location(&program, "camera_inverse_matrix").unwrap();

    let p = PureColorProgram {
      program,
      projection_matrix,
      world_matrix,
      camera_inverse_matrix,
      attributes,
    };
    Rc::new(p)
  }
}

pub struct PureColorProgram {
  program: WebGlProgram,
  projection_matrix: WebGlUniformLocation,
  world_matrix: WebGlUniformLocation,
  camera_inverse_matrix: WebGlUniformLocation,
  pub attributes: HashMap<String, i32, BuildHasherDefault<FnvHasher>>,
}

impl ProgramWrap for PureColorProgram {
  fn get_program(&self) -> &WebGlProgram{
    &self.program
  }

  fn upload_uniforms(&self, renderer: &WebGLRenderer){
    uploadMatrix4f(&renderer.gl, &self.world_matrix, &renderer.model_transform);

    uploadMatrix4f(&renderer.gl, &self.camera_inverse_matrix, &renderer.camera_inverse);

    uploadMatrix4f(&renderer.gl, &self.projection_matrix, &renderer.camera_projection);
  }

  fn get_attributes(&self) -> &HashMap<String, i32, BuildHasherDefault<FnvHasher>>{
    &self.attributes
  }
}
  
  // pub struct ShadingProgram {
  //   vertex: String,
  //   frag: String,
    
  //   projection_matrix_location: WebGlUniformLocation,
  //   world_matrix: WebGlUniformLocation,
  // }
  
  // impl ShadingProgram{
  //   pub fn new(){
  
  //   }
  
  //   pub fn upload_uniforms(&self){
      
  //   }
  // }
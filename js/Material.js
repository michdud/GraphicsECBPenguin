"use strict"; 
/* exported Material */
class Material extends UniformProvider {
  constructor(gl, program) { 
    super("material");
    this.addComponentsAndGatherUniforms(program);
    return onlyWarnOnMissingPropertyAccess(this);
  }
}
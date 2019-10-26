import { ShaderUniformProvider, UniformValueProvider, UniformGroup } from "./shading";

export function MapUniform(remapName: string) {
  return (target: ShaderUniformProvider, key: string) => {
    if (target.uniforms === undefined) {
      target.uniforms = new Map();
    }
    if (target.propertyUniformNameMap === undefined) {
      target.propertyUniformNameMap = new Map();
    }

    let value = undefined!;
    const group: UniformGroup = {
      value,
      uploadCache: value,
      isUploadCacheDirty: true,
    }
    target.uniforms.set(remapName, group);
    const getter = () => {
      return group.value;
    };
    const setter = (v: UniformValueProvider | number) => {
      group.value = v;
      if (group.uploadCache === undefined) {
        if (typeof v !== 'number') {
          group.uploadCache = v.provideUniformUploadData();
        }
      }
      if (typeof v === 'number') {
        group.uploadCache = v;
        group.isUploadCacheDirty = false;
      } else {
        group.isUploadCacheDirty = true;
      }
      target._version++;
      target.blockedBufferNeedUpdate = true;
    };

    target.propertyUniformNameMap.set(key, remapName);

    Object.defineProperty(target, key, {
      get: getter,
      set: setter,
      enumerable: true,
      configurable: true,
    });
  };
}

export function checkCreate(testValue: any, inputValue: any) {
  if (testValue === undefined) {
    return inputValue
  } else {
    return testValue
  }
}
import { Texture, DataTexture } from "./texture";
import { generateUUID } from "../math/uuid";
import { Vector3 } from "../math/index";

export const enum ChannelType{
  diffuse = 'diffuse',
  roughness = 'roughness',
  metallic = 'metallic',
  ao = 'ao'
}


/**
 * Material is collection of textures
 * contains bitmap render data
 * @export
 * @class Material
 */
export class Material{

  uuid = generateUUID();
  private channels: Map<ChannelType, Texture> = new Map();

  setChannelColor(channel: ChannelType, color: Vector3) {
    let channelTexture = this.channels.get(channel);
    if (channelTexture === undefined) {
      channelTexture = generateTextureToPureColor(color);
    } else {
      updateTextureToPureColor(channelTexture, color);
    }
  }

  setChannelTexture(channel: ChannelType, texture: Texture) {
    this.channels.set(channel, texture);
  }

  getChannelTexture(type: ChannelType): Texture {
    const texture = this.channels.get(type);
    if (texture === undefined) {
      throw 'cant get channel texture'
    }
    return texture;
  }

}

function generateTextureToPureColor(color: Vector3): Texture {
  const texture = new DataTexture(); 
  const R = Math.floor(color.x * 256);
  const G = Math.floor(color.y * 256);
  const B = Math.floor(color.z * 256);
  texture.data = new Uint8ClampedArray([
    R, G, B, R, G, B, R, G, B, R, G, B, 
  ]);
  return texture;
}

function updateTextureToPureColor(texture: Texture, color: Vector3): Texture {
  return texture;
}
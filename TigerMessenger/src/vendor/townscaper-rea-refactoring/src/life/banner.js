import * as THREE from 'three';
import {bakeBanner} from '../core/banner.js';
/** 958410200146497537: owned, reusable alpha-cut banner art. Canvas-free
 * procedural data keeps alpha/colour identical in gallery and actual Battle.
 */
export function createBannerTexture({color='#60ada0',...options}={}) {
  const hex=new THREE.Color(color).getHex(THREE.SRGBColorSpace),baked=bakeBanner({...options,color:[hex>>>16&255,hex>>>8&255,hex&255]});
  const texture=new THREE.DataTexture(baked.rgba,baked.width,baked.height,THREE.RGBAFormat);
  texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
  texture.userData.banner=baked;return texture;
}

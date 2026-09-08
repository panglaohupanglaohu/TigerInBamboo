import * as THREE from 'three';
import data from '../../assets/models/optimized/bookshopArtGeometryData.js';
import { toonMat } from './toon.js';

function makeGeometry(attributes) {
  const geometry = new THREE.BufferGeometry();
  for (const [name, values] of Object.entries(attributes)) {
    geometry.setAttribute(name, new THREE.Float32BufferAttribute(values, name === 'uv' ? 2 : 3));
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

// Keep the factory's live object identities: editor, quests and collision retain
// their references. Only the evaluated Blender building replaces the old shape.
export function applyBookshopArt(root) {
  if (root.userData.blenderArt) return true;
  const nodes = [];
  root.traverse(node => nodes.push(node));
  if (nodes.length !== data.nodes.length || nodes.some((node, i) =>
    node.name !== data.nodes[i].name || node.type !== data.nodes[i].type)) return false;

  const old = new Set();
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i], record = data.nodes[i];
    if (record.matrix) {
      node.matrix.fromArray(record.matrix);
      node.matrix.decompose(node.position, node.quaternion, node.scale);
    }
    node.userData.blenderSourceNode = record.id;
    if (!record.geometry) continue;
    old.add(node.geometry);
    node.geometry = makeGeometry(record.geometry);
    // Runtime ink uses the NEW surface, not the archived coincident outline mesh.
    for (const outline of node.children.filter(child => child.userData.isOutline)) {
      old.add(outline.geometry);
      outline.geometry = node.geometry;
    }
  }
  const retained = new Set(nodes.map(node => node.geometry));
  for (const geometry of old) if (geometry && !retained.has(geometry)) geometry.dispose();
  const frames = new THREE.Mesh(makeGeometry(data.joinery.geometry), toonMat(new THREE.Color().fromArray(data.joinery.color)));
  frames.name = 'bookshop-blender-window-joinery';
  frames.castShadow = true;
  frames.receiveShadow = true;
  frames.userData.blenderMembers = data.joinery.members;
  root.add(frames);
  root.userData.blenderArt = { version: data.version, source: data.source, sha256: data.sha256, joineryMembers: data.joinery.members };
  root.updateMatrixWorld(true);
  return true;
}

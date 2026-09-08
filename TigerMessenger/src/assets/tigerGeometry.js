import data from '../../assets/models/optimized/moebiusTigerGeometryData.js';
import { applyBlenderTopology } from './blenderTopology.js';
export function applyOptimizedTigerGeometry(root) { return applyBlenderTopology(root, data); }

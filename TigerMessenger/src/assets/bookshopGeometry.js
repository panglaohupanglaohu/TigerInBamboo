import data from '../../assets/models/optimized/bookshopGeometryData.js';
import { applyBlenderTopology } from './blenderTopology.js';
export function applyOptimizedBookshopGeometry(root) { return applyBlenderTopology(root, data); }

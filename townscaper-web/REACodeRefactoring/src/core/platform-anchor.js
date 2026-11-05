/** Matrices must use the same parent coordinate system (not mixed world/local).
 * Capture at impact time, before the platform advances. Inputs are never mutated.
 * Matrix4 is supplied by the caller so core does not depend on a renderer.
 */
export function capturePlatformAnchor(platformMatrix, markMatrix) {
  if (!Number.isFinite(platformMatrix.determinant()) || Math.abs(platformMatrix.determinant()) < 1e-12)
    throw new RangeError('Platform transform must be invertible');
  return platformMatrix.clone().invert().multiply(markMatrix);
}

export function resolvePlatformAnchor(platformMatrix, anchor) {
  return platformMatrix.clone().multiply(anchor);
}

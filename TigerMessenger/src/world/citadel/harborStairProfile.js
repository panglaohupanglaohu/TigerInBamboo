// One height profile for initial assembly AND final spherical ocean alignment.
export function harborStairHeight(dockY,z){
  const middle=(4+dockY)/2;
  return z>=69?middle+(4-middle)*(z-69)/9:z>=67?middle:dockY+(middle-dockY)*(z-58)/9;
}

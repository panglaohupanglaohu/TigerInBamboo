const mode=process.argv[2];globalThis.location={search:mode};
const L=await import(process.cwd()+'/src/world/bookshopLoadingYards.js');
const pts=[...L.factoryFreightEntry(160),...L.factoryFreightStops(160).flatMap(s=>s.points),...L.factoryFreightExit(160),L.freightTrainingDepot(160).center];
console.log(JSON.stringify(pts.map(p=>p.toArray().map(v=>+v.toFixed(5)))));

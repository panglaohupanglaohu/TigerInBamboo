globalThis.location={search:'?bookshopRaise=1'};
const S=await import(process.cwd()+'/src/world/bookshopTownSite.js');
for(const [x,z] of [[0,32],[30,65.7],[60,63.5],[95.5,60.1],[98,20.8],[100.5,44.7],[94.8,45.6],[86,-14],[40,58],[45,72]])console.log(x,z,'ground',S.bookshopRaiseFlat(x,z).toFixed(2),'rail',S.bookshopRailRaiseFlat(x,z).toFixed(2));

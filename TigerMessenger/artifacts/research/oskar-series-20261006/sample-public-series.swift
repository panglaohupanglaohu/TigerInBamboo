import Foundation
import AVFoundation
import AppKit
struct Medium: Decodable { let type:String; let url:String }
struct Source: Decodable {let id:String; let topic:String; let media:[Medium]}
let dir=URL(fileURLWithPath:CommandLine.arguments[1])
let sources=try JSONDecoder().decode([Source].self,from:Data(contentsOf:dir.appendingPathComponent("sources.json")))
func sample(_ source:Source) async {
 let folder=dir.appendingPathComponent(source.id)
 do {
 try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true)
 guard let medium=source.media.first,let url=URL(string:medium.url) else{return}
 if medium.type == "photo" {
  let(data,_)=try await URLSession.shared.data(from:url)
  try data.write(to:folder.appendingPathComponent("photo.png"))
  try JSONSerialization.data(withJSONObject:["id":source.id,"status":"photo-read","source":medium.url]).write(to:folder.appendingPathComponent("samples.json"))
  print("\(source.id) photo")
  return
 }
 let asset=AVURLAsset(url:url),duration=try await asset.load(.duration).seconds
 let gen=AVAssetImageGenerator(asset:asset);gen.appliesPreferredTrackTransform=true
 gen.requestedTimeToleranceBefore = .zero;gen.requestedTimeToleranceAfter = .zero
 let count=12
 var frames:[[String:Any]]=[]
 for i in 0..<count {
  let t=min(duration-0.04,Double(i)*duration/Double(count-1))
  let result=try await gen.image(at:CMTime(seconds:max(0,t),preferredTimescale:600))
  let bitmap=NSBitmapImageRep(cgImage:result.image)
  let filename=String(format:"frame-%02d.png",i)
  try bitmap.representation(using:.png,properties:[:])!.write(to:folder.appendingPathComponent(filename))
  frames.append(["file":filename,"requestedSeconds":t,"actualSeconds":result.actualTime.seconds])
 }
 try JSONSerialization.data(withJSONObject:["id":source.id,"status":"sampled-not-continuous","durationSeconds":duration,"source":medium.url,"method":"AVFoundation public stream; source video not saved","frames":frames],options:[.prettyPrinted,.sortedKeys]).write(to:folder.appendingPathComponent("samples.json"))
 print("\(source.id) \(duration)s \(frames.count) samples")
 } catch {print("ERROR \(source.id): \(error)")}
}
let done=DispatchGroup();done.enter()
Task {
 for start in stride(from:0,to:sources.count,by:3) {
  await withTaskGroup(of:Void.self){tasks in
   for index in start..<min(start+3,sources.count){let source=sources[index];tasks.addTask{await sample(source)}}
  }
 }
 done.leave()
}
done.wait()

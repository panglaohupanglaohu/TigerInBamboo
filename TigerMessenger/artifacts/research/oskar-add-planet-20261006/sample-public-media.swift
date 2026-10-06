import Foundation
import AVFoundation
import AppKit
let source=URL(string:"https://video.twimg.com/tweet_video/GOwRvTBWYAAWsQ-.mp4")!
let out=URL(fileURLWithPath:CommandLine.arguments[1])
let asset=AVURLAsset(url:source)
let group=DispatchGroup(); group.enter()
Task {
 do {
  let duration=try await asset.load(.duration).seconds
  let generator=AVAssetImageGenerator(asset:asset)
  generator.appliesPreferredTrackTransform=true
  generator.requestedTimeToleranceBefore = .zero
  generator.requestedTimeToleranceAfter = .zero
  print("duration=\(duration)")
  for i in 0..<16 {
   let t=max(0,min(duration-0.1,Double(i)*duration/16))
   let result=try await generator.image(at:CMTime(seconds:t,preferredTimescale:600))
   let image=NSBitmapImageRep(cgImage:result.image)
   let data=image.representation(using:.png,properties:[:])!
   try data.write(to:out.appendingPathComponent(String(format:"frame-%02d.png",i)))
   print("frame=\(i) requested=\(t) actual=\(result.actualTime.seconds)")
  }
 } catch { print("ERROR \(error)") }
 group.leave()
}
group.wait()

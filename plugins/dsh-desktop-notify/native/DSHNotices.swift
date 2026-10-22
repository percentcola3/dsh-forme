import AppKit
import SwiftUI
import QuartzCore
import SceneKit

struct Preferences: Decodable {
    var enabled = true
    var position = "right"
    var display = "main"
    var duration = 4.0
    var sound = false
    var completion = true
    var decisions = true
}
struct Notice: Decodable, Identifiable {
    let id: String
    let sessionId: String
    let kind: String
    let title: String
    let body: String
}
struct Command: Decodable {
    let action: String
    var notice: Notice?
    var preferences: Preferences?
    var id: String?
}
final class NoticePanel: NSPanel {
    override var canBecomeKey: Bool { false }
    override var canBecomeMain: Bool { false }
}
/// Local surface maps and a normal field derived from alert elevation data. No network requests,
/// timer-driven texture allocations or bitmap scaling on each animation frame.
enum PlanetAssets {
    static func image(_ name: String) -> NSImage? {
        guard let url = Bundle.main.url(forResource: name, withExtension: "jpg", subdirectory: "textures") else { return nil }
        return NSImage(contentsOf: url)
    }
    static func bitmap(_ pixels: [UInt8], width: Int, height: Int) -> NSImage {
        let data = Data(pixels) as CFData
        let provider = CGDataProvider(data: data)!
        let cg = CGImage(width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue), provider: provider, decode: nil, shouldInterpolate: true, intent: .defaultIntent)!
        return NSImage(cgImage: cg, size: NSSize(width: width, height: height))
    }
    /// Procedural Jupiter: seamless turbulent bands and a great red spot, generated once.
    static let jupiter = jupiterTexture()
    static func jupiterTexture() -> NSImage? {
        let w = 512, h = 256
        var pixels = [UInt8](repeating: 0, count: w * h * 4)
        func fract(_ v: Double) -> Double { v - v.rounded(.down) }
        func hash(_ x: Int, _ y: Int) -> Double { fract(sin(Double(x) * 127.1 + Double(y) * 311.7) * 43758.5453) }
        func noise(_ x: Double, _ y: Double) -> Double {
            let xi = Int(x.rounded(.down)), yi = Int(y.rounded(.down))
            let xf = x - Double(xi), yf = y - Double(yi)
            let sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf)
            let top = hash(xi, yi) * (1 - sx) + hash(xi + 1, yi) * sx
            let bottom = hash(xi, yi + 1) * (1 - sx) + hash(xi + 1, yi + 1) * sx
            return top * (1 - sy) + bottom * sy
        }
        func mix(_ a: Double, _ b: Double, _ t: Double) -> Double { a + (b - a) * t }
        func smooth(_ a: Double, _ b: Double, _ v: Double) -> Double {
            let t = max(0, min(1, (v - a) / (b - a)))
            return t * t * (3 - 2 * t)
        }
        for y in 0..<h {
            let lat = (0.5 - Double(y) / Double(h)) * Double.pi
            for x in 0..<w {
                let lon = Double(x) / Double(w) * 2 * Double.pi
                // Seam-free sampling: longitude enters through continuous cos/sin.
                let n1 = noise(cos(lon) * 2.5 + 7.3, lat * 3.5 + 1.2)
                let n2 = noise(sin(lon) * 2.5 + 3.1, lat * 4.5 + 9.8)
                let warp = (n1 + n2) * 0.5
                let stripes = 0.5 + 0.5 * sin(lat * 9 + warp * 3.1)
                let v = stripes * 0.72 + warp * 0.3
                let t = smooth(0.22, 0.78, v)
                var r = mix(0.55, 0.9, t), g = mix(0.4, 0.82, t), b = mix(0.3, 0.7, t)
                let spot = fmod(lon + 1.6 + Double.pi, 2 * Double.pi) - Double.pi
                let ds = sqrt(spot * spot + pow((lat + 0.32) * 2.2, 2))
                let spotT = smooth(0.17, 0.05, ds)
                r = mix(r, 0.78, spotT); g = mix(g, 0.34, spotT); b = mix(b, 0.24, spotT)
                let storm = fmod(lon - 2.4 + Double.pi, 2 * Double.pi) - Double.pi
                let dt = sqrt(storm * storm + pow((lat - 0.18) * 2.0, 2))
                let stormT = smooth(0.12, 0.04, dt) * 0.5
                r = mix(r, 0.95, stormT); g = mix(g, 0.9, stormT); b = mix(b, 0.8, stormT)
                let out = (y * w + x) * 4
                pixels[out] = UInt8(max(0, min(255, r * 255)))
                pixels[out + 1] = UInt8(max(0, min(255, g * 255)))
                pixels[out + 2] = UInt8(max(0, min(255, b * 255)))
                pixels[out + 3] = 255
            }
        }
        return bitmap(pixels, width: w, height: h)
    }
}
final class PassivePlanetView: SCNView {
    override var isOpaque: Bool { false }
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
}
final class PlanetRenderer {
    let scene = SCNScene()
    let surface = SCNNode()
    private var moving: Bool?
    private let alert: Bool
    init(alert: Bool) {
        self.alert = alert
        scene.background.contents = NSColor.clear
        let camera = SCNNode()
        camera.camera = SCNCamera()
        camera.camera!.usesOrthographicProjection = true
        camera.camera!.orthographicScale = 1.45
        camera.position = SCNVector3(0, 0, 4)
        scene.rootNode.addChildNode(camera)
        let ambient = SCNNode()
        ambient.light = SCNLight(); ambient.light!.type = .ambient
        ambient.light!.color = alert ? NSColor(white: 0.20, alpha: 1) : NSColor(red: 0.72, green: 0.84, blue: 0.94, alpha: 1)
        ambient.light!.intensity = alert ? 230 : 460
        scene.rootNode.addChildNode(ambient)
        let key = SCNNode()
        key.light = SCNLight(); key.light!.type = .directional
        key.light!.color = alert ? NSColor(red: 1, green: 0.16, blue: 0.20, alpha: 1) : NSColor(red: 0.90, green: 0.97, blue: 1, alpha: 1)
        key.light!.intensity = alert ? 1000 : 840
        key.eulerAngles = SCNVector3(-0.35, alert ? 0.95 : -0.5, 0)
        scene.rootNode.addChildNode(key)
        let tilt = SCNNode()
        tilt.eulerAngles.z = alert ? -0.14 : 0.18
        scene.rootNode.addChildNode(tilt)
        let sphere = SCNSphere(radius: 1)
        sphere.segmentCount = 96
        let material = SCNMaterial()
        material.lightingModel = .lambert
        material.isDoubleSided = false
        material.diffuse.contents = PlanetAssets.jupiter ?? NSColor(red: 0.72, green: 0.6, blue: 0.46, alpha: 1)
        material.diffuse.wrapS = .repeat
        material.diffuse.minificationFilter = .linear
        material.diffuse.magnificationFilter = .linear
        if alert {
            // Decisions and errors redden the whole disc; spin also speeds up.
            material.shaderModifiers = [.surface: """
            #pragma body
            _surface.diffuse.rgb = mix(_surface.diffuse.rgb, _surface.diffuse.rgb * vec3(1.5, 0.42, 0.38) + vec3(0.10, 0.0, 0.0), 0.78);
            """]
            material.emission.contents = NSColor(red: 0.05, green: 0.006, blue: 0.008, alpha: 1)
        } else {
            material.shaderModifiers = [.surface: """
            #pragma body
            _surface.diffuse.rgb *= vec3(1.02, 0.99, 0.92);
            """]
        }
        sphere.firstMaterial = material
        surface.geometry = sphere
        surface.eulerAngles.y = alert ? -0.35 : 0.85
        tilt.addChildNode(surface)
        // Thin Fresnel scattering follows the sphere's actual curved silhouette.
        let atmosphere = SCNSphere(radius: alert ? 1.012 : 1.035)
        atmosphere.segmentCount = 96
        let haze = SCNMaterial()
        haze.lightingModel = .constant
        haze.blendMode = .alpha
        haze.writesToDepthBuffer = false
        haze.shaderModifiers = [.fragment: """
        #pragma transparent
        #pragma body
        float rim = pow(1.0 - clamp(abs(dot(normalize(_surface.normal), normalize(_surface.view))), 0.0, 1.0), 3.0);
        float opacity = rim * \(alert ? "0.22" : "0.34");
        _output.color = vec4(vec3(\(alert ? "0.84, 0.035, 0.065" : "0.48, 0.78, 1.0")) * opacity, opacity);
        """]
        atmosphere.firstMaterial = haze
        let atmosphereNode = SCNNode(geometry: atmosphere)
        atmosphereNode.renderingOrder = 20
        tilt.addChildNode(atmosphereNode)
    }
    func setMotion(_ enabled: Bool) {
        guard moving != enabled else { return }
        moving = enabled
        surface.removeAllActions()
        guard enabled else { return }
        surface.runAction(.repeatForever(.rotateBy(x: 0, y: .pi * 2, z: 0, duration: alert ? 5 : 13)))
    }
}
struct PlanetScene: NSViewRepresentable {
    let alert: Bool
    let reduceMotion: Bool
    func makeCoordinator() -> PlanetRenderer { PlanetRenderer(alert: alert) }
    func makeNSView(context: Context) -> PassivePlanetView {
        let view = PassivePlanetView(frame: .zero, options: [SCNView.Option.preferredRenderingAPI.rawValue: SCNRenderingAPI.metal.rawValue])
        view.backgroundColor = .clear
        view.scene = context.coordinator.scene
        view.antialiasingMode = .multisampling4X
        view.preferredFramesPerSecond = 30
        view.autoenablesDefaultLighting = false
        return view
    }
    func updateNSView(_ view: PassivePlanetView, context: Context) {
        context.coordinator.setMotion(!reduceMotion)
        view.rendersContinuously = !reduceMotion
        view.isPlaying = !reduceMotion
        view.needsDisplay = true
    }
    static func dismantleNSView(_ view: PassivePlanetView, coordinator: PlanetRenderer) {
        coordinator.setMotion(false)
        view.isPlaying = false; view.rendersContinuously = false; view.scene = nil
    }
}
/// Saturn-style ring disc centered on the planet. Radii are in planet radii
/// (R = badge height / 2.9, matching the orthographic camera scale 1.45).
/// `front` keeps only the near half, which passes in front of the sphere.
struct RingDisc: Shape {
    var inner: CGFloat
    var outer: CGFloat
    var front: Bool
    static let flatten: CGFloat = 0.30   // ry / rx: viewing angle onto the ring plane
    static let tilt: CGFloat = -0.30     // radians, ring plane slants up to the right
    func path(in rect: CGRect) -> Path {
        let R = rect.height / 2.9
        let k = RingDisc.flatten
        var path = Path()
        if front {
            let steps = 48
            for i in 0...steps {
                let t = CGFloat.pi * CGFloat(i) / CGFloat(steps)
                let pt = CGPoint(x: outer * R * cos(t), y: outer * R * k * sin(t))
                if i == 0 { path.move(to: pt) } else { path.addLine(to: pt) }
            }
            for i in 0...steps {
                let t = CGFloat.pi - CGFloat.pi * CGFloat(i) / CGFloat(steps)
                path.addLine(to: CGPoint(x: inner * R * cos(t), y: inner * R * k * sin(t)))
            }
            path.closeSubpath()
        } else {
            path.addEllipse(in: CGRect(x: -outer * R, y: -outer * R * k, width: 2 * outer * R, height: 2 * outer * R * k))
            path.addEllipse(in: CGRect(x: -inner * R, y: -inner * R * k, width: 2 * inner * R, height: 2 * inner * R * k))
        }
        let transform = CGAffineTransform(translationX: rect.midX, y: rect.midY).rotated(by: RingDisc.tilt)
        return path.applying(transform)
    }
}
/// Three bands: faint inner C ring, bright B ring, Cassini gap, softer A ring.
struct RingLayer: View {
    let front: Bool
    let color: Color
    var body: some View {
        let dim: Double = front ? 1 : 0.62
        ZStack {
            RingDisc(inner: 1.32, outer: 1.52, front: front).fill(color.opacity(0.30 * dim), style: FillStyle(eoFill: true))
            RingDisc(inner: 1.52, outer: 1.86, front: front).fill(color.opacity(0.92 * dim), style: FillStyle(eoFill: true))
            RingDisc(inner: 1.93, outer: 2.18, front: front).fill(color.opacity(0.66 * dim), style: FillStyle(eoFill: true))
        }
    }
}
struct PanelBadge: View {
    let alert: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var breathing = false
    var tint: Color { alert ? Color(red: 0.9, green: 0.15, blue: 0.21) : Color(red: 0.55, green: 0.81, blue: 1) }
    var ringColor: Color { alert ? Color(red: 1.0, green: 0.68, blue: 0.64) : Color(red: 0.97, green: 0.96, blue: 0.93) }
    var body: some View {
        ZStack {
            Circle().fill(RadialGradient(colors: [tint.opacity(alert ? 0.19 : 0.13), tint.opacity(0)], center: .center, startRadius: 12, endRadius: 24))
                .frame(width: 48, height: 48)
                .opacity(reduceMotion || !alert ? 1 : (breathing ? 0.68 : 1))
                .animation(reduceMotion || !alert ? nil : .easeInOut(duration: 1.8).repeatForever(autoreverses: true), value: breathing)
            RingLayer(front: false, color: ringColor)
            PlanetScene(alert: alert, reduceMotion: reduceMotion).frame(width: 48, height: 48).allowsHitTesting(false)
            RingLayer(front: true, color: ringColor)
        }
        .frame(width: 80, height: 48)
        .onAppear { breathing = true }
        .accessibilityHidden(true)
    }
}
struct PlanetSignal: View {
    let alert: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var breathing = false
    var tint: Color { alert ? Color(red: 0.9, green: 0.15, blue: 0.21) : Color(red: 0.55, green: 0.81, blue: 1) }
    var body: some View {
        ZStack {
            Circle().fill(RadialGradient(colors: [tint.opacity(alert ? 0.19 : 0.13), tint.opacity(0)], center: .center, startRadius: 12, endRadius: 24))
                .opacity(reduceMotion || !alert ? 1 : (breathing ? 0.68 : 1))
                .animation(reduceMotion || !alert ? nil : .easeInOut(duration: 1.8).repeatForever(autoreverses: true), value: breathing)
            PlanetScene(alert: alert, reduceMotion: reduceMotion).allowsHitTesting(false)
        }
        .frame(width: 48, height: 48)
        .onAppear { breathing = true }
        .accessibilityHidden(true)
    }
}
struct NoticeCard: View {
    let notice: Notice
    let open: () -> Void
    var label: String { notice.kind == "complete" ? "任务完成" : (notice.kind == "error" ? "执行异常" : "需要选择") }
    var body: some View {
        Button(action: open) {
            PanelBadge(alert: notice.kind != "complete").contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(label)，\(notice.title)")
        .accessibilityHint(notice.sessionId.isEmpty ? "关闭测试提醒" : "打开任务")
        .help("\(label) · \(notice.title)")
    }
}
final class Controller: NSObject, NSApplicationDelegate {
    var panel: NoticePanel!
    var preferences = Preferences()
    var queue: [Notice] = []
    var timer: Timer?
    var expiresAt: Date?
    var displayedID: String?
    var presentation = 0
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        panel = NoticePanel(contentRect: .zero, styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        panel.isReleasedWhenClosed = false
        panel.backgroundColor = .clear
        panel.isOpaque = false
        panel.hasShadow = false
        panel.hidesOnDeactivate = false
        panel.isFloatingPanel = true
        panel.title = "DSH 桌面提醒"
        panel.level = .statusBar
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary, .ignoresCycle]
        panel.setAccessibilityLabel("DSH 桌面提醒")
        NotificationCenter.default.addObserver(self, selector: #selector(reposition), name: NSApplication.didChangeScreenParametersNotification, object: nil)
        emit(["type": "ready"])
        DispatchQueue.global(qos: .utility).async {
            while let line = readLine() {
                guard line.utf8.count <= 32768, let data = line.data(using: .utf8), let command = try? JSONDecoder().decode(Command.self, from: data) else { continue }
                DispatchQueue.main.async { self.receive(command) }
            }
            DispatchQueue.main.async { NSApp.terminate(nil) }
        }
    }
    func emit(_ value: [String: String]) {
        if let data = try? JSONSerialization.data(withJSONObject: value), let text = String(data: data, encoding: .utf8) {
            print(text); fflush(stdout)
        }
    }
    func receive(_ command: Command) {
        if let next = command.preferences { preferences = next }
        if !preferences.enabled { queue.removeAll(); render(); return }
        queue.removeAll { $0.kind == "complete" ? !preferences.completion : !preferences.decisions }
        switch command.action {
        case "show":
            guard let notice = command.notice else { return }
            queue.removeAll { $0.id == notice.id }
            if queue.count >= 20 { queue.removeLast() }
            if notice.kind == "decision" { queue.insert(notice, at: 0) } else { queue.append(notice) }
            if preferences.sound {
                let names = notice.kind == "complete" ? ["Glass", "Tink"] : ["Morse", "Ping"]
                let sound = names.lazy.compactMap { NSSound(contentsOfFile: "/System/Library/Sounds/\($0).aiff", byReference: true) }.first ?? NSSound(named: names[0])
                if let sound {
                    sound.volume = 0.5
                    let played = sound.play()
                    fputs("sound:\(notice.kind) \(names[0]) played=\(played)\n", stderr)
                } else {
                    fputs("sound:unavailable\n", stderr)
                }
            }
            render()
        case "dismiss":
            guard queue.contains(where: { $0.id == command.id }) else { return }
            queue.removeAll { $0.id == command.id }; render()
        case "configure": render()
        default: break
        }
    }
    var screen: NSScreen? {
        if preferences.display == "pointer", let pointed = NSScreen.screens.first(where: { NSMouseInRect(NSEvent.mouseLocation, $0.frame, false) }) { return pointed }
        return NSScreen.screens.first
    }
    @objc func reposition() {
        guard let screen = screen else { return }
        let width: CGFloat = min(80, screen.visibleFrame.width - 32)
        let height: CGFloat = 48
        let visible = screen.visibleFrame
        let m: CGFloat = 22
        var x = visible.maxX - width - m
        var y = visible.maxY - height - m
        switch preferences.position {
        case "top-left": x = visible.minX + m; y = visible.maxY - height - m
        case "top", "island":
            x = visible.midX - width / 2
            y = screen.frame.maxY - max(screen.safeAreaInsets.top, screen.frame.maxY - visible.maxY) - height - 6
        case "top-right": x = visible.maxX - width - m; y = visible.maxY - height - m
        case "right": x = visible.maxX - width - m; y = visible.midY - height / 2
        case "bottom-right": x = visible.maxX - width - m; y = visible.minY + m
        case "bottom": x = visible.midX - width / 2; y = visible.minY + m
        case "bottom-left": x = visible.minX + m; y = visible.minY + m
        case "left": x = visible.minX + m; y = visible.midY - height / 2
        default: break
        }
        panel.setFrame(NSRect(x: x, y: y, width: width, height: height), display: true)
    }
    func transitionOffset(_ frame: NSRect) -> NSRect {
        switch preferences.position {
        case "left", "top-left", "bottom-left": return frame.offsetBy(dx: -12, dy: 0)
        case "right", "top-right", "bottom-right": return frame.offsetBy(dx: 12, dy: 0)
        case "top", "island": return frame.offsetBy(dx: 0, dy: 8)
        default: return frame.offsetBy(dx: 0, dy: -8)
        }
    }
    func render() {
        timer?.invalidate(); timer = nil
        presentation += 1
        let revision = presentation
        let reduced = NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
        guard let notice = queue.first else {
            displayedID = nil
            expiresAt = nil
            guard panel.isVisible, !reduced else { panel.orderOut(nil); panel.contentView = nil; return }
            let destination = transitionOffset(panel.frame)
            NSAnimationContext.runAnimationGroup({ context in
                context.duration = 0.18
                context.timingFunction = CAMediaTimingFunction(name: .easeIn)
                panel.animator().alphaValue = 0
                panel.animator().setFrame(destination, display: true)
            }, completionHandler: {
                // A new notice may arrive while the previous capsule is leaving.
                guard self.presentation == revision, self.queue.isEmpty else { return }
                self.panel.orderOut(nil)
                self.panel.contentView = nil
            })
            return
        }
        let appearing = !panel.isVisible || displayedID != notice.id
        if appearing { expiresAt = Date().addingTimeInterval(max(3, min(30, preferences.duration))) }
        displayedID = notice.id
        panel.contentView = NSHostingView(rootView: NoticeCard(notice: notice, open: { self.open(notice) }).id(notice.id))
        reposition()
        let destination = panel.frame
        if appearing && !reduced {
            panel.alphaValue = 0
            panel.setFrame(transitionOffset(destination), display: true)
        } else { panel.alphaValue = 1 }
        panel.orderFrontRegardless()
        if appearing && !reduced {
            NSAnimationContext.runAnimationGroup { context in
                context.duration = 0.26
                context.timingFunction = CAMediaTimingFunction(controlPoints: 0.2, 0.8, 0.2, 1)
                panel.animator().setFrame(destination, display: true)
                panel.animator().alphaValue = 1
            }
        }
        schedule()
    }
    func schedule() {
        timer?.invalidate(); timer = nil
        guard let current = queue.first, let deadline = expiresAt else { return }
        timer = Timer.scheduledTimer(withTimeInterval: max(0.05, deadline.timeIntervalSinceNow), repeats: false) { _ in self.remove(current.id) }
    }
    func remove(_ id: String) { queue.removeAll { $0.id == id }; render() }
    func open(_ notice: Notice) {
        if !notice.sessionId.isEmpty {
            emit(["type": "open", "id": notice.id])
            // Only bring the existing DSH app forward after a deliberate click.
            if let dsh = NSWorkspace.shared.runningApplications.first(where: { $0.localizedName == "DeepSeek Harness" }) { dsh.activate(options: [.activateAllWindows]) }
        }
        remove(notice.id)
    }
}
let application = NSApplication.shared
let controller = Controller()
application.delegate = controller
application.run()

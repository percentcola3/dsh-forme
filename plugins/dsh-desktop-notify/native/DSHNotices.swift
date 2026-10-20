import AppKit
import SwiftUI
import QuartzCore
import SceneKit

struct Preferences: Decodable {
    var enabled = true
    var position = "right"
    var display = "main"
    var duration = 5.0
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
/// Local surface maps and a normal field derived from lunar elevation data. No network requests,
/// timer-driven texture allocations or bitmap scaling on each animation frame.
enum PlanetAssets {
    static let earth = image("earth-day")
    static let clouds = image("earth-clouds")
    static let moon = image("moon-color")
    static let moonNormal = normals(image("moon-height"))
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
    static func normals(_ image: NSImage?) -> NSImage? {
        guard let cg = image?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { return nil }
        let width = cg.width, height = cg.height
        var elevation = [UInt8](repeating: 0, count: width * height * 4)
        let drawn = elevation.withUnsafeMutableBytes { buffer -> Bool in
            guard let context = CGContext(data: buffer.baseAddress, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return false }
            context.draw(cg, in: CGRect(x: 0, y: 0, width: width, height: height))
            return true
        }
        guard drawn else { return nil }
        var result = [UInt8](repeating: 255, count: elevation.count)
        func sample(_ x: Int, _ y: Int) -> Double {
            Double(elevation[(max(0, min(height - 1, y)) * width + (x + width) % width) * 4]) / 255
        }
        func byte(_ n: Double) -> UInt8 { UInt8(max(0, min(255, n * 255))) }
        for y in 0..<height {
            for x in 0..<width {
                let out = (y * width + x) * 4
                let nx = (sample(x - 1, y) - sample(x + 1, y)) * 4
                let ny = (sample(x, y - 1) - sample(x, y + 1)) * 4
                let length = sqrt(nx * nx + ny * ny + 1)
                result[out] = byte(nx / length * 0.5 + 0.5)
                result[out + 1] = byte(ny / length * 0.5 + 0.5)
                result[out + 2] = byte(1 / length * 0.5 + 0.5)
            }
        }
        return bitmap(result, width: width, height: height)
    }
}
final class PassivePlanetView: SCNView {
    override var isOpaque: Bool { false }
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
}
final class PlanetRenderer {
    let scene = SCNScene()
    let surface = SCNNode()
    let clouds = SCNNode()
    private var moving: Bool?
    private let lunar: Bool
    init(lunar: Bool) {
        self.lunar = lunar
        scene.background.contents = NSColor.clear
        let camera = SCNNode()
        camera.camera = SCNCamera()
        camera.camera!.usesOrthographicProjection = true
        camera.camera!.orthographicScale = 1.45
        camera.position = SCNVector3(0, 0, 4)
        scene.rootNode.addChildNode(camera)
        let ambient = SCNNode()
        ambient.light = SCNLight(); ambient.light!.type = .ambient
        ambient.light!.color = lunar ? NSColor(white: 0.20, alpha: 1) : NSColor(red: 0.72, green: 0.84, blue: 0.94, alpha: 1)
        ambient.light!.intensity = lunar ? 230 : 460
        scene.rootNode.addChildNode(ambient)
        let key = SCNNode()
        key.light = SCNLight(); key.light!.type = .directional
        key.light!.color = lunar ? NSColor(red: 1, green: 0.16, blue: 0.20, alpha: 1) : NSColor(red: 0.90, green: 0.97, blue: 1, alpha: 1)
        key.light!.intensity = lunar ? 1000 : 840
        key.eulerAngles = SCNVector3(-0.35, lunar ? 0.95 : -0.5, 0)
        scene.rootNode.addChildNode(key)
        let tilt = SCNNode()
        tilt.eulerAngles.z = lunar ? -0.14 : 0.18
        scene.rootNode.addChildNode(tilt)
        let sphere = SCNSphere(radius: 1)
        sphere.segmentCount = 96
        let material = SCNMaterial()
        material.lightingModel = .lambert
        material.isDoubleSided = false
        material.diffuse.contents = lunar ? (PlanetAssets.moon as Any? ?? NSColor.darkGray) : (PlanetAssets.earth as Any? ?? NSColor(red: 0.5, green: 0.75, blue: 0.87, alpha: 1))
        material.diffuse.wrapS = .repeat
        material.diffuse.minificationFilter = .linear
        material.diffuse.magnificationFilter = .linear
        if lunar {
            material.normal.contents = PlanetAssets.moonNormal
            material.normal.intensity = 1.15
            material.shaderModifiers = [.surface: """
            #pragma body
            float value = dot(_surface.diffuse.rgb, vec3(0.21, 0.72, 0.07));
            _surface.diffuse.rgb = vec3(0.10 + value * 0.40);
            """]
            material.emission.contents = NSColor(red: 0.014, green: 0.006, blue: 0.008, alpha: 1)
        } else {
            // Recolor the real coastlines into an airy, monochrome ice palette.
            material.shaderModifiers = [.surface: """
            #pragma body
            vec3 map = _surface.diffuse.rgb;
            float value = dot(map, vec3(0.21, 0.72, 0.07));
            float land = max(smoothstep(-0.03, 0.10, map.g - map.b), smoothstep(0.48, 0.85, value));
            _surface.diffuse.rgb = mix(vec3(0.34, 0.60, 0.76), vec3(0.68, 0.83, 0.91), land) * (0.90 + value * 0.18);
            _surface.emission.rgb = vec3(0.018, 0.035, 0.05);
            """]
        }
        sphere.firstMaterial = material
        surface.geometry = sphere
        surface.eulerAngles.y = lunar ? -0.35 : 0.85
        tilt.addChildNode(surface)
        if !lunar {
            let shell = SCNSphere(radius: 1.008); shell.segmentCount = 96
            let cloud = SCNMaterial()
            cloud.lightingModel = .lambert
            cloud.diffuse.contents = PlanetAssets.clouds
            cloud.shaderModifiers = [.fragment: """
            #pragma transparent
            #pragma body
            float cover = _surface.diffuse.r;
            float opacity = smoothstep(0.06, 0.90, cover) * 0.44;
            vec3 light = clamp(_output.color.rgb / max(cover, 0.001), 0.0, 1.0);
            _output.color = vec4(light * vec3(0.91, 0.97, 1.0) * opacity, opacity);
            """]
            cloud.writesToDepthBuffer = false
            shell.firstMaterial = cloud
            clouds.geometry = shell
            clouds.renderingOrder = 10
            tilt.addChildNode(clouds)
        }
        // Thin Fresnel scattering follows the sphere's actual curved silhouette.
        let atmosphere = SCNSphere(radius: lunar ? 1.012 : 1.035)
        atmosphere.segmentCount = 96
        let haze = SCNMaterial()
        haze.lightingModel = .constant
        haze.blendMode = .alpha
        haze.writesToDepthBuffer = false
        haze.shaderModifiers = [.fragment: """
        #pragma transparent
        #pragma body
        float rim = pow(1.0 - clamp(abs(dot(normalize(_surface.normal), normalize(_surface.view))), 0.0, 1.0), 3.0);
        float opacity = rim * \(lunar ? "0.22" : "0.34");
        _output.color = vec4(vec3(\(lunar ? "0.84, 0.035, 0.065" : "0.48, 0.78, 1.0")) * opacity, opacity);
        """]
        atmosphere.firstMaterial = haze
        let atmosphereNode = SCNNode(geometry: atmosphere)
        atmosphereNode.renderingOrder = 20
        tilt.addChildNode(atmosphereNode)
    }
    func setMotion(_ enabled: Bool) {
        guard moving != enabled else { return }
        moving = enabled
        surface.removeAllActions(); clouds.removeAllActions()
        guard enabled else { return }
        surface.runAction(.repeatForever(.rotateBy(x: 0, y: .pi * 2, z: 0, duration: lunar ? 24 : 16)))
        if !lunar { clouds.runAction(.repeatForever(.rotateBy(x: 0, y: .pi * 2, z: 0, duration: 19))) }
    }
}
struct PlanetScene: NSViewRepresentable {
    let lunar: Bool
    let reduceMotion: Bool
    func makeCoordinator() -> PlanetRenderer { PlanetRenderer(lunar: lunar) }
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
struct PlanetSignal: View {
    let lunar: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var breathing = false
    var tint: Color { lunar ? Color(red: 0.9, green: 0.15, blue: 0.21) : Color(red: 0.55, green: 0.81, blue: 1) }
    var body: some View {
        ZStack {
            Circle().fill(RadialGradient(colors: [tint.opacity(lunar ? 0.19 : 0.13), tint.opacity(0)], center: .center, startRadius: 12, endRadius: 24))
                .opacity(reduceMotion || !lunar ? 1 : (breathing ? 0.68 : 1))
                .animation(reduceMotion || !lunar ? nil : .easeInOut(duration: 1.8).repeatForever(autoreverses: true), value: breathing)
            PlanetScene(lunar: lunar, reduceMotion: reduceMotion).allowsHitTesting(false)
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
            PlanetSignal(lunar: notice.kind != "complete").contentShape(Circle())
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
            if preferences.sound { NSSound(named: notice.kind == "decision" ? "Glass" : "Pop")?.play() }
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
        let island = preferences.position == "island"
        let width: CGFloat = min(48, screen.visibleFrame.width - 32)
        let height: CGFloat = 48
        let visible = screen.visibleFrame
        var x = visible.maxX - width - 22
        var y = visible.maxY - height - 22
        if preferences.position == "left" { x = visible.minX + 22 }
        if preferences.position == "top" || island { x = visible.midX - width / 2 }
        if island { y = screen.frame.maxY - max(screen.safeAreaInsets.top, screen.frame.maxY - visible.maxY) - height - 6 }
        panel.setFrame(NSRect(x: x, y: y, width: width, height: height), display: true)
    }
    func transitionOffset(_ frame: NSRect) -> NSRect {
        if preferences.position == "left" { return frame.offsetBy(dx: -12, dy: 0) }
        if preferences.position == "right" { return frame.offsetBy(dx: 12, dy: 0) }
        return frame.offsetBy(dx: 0, dy: 8)
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

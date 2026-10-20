import AppKit
import SwiftUI
import QuartzCore

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
/// A quiet, text-free Wandering Earth signal. Geometry is drawn at native points,
/// so the atmospheric wake stays soft even in the small desktop footprint.
struct OrbitSignal: View {
    let attention: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30, paused: reduceMotion)) { timeline in
            Canvas { context, size in
                let t = reduceMotion ? 0 : timeline.date.timeIntervalSinceReferenceDate
                let cy = size.height / 2
                let center = CGPoint(x: 33, y: cy)
                let r: CGFloat = 10
                let blue = Color(red: 0.64, green: 0.84, blue: 0.95)
                let red = Color(red: 0.95, green: 0.39, blue: 0.43)
                for (x, y, opacity) in [(12.0, 12.0, 0.3), (70, 10, 0.2), (102, 28, 0.25), (89, 33, 0.15)] {
                    context.fill(Path(ellipseIn: CGRect(x: x, y: y, width: 1, height: 1)), with: .color(.white.opacity(opacity)))
                }
                // Two unclosed atmospheric contours flow from the globe's limb.
                for band in 0..<3 {
                    let offset = CGFloat(band) * 1.6
                    let wave = CGFloat(sin(t * 1.3 + Double(band))) * 1.4
                    for side: CGFloat in [-1, 1] {
                        var wake = Path()
                        wake.move(to: CGPoint(x: 35, y: cy + side * (r + offset)))
                        wake.addCurve(to: CGPoint(x: 104 - CGFloat(band) * 9, y: cy + side * (2.5 + offset) + wave),
                                      control1: CGPoint(x: 55, y: cy + side * (r + offset)),
                                      control2: CGPoint(x: 61, y: cy + side * (2 + offset) - wave))
                        context.stroke(wake, with: .linearGradient(Gradient(colors: [blue.opacity(0.32 - Double(band) * 0.06), blue.opacity(0)]), startPoint: center, endPoint: CGPoint(x: 106, y: cy)), lineWidth: band == 0 ? 1.1 : 0.6)
                    }
                }
                context.fill(Path(ellipseIn: CGRect(x: 17, y: cy - 16, width: 32, height: 32)), with: .radialGradient(Gradient(colors: [blue.opacity(0.24), blue.opacity(0)]), center: center, startRadius: 7, endRadius: 16))
                let globe = CGRect(x: center.x - r, y: cy - r, width: r * 2, height: r * 2)
                context.fill(Path(ellipseIn: globe), with: .radialGradient(Gradient(colors: [Color(red: 0.77, green: 0.9, blue: 0.98), Color(red: 0.27, green: 0.52, blue: 0.68), Color(red: 0.1, green: 0.23, blue: 0.35)]), center: CGPoint(x: 29, y: cy - 5), startRadius: 0, endRadius: 23))
                var surface = context
                surface.clip(to: Path(ellipseIn: globe))
                // Project drifting ice/cloud fragments onto the visible hemisphere.
                for patch in 0..<9 {
                    let longitude = t * 0.65 + Double(patch) * 2.4
                    let facing = cos(longitude)
                    if facing > 0 {
                        let x = center.x + CGFloat(sin(longitude)) * r * 0.88
                        let y = cy + CGFloat(sin(Double(patch) * 1.7)) * 6
                        surface.fill(Path(ellipseIn: CGRect(x: x - CGFloat(facing) * 3, y: y - 1.2, width: CGFloat(facing) * 6, height: 3.3)), with: .color(.white.opacity(0.34)))
                    }
                }
                context.stroke(Path(ellipseIn: globe.insetBy(dx: -0.8, dy: -0.8)), with: .color(blue.opacity(0.55)), lineWidth: 0.7)
                if attention {
                    // A small drifting moon and red halo mark a choice or error.
                    let moon = CGPoint(x: 79 + CGFloat(sin(t * 0.6)) * 2, y: cy - 2 + CGFloat(sin(t * 0.8)) * 2)
                    let pulse = reduceMotion ? 0.25 : 0.18 + (sin(t * 2.2) + 1) * 0.08
                    context.fill(Path(ellipseIn: CGRect(x: moon.x - 10, y: moon.y - 10, width: 20, height: 20)), with: .radialGradient(Gradient(colors: [red.opacity(pulse), red.opacity(0)]), center: moon, startRadius: 2, endRadius: 10))
                    context.fill(Path(ellipseIn: CGRect(x: moon.x - 3.5, y: moon.y - 3.5, width: 7, height: 7)), with: .linearGradient(Gradient(colors: [Color(white: 0.86), Color(white: 0.3)]), startPoint: CGPoint(x: moon.x - 3, y: moon.y - 3), endPoint: CGPoint(x: moon.x + 3, y: moon.y + 3)))
                    var orbit = Path()
                    orbit.addArc(center: moon, radius: 6, startAngle: .degrees(t * 24), endAngle: .degrees(t * 24 + 110), clockwise: false)
                    context.stroke(orbit, with: .color(red.opacity(0.55)), lineWidth: 0.8)
                }
            }
        }.accessibilityHidden(true)
    }
}
struct NoticeCard: View {
    let notice: Notice
    let island: Bool
    let open: () -> Void
    var label: String { notice.kind == "complete" ? "任务完成" : (notice.kind == "error" ? "执行异常" : "需要选择") }
    var body: some View {
        Button(action: open) {
            OrbitSignal(attention: notice.kind != "complete")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .background(island ? Color.black.opacity(0.94) : Color(red: 0.035, green: 0.06, blue: 0.085).opacity(0.9))
        .clipShape(Capsule())
        .padding(1)
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
        panel.hasShadow = true
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
        let width: CGFloat = min(124, screen.visibleFrame.width - 32)
        let height: CGFloat = 40
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
        panel.contentView = NSHostingView(rootView: NoticeCard(notice: notice, island: preferences.position == "island", open: { self.open(notice) }).id(notice.id))
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

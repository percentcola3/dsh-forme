import AppKit
import SwiftUI
import QuartzCore

struct Preferences: Decodable {
    var enabled = true
    var position = "right"
    var display = "main"
    var duration = 8.0
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
struct NoticeCard: View {
    let notice: Notice
    let island: Bool
    let count: Int
    let open: () -> Void
    let dismiss: () -> Void
    let hover: (Bool) -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var appeared = false
    @State private var breathing = false
    var attention: Bool { notice.kind != "complete" }
    var label: String { notice.kind == "complete" ? "任务完成" : (notice.kind == "error" ? "执行异常" : "需要选择") }
    var accent: Color { attention ? Color(red: 1, green: 0.46, blue: 0.5) : Color(red: 0.49, green: 0.84, blue: 0.74) }
    var body: some View {
        HStack(spacing: 6) {
            Button(action: open) {
                HStack(spacing: 10) {
                    ZStack {
                        Circle().fill(accent.opacity(0.1)).frame(width: 28, height: 28)
                        if attention {
                            Circle().stroke(accent.opacity(breathing ? 0.2 : 0.65), lineWidth: 1)
                                .frame(width: 25, height: 25)
                                .scaleEffect(reduceMotion ? 1 : (breathing ? 1.12 : 0.92))
                                .animation(reduceMotion ? nil : .easeInOut(duration: 1.4).repeatForever(autoreverses: true), value: breathing)
                        } else {
                            Circle().stroke(accent.opacity(0.5), lineWidth: 1).frame(width: 25, height: 25)
                                .scaleEffect(reduceMotion ? 1 : (appeared ? 1.4 : 0.8))
                                .opacity(reduceMotion || appeared ? 0 : 1)
                                .animation(reduceMotion ? nil : .easeOut(duration: 0.8), value: appeared)
                        }
                        Image(systemName: notice.kind == "complete" ? "checkmark" : (notice.kind == "error" ? "exclamationmark" : "ellipsis"))
                            .font(.system(size: 12, weight: .semibold)).foregroundStyle(accent)
                            .scaleEffect(reduceMotion || appeared ? 1 : 0.6)
                            .animation(reduceMotion ? nil : .spring(response: 0.35, dampingFraction: 0.65), value: appeared)
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text(label).font(.system(size: 12, weight: .semibold)).foregroundStyle(accent)
                        Text(notice.title).font(.system(size: 10)).foregroundStyle(.white.opacity(0.62)).lineLimit(1).truncationMode(.tail)
                    }.frame(maxWidth: .infinity, alignment: .leading)
                }.contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(label)，\(notice.title)")
            .accessibilityHint(notice.sessionId.isEmpty ? "关闭测试提醒" : "打开任务")
            if count > 1 {
                Text("+\(count - 1)").font(.system(size: 10, weight: .medium, design: .monospaced)).foregroundStyle(.white.opacity(0.5))
            }
            Button(action: dismiss) {
                Image(systemName: "xmark").font(.system(size: 9, weight: .medium)).foregroundStyle(.white.opacity(0.45)).frame(width: 20, height: 28)
            }.buttonStyle(.plain).accessibilityLabel("关闭提醒")
        }
        .padding(.horizontal, 13)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
        .background(island ? Color.black : Color(red: 0.045, green: 0.065, blue: 0.09))
        .clipShape(Capsule())
        .overlay(Capsule().stroke(.white.opacity(island ? 0.12 : 0.16), lineWidth: 1))
        .padding(1)
        .onAppear { appeared = true; breathing = true }
        .onHover(perform: hover)
    }
}
final class Controller: NSObject, NSApplicationDelegate {
    var panel: NoticePanel!
    var preferences = Preferences()
    var queue: [Notice] = []
    var timer: Timer?
    var hovered = false
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
        let width: CGFloat = min(island ? 280 : 300, screen.visibleFrame.width - 32)
        let height: CGFloat = island || preferences.position == "top" ? 56 : 60
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
            guard panel.isVisible, !reduced else { panel.orderOut(nil); return }
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
            })
            return
        }
        let appearing = !panel.isVisible || displayedID != notice.id
        if appearing { hovered = false }
        displayedID = notice.id
        panel.contentView = NSHostingView(rootView: NoticeCard(notice: notice, island: preferences.position == "island", count: queue.count, open: { self.open(notice) }, dismiss: { self.remove(notice.id) }, hover: { over in self.hovered = over; self.schedule() }).id(notice.id))
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
        guard let current = queue.first, !hovered, current.kind != "decision" || current.sessionId.isEmpty else { return }
        timer = Timer.scheduledTimer(withTimeInterval: max(4, min(30, preferences.duration)), repeats: false) { _ in self.remove(current.id) }
    }
    func remove(_ id: String) { queue.removeAll { $0.id == id }; hovered = false; render() }
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

import AppKit
import SwiftUI

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
    var attention: Bool { notice.kind != "complete" }
    var accent: Color { attention ? Color(red: 1, green: 0.39, blue: 0.43) : Color(red: 0.44, green: 0.84, blue: 0.73) }
    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            ZStack {
                Circle().fill(accent.opacity(0.13)).frame(width: 38, height: 38)
                Image(systemName: attention ? "ellipsis.bubble.fill" : "checkmark").font(.system(size: 17, weight: .semibold)).foregroundStyle(accent)
            }.padding(.top, 2)
            VStack(alignment: .leading, spacing: 7) {
                HStack(spacing: 8) {
                    Text(attention ? (notice.kind == "error" ? "任务需要检查" : "需要你的选择") : "任务已完成").font(.system(size: 11, weight: .semibold)).foregroundStyle(accent)
                    Text("DSH").font(.system(size: 9, weight: .medium, design: .monospaced)).tracking(1.5).foregroundStyle(.white.opacity(0.42))
                    if count > 1 { Text("+\(count - 1)").font(.system(size: 10, design: .monospaced)).foregroundStyle(.white.opacity(0.5)) }
                    Spacer(minLength: 0)
                    Button(action: dismiss) { Image(systemName: "xmark").font(.system(size: 10, weight: .medium)).foregroundStyle(.white.opacity(0.5)).frame(width: 20, height: 18) }.buttonStyle(.plain).accessibilityLabel("关闭提醒")
                }
                Text(notice.title).font(.system(size: 14, weight: .semibold)).foregroundStyle(.white.opacity(0.95)).lineLimit(1)
                Text(notice.body).font(.system(size: 11)).foregroundStyle(.white.opacity(0.62)).lineLimit(island ? 1 : 2).frame(maxWidth: .infinity, alignment: .leading)
                Button(action: open) { HStack(spacing: 5) { Text(notice.sessionId.isEmpty ? "测试提醒" : "查看任务"); Image(systemName: "arrow.up.right").font(.system(size: 9)) }.font(.system(size: 10, weight: .medium)).foregroundStyle(.white.opacity(0.86)) }.buttonStyle(.plain).padding(.top, 2)
            }
        }
        .padding(.horizontal, island ? 25 : 21).padding(.vertical, island ? 18 : 20)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(island ? Color.black : Color(red: 0.055, green: 0.075, blue: 0.105))
        .overlay(alignment: .top) { Rectangle().fill(LinearGradient(colors: [.clear, accent.opacity(0.45), .clear], startPoint: .leading, endPoint: .trailing)).frame(height: 1).padding(.horizontal, 28) }
        .clipShape(RoundedRectangle(cornerRadius: island ? 30 : 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: island ? 30 : 18, style: .continuous).stroke(.white.opacity(island ? 0.1 : 0.15), lineWidth: 1))
        .padding(1)
        .onHover(perform: hover)
    }
}
final class Controller: NSObject, NSApplicationDelegate {
    var panel: NoticePanel!
    var preferences = Preferences()
    var queue: [Notice] = []
    var timer: Timer?
    var hovered = false
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
        let width: CGFloat = min(island ? 420 : (preferences.position == "top" ? 460 : 380), screen.visibleFrame.width - 32)
        let height: CGFloat = island ? 140 : 166
        let visible = screen.visibleFrame
        var x = visible.maxX - width - 22
        var y = visible.maxY - height - 22
        if preferences.position == "left" { x = visible.minX + 22 }
        if preferences.position == "top" || island { x = visible.midX - width / 2 }
        if island { y = screen.frame.maxY - max(screen.safeAreaInsets.top, screen.frame.maxY - visible.maxY) - height - 6 }
        panel.setFrame(NSRect(x: x, y: y, width: width, height: height), display: true)
    }
    func render() {
        timer?.invalidate(); timer = nil
        guard let notice = queue.first else { panel.orderOut(nil); return }
        panel.contentView = NSHostingView(rootView: NoticeCard(notice: notice, island: preferences.position == "island", count: queue.count, open: { self.open(notice) }, dismiss: { self.remove(notice.id) }, hover: { over in self.hovered = over; self.schedule() }))
        reposition()
        let appearing = !panel.isVisible
        if appearing { panel.alphaValue = NSWorkspace.shared.accessibilityDisplayShouldReduceMotion ? 1 : 0 }
        panel.orderFrontRegardless()
        if appearing { NSAnimationContext.runAnimationGroup { context in context.duration = 0.22; panel.animator().alphaValue = 1 } }
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

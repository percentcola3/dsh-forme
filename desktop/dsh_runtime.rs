use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::{atomic::{AtomicBool, Ordering}, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager, Url, WebviewWindow};

#[derive(Clone, serde::Serialize)]
pub struct Status {
    phase: String,
    message: String,
}

pub struct Service {
    child: Mutex<Option<Child>>,
    status: Mutex<Status>,
    startup_url: Url,
    origin: Mutex<Option<Url>>,
    retried_auth: AtomicBool,
}

fn show_status(app: &AppHandle, phase: &str, message: &str) {
    eprintln!("[DeepSeek] {phase}: {message}");
    let state = app.state::<Service>();
    *state.status.lock().unwrap() = Status { phase: phase.into(), message: message.into() };
    if phase != "ready" {
        if let Some(window) = app.get_webview_window("pake") {
            if window.url().ok().as_ref() != Some(&state.startup_url) {
                let _ = window.navigate(state.startup_url.clone());
            }
        }
    }
}

pub fn install(window: &WebviewWindow) -> tauri::Result<()> {
    let app = window.app_handle();
    app.manage(Service {
        child: Mutex::new(None),
        status: Mutex::new(Status { phase: "starting".into(), message: "正在启动 DeepSeek…".into() }),
        // WKWebView can still report about:blank immediately after creation.
        startup_url: Url::parse("tauri://localhost/index.html").expect("bundled startup URL"),
        origin: Mutex::new(None),
        retried_auth: AtomicBool::new(false),
    });
    if spawn_service(app).is_err() {
        show_status(app, "error", "无法启动服务，请退出 App 后重试。");
    }
    Ok(())
}

fn spawn_service(app: &AppHandle) -> Result<(), String> {
    let resources = app.path().resource_dir().map_err(|e| e.to_string())?;
    let mut child = Command::new("/bin/zsh")
        .arg(resources.join("start-service.sh"))
        .arg(resources.join("service.mjs"))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        // The service emits sanitized status on stdout, not raw npm output.
        .stderr(Stdio::null())
        .spawn().map_err(|e| e.to_string())?;
    let stdout = child.stdout.take().ok_or("missing service output")?;
    *app.state::<Service>().child.lock().unwrap() = Some(child);
    let app = app.clone();
    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            let Ok(event) = serde_json::from_str::<serde_json::Value>(&line) else { continue };
            let phase = event["phase"].as_str().unwrap_or("error");
            let message = event["message"].as_str().unwrap_or("服务启动失败，请重试。");
            if phase == "ready" {
                let url = event["url"].as_str().and_then(|s| Url::parse(s).ok());
                let Some(url) = url.filter(|url| {
                    url.scheme() == "http" && url.host_str() == Some("127.0.0.1")
                        && url.port().is_some()
                        && url.query_pairs().any(|(key, value)| key == "token" && !value.is_empty())
                }) else {
                    show_status(&app, "error", "服务返回的连接地址无效。");
                    continue;
                };
                if let Some(window) = app.get_webview_window("pake") {
                    if let Err(message) = authenticate(&window, url) {
                        show_status(&app, "error", message);
                    }
                }
            } else {
                show_status(&app, phase, message);
            }
        }
        if app.state::<Service>().status.lock().unwrap().phase != "error" {
            show_status(&app, "error", "服务管理进程已停止，请重试。");
        }
    });
    Ok(())
}

/// Complete the official token exchange before loading a clean workspace URL.
/// This runs on the service reader thread, never the WebKit main thread.
fn authenticate(window: &WebviewWindow, launch_url: Url) -> Result<(), &'static str> {
    use tauri::webview::Cookie;
    use tauri_plugin_http::reqwest::{Client, redirect::Policy, header::{COOKIE, SET_COOKIE}};
    let mut origin = launch_url.clone();
    origin.set_query(None);
    origin.set_fragment(None);
    eprintln!("[DeepSeek] Starting official authentication exchange");
    let (header, cookie_pair) = tauri::async_runtime::block_on(async {
        let client = Client::builder().no_proxy().redirect(Policy::none())
            .timeout(Duration::from_secs(10)).build().map_err(|_| "无法建立本地认证连接。")?;
        let response = client.get(launch_url).send().await.map_err(|_| "服务认证连接失败，请重试。")?;
        if response.status().as_u16() != 303 { return Err("服务未接受启动认证，请重试。") }
        let header = response.headers().get(SET_COOKIE).and_then(|h| h.to_str().ok())
            .ok_or("服务未返回认证 Cookie。")?.to_owned();
        let parsed = Cookie::parse(header.clone()).map_err(|_| "服务返回了无效 Cookie。")?;
        if parsed.http_only() != Some(true) { return Err("服务返回了无效认证 Cookie。") }
        let pair = format!("{}={}", parsed.name(), parsed.value());
        let authenticated = client.get(origin.clone()).header(COOKIE, &pair).send().await
            .map_err(|_| "工作区连接失败，请重试。")?;
        if authenticated.status().as_u16() != 200 { return Err("工作区 Cookie 认证失败，请重试。") }
        Ok((header, pair))
    })?;
    eprintln!("[DeepSeek] Official cookie-authenticated workspace verified");
    let mut cookie = Cookie::parse(header).map_err(|_| "认证 Cookie 解析失败。")?.into_owned();
    cookie.set_domain("127.0.0.1");
    // Preserve Expires while avoiding WebKit's legacy version-1 Max-Age conversion.
    if cookie.expires().is_some() { cookie.set_max_age(None); }
    window.set_cookie(cookie).map_err(|_| "无法写入 App 认证 Cookie。")?;
    eprintln!("[DeepSeek] Cookie write completed");
    // Wry 0.54 compares URL::domain(), which is None for IP hosts like 127.0.0.1.
    // Read the store and match the exact host/name/value instead.
    let saved = window.cookies().map_err(|_| "无法确认 App 认证 Cookie。")?;
    if !saved.iter().any(|cookie| cookie.domain().map(|s| s.trim_start_matches('.')) == Some("127.0.0.1")
        && format!("{}={}", cookie.name(), cookie.value()) == cookie_pair) {
        return Err("App 未保存认证 Cookie，请重试。");
    }
    let state = window.app_handle().state::<Service>();
    *state.origin.lock().unwrap() = Some(origin.clone());
    state.retried_auth.store(false, Ordering::Relaxed);
    *state.status.lock().unwrap() = Status { phase: "connecting".into(), message: "正在打开工作区…".into() };
    eprintln!("[DeepSeek] App authentication cookie installed");
    window.navigate(origin).map_err(|_| "无法打开工作区，请重试。")
}

pub fn check_page(app: &AppHandle) {
    let Some(state) = app.try_state::<Service>() else { return };
    let Some(origin) = state.origin.lock().unwrap().clone() else { return };
    let Some(window) = app.get_webview_window("pake") else { return };
    if window.url().ok().map(|url| url.origin()) != Some(origin.origin()) { return }
    let _ = window.eval(r#"
        window.__TAURI__.core.invoke('dsh_page_loaded', {
            page: document.getElementById('root') ? 'workspace'
                : document.body?.textContent?.includes('dsh web authentication required') ? 'unauthorized' : 'unexpected'
        });
    "#);
}

#[tauri::command]
pub fn dsh_page_loaded(window: WebviewWindow, page: String) {
    let app = window.app_handle();
    let state = app.state::<Service>();
    let Some(origin) = state.origin.lock().unwrap().clone() else { return };
    if window.url().ok().map(|url| url.origin()) != Some(origin.origin()) { return }
    match page.as_str() {
        "workspace" => {
            *state.status.lock().unwrap() = Status { phase: "ready".into(), message: "".into() };
            eprintln!("[DeepSeek] Authenticated workspace loaded in WebView");
        }
        "unauthorized" if !state.retried_auth.swap(true, Ordering::Relaxed) => {
            // A first navigation from the local bootstrap is cross-site for Strict cookies.
            // Reload from the now-established HTTP origin once; never create a 401 loop.
            eprintln!("[DeepSeek] Repeating navigation from the workspace origin");
            // A native/UI reload retains the original cross-site request context.
            // A script-initiated navigation uses this HTTP document as its initiator.
            let _ = window.eval("window.location.replace(window.location.href)");
        }
        _ => {
            eprintln!("[DeepSeek] Workspace authentication/page check failed: {page}");
            show_status(app, "error", "App 未能完成工作区认证，请重试。");
        }
    }
}

#[tauri::command]
pub fn dsh_status(state: tauri::State<'_, Service>) -> Status {
    state.status.lock().unwrap().clone()
}

#[tauri::command]
pub fn dsh_restart(window: WebviewWindow) -> Result<(), String> {
    let app = window.app_handle();
    let state = app.state::<Service>();
    // Only the bundled startup/error page can request a restart.
    if window.url().map_err(|e| e.to_string())? != state.startup_url {
        return Err("Restart is available on the startup page only".into());
    }
    let mut child = state.child.lock().unwrap();
    if let Some(process) = child.as_mut() {
        if process.try_wait().map_err(|e| e.to_string())?.is_none() {
            return process.stdin.as_mut().ok_or("service input unavailable")?
                .write_all(b"restart\n").map_err(|e| e.to_string());
        }
    }
    *child = None;
    drop(child);
    show_status(app, "starting", "正在启动 DeepSeek…");
    spawn_service(app)
}

pub fn shutdown(app: &AppHandle) {
    let Some(state) = app.try_state::<Service>() else { return };
    let Some(mut child) = state.child.lock().unwrap().take() else { return };
    // EOF tells the supervisor to terminate its npm/dsh process group.
    drop(child.stdin.take());
    let deadline = Instant::now() + Duration::from_secs(6);
    while Instant::now() < deadline {
        if child.try_wait().ok().flatten().is_some() { return }
        std::thread::sleep(Duration::from_millis(50));
    }
    let _ = child.kill();
    let _ = child.wait();
}

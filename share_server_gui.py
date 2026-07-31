"""
Airbase — Home LAN Share
Desktop Application Entry Point

Opens a native Windows app window (via pywebview) instead of the system browser.
Also shows a system tray icon for background management.
"""

import os
import sys
import socket
import threading
import time

# ── Path Resolution ──────────────────────────────────────────────────────────
def get_base_dir():
    if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
        return sys._MEIPASS
    return os.environ.get('AIRBASE_BASE_DIR', os.path.dirname(os.path.abspath(__file__)))

def get_app_dir():
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.environ.get('AIRBASE_APP_DIR', os.path.dirname(os.path.abspath(__file__)))

BASE_DIR = get_base_dir()
APP_DIR  = get_app_dir()

os.environ['AIRBASE_BASE_DIR'] = BASE_DIR
os.environ['AIRBASE_APP_DIR']  = APP_DIR

# ── Optional imports ──────────────────────────────────────────────────────────
try:
    import webview
    HAS_WEBVIEW = True
except ImportError:
    HAS_WEBVIEW = False

try:
    import pystray
    from pystray import MenuItem as Item
    from PIL import Image, ImageDraw
    HAS_TRAY = True
except ImportError:
    HAS_TRAY = False

# ── Import Flask app ──────────────────────────────────────────────────────────
sys.path.insert(0, BASE_DIR)
from share_server import app as flask_app, get_local_ip

PORT         = 5000
SHARED_FOLDER = os.path.join(APP_DIR, 'SharedFiles')
os.makedirs(SHARED_FOLDER, exist_ok=True)

# ── Build tray icon ───────────────────────────────────────────────────────────
def build_tray_icon():
    logo_path = os.path.join(BASE_DIR, 'static', 'images', 'logo.jpg')
    if os.path.exists(logo_path):
        try:
            img = Image.open(logo_path).convert('RGBA')
            return img.resize((64, 64), Image.Resampling.LANCZOS)
        except Exception:
            pass
    size = 64
    img  = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse([4, 4, size - 4, size - 4], fill='#6366f1')
    cx, cy = size // 2, size // 2 + 6
    for r, t in [(22, 3), (15, 3), (8, 3)]:
        draw.arc([cx - r, cy - r, cx + r, cy + r], start=200, end=340, fill='white', width=t)
    draw.ellipse([cx - 3, cy - 3, cx + 3, cy + 3], fill='white')
    return img

# ── Flask server thread ───────────────────────────────────────────────────────
def run_flask():
    flask_app.run(host='0.0.0.0', port=PORT, debug=False, use_reloader=False, threaded=True)

flask_thread = threading.Thread(target=run_flask, daemon=True)

# ── Tray: reference to webview window ─────────────────────────────────────────
_webview_window = None

def _show_window(icon=None, item=None):
    if _webview_window:
        _webview_window.show()

def _open_shared_folder(icon=None, item=None):
    import subprocess
    subprocess.Popen(['explorer', SHARED_FOLDER])

def _copy_network_url(icon=None, item=None):
    ip  = get_local_ip()
    url = f"http://{ip}:{PORT}"
    try:
        import ctypes
        ctypes.windll.user32.OpenClipboard(None)
        ctypes.windll.user32.EmptyClipboard()
        encoded = (url + '\0').encode('utf-16-le')
        handle  = ctypes.windll.kernel32.GlobalAlloc(0x0002, len(encoded))
        ptr     = ctypes.windll.kernel32.GlobalLock(handle)
        ctypes.memmove(ptr, encoded, len(encoded))
        ctypes.windll.kernel32.GlobalUnlock(handle)
        ctypes.windll.user32.SetClipboardData(13, handle)
        ctypes.windll.user32.CloseClipboard()
    except Exception:
        pass

def _exit_app(icon, item):
    icon.stop()
    os._exit(0)

def run_tray():
    menu = pystray.Menu(
        Item('🌐  Show Airbase Window', _show_window, default=True),
        Item('📂  Open Shared Files',   _open_shared_folder),
        Item('📋  Copy Network Link',   _copy_network_url),
        pystray.Menu.SEPARATOR,
        Item('❌  Exit Airbase',        _exit_app),
    )
    icon = pystray.Icon(
        name='Airbase',
        icon=build_tray_icon(),
        title=f"Airbase — http://{get_local_ip()}:{PORT}",
        menu=menu,
    )
    icon.run()

# ── Automatic Desktop Shortcut Creation ──────────────────────────────────────
def ensure_desktop_shortcut():
    """Silently creates or updates the Desktop Shortcut (Airbase.lnk) on Windows."""
    try:
        if sys.platform != 'win32':
            return
        import ctypes.wintypes
        CSIDL_DESKTOPDIRECTORY = 16
        buf = ctypes.create_unicode_buffer(ctypes.wintypes.MAX_PATH)
        ctypes.windll.shell32.SHGetFolderPathW(None, CSIDL_DESKTOPDIRECTORY, None, 0, buf)
        desktop_dir = buf.value
        
        shortcut_path = os.path.join(desktop_dir, 'Airbase.lnk')
        
        if getattr(sys, 'frozen', False):
            exe_path = sys.executable
        else:
            exe_path = os.path.abspath(__file__)
            
        if os.path.exists(exe_path):
            exe_dir = os.path.dirname(exe_path)
            # Find app_icon.ico in bundle or static folder
            ico_path = os.path.join(BASE_DIR, 'static', 'images', 'app_icon.ico')
            if not os.path.exists(ico_path):
                ico_path = f"{exe_path},0"
                
            ps_cmd = (
                f"$ws = New-Object -ComObject WScript.Shell; "
                f"$s = $ws.CreateShortcut('{shortcut_path}'); "
                f"$s.TargetPath = '{exe_path}'; "
                f"$s.WorkingDirectory = '{exe_dir}'; "
                f"$s.IconLocation = '{ico_path}'; "
                f"$s.Description = 'Airbase Home LAN File Sharing Hub'; "
                f"$s.Save()"
            )
            import subprocess
            subprocess.Popen(
                ['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps_cmd],
                creationflags=0x08000000 # CREATE_NO_WINDOW
            )
    except Exception:
        pass

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    global _webview_window

    # Auto-create desktop shortcut on launch
    ensure_desktop_shortcut()

    print("=" * 60)
    print("      AIRBASE — HOME LAN SHARE")
    print("=" * 60)
    print(f"  Shared Folder : {SHARED_FOLDER}")
    print(f"  Network URL   : http://{get_local_ip()}:{PORT}")
    print("=" * 60)

    # Start Flask
    flask_thread.start()

    # Give Flask a moment to bind the port
    time.sleep(1.0)

    url = f"http://localhost:{PORT}"

    if HAS_WEBVIEW:
        # ── Native desktop window (pywebview) ──────────────────────────────
        if HAS_TRAY:
            tray_thread = threading.Thread(target=run_tray, daemon=True)
            tray_thread.start()

        _webview_window = webview.create_window(
            title        = 'Airbase — Home LAN Share',
            url          = url,
            width        = 1200,
            height       = 800,
            min_size     = (800, 600),
            resizable    = True,
            frameless    = False,
            easy_drag    = False,
            text_select  = True,
            confirm_close= False,
        )

        # Use EdgeChromium (modern WebView2) if available for best rendering
        webview.start(
            gui                  = 'edgechromium',
            debug                = False,
            private_mode         = False,
            storage_path         = APP_DIR,
            http_server          = False,
        )

    elif HAS_TRAY:
        # ── Tray only, open system browser ────────────────────────────────
        import webbrowser
        webbrowser.open(url)
        run_tray()

    else:
        # ── Pure terminal fallback ─────────────────────────────────────────
        import webbrowser
        webbrowser.open(url)
        print("Running... press Ctrl+C to stop.")
        flask_thread.join()


if __name__ == '__main__':
    main()

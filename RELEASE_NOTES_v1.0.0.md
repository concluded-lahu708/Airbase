# 🚀 Airbase v1.0.0 — Official First Release

We are excited to announce the initial release of **Airbase**! 

Airbase is a zero-configuration, cross-platform local network file sharing hub. Share files, folders, videos, photos, and clipboard text instantly across iPhones, Androids, Macs, and PCs on your Wi-Fi network — without cloud uploads, account creation, or cables.

---

## ✨ What's New in v1.0.0

### 🖥️ Standalone Desktop Experience (Windows)
- **Zero-Dependency Executable (`Airbase.exe`)**: Runs out-of-the-box without requiring Python or terminal setup.
- **Native App Window (`pywebview`)**: Embedded EdgeChromium desktop UI with zero browser chrome clutter.
- **System Tray Integration (`pystray`)**: Runs silently in the background with a right-click tray menu (Open Hub, Open Shared Files, Copy URL, Exit).
- **Auto-Desktop Shortcut**: Automatically creates an Airbase shortcut on your Windows Desktop with custom branding on launch.

### 📱 Mobile & Cross-Platform Connectivity
- **QR Code Instant Connect**: Point any mobile camera at the QR code on screen to join the LAN hub in seconds.
- **Dynamic Local IP Detection**: Automatically detects local router IP shifts and updates QR codes in real time.

### 📂 File & Folder Management
- **Nested Directory Support**: Create subfolders, upload entire directory structures, and navigate with interactive breadcrumbs.
- **Batch Selection & ZIP Downloads**: Select multiple files or entire subfolders and download them as a single `.zip` archive.
- **WinError Lock Guard**: Handles file locks from Windows indexers and OneDrive safely during folder deletions.

### 📋 Global Clipboard Sync & Quick Text
- **Ctrl+V Paste Anywhere**: Press `Ctrl+V` anywhere in the app to upload copied images or files instantly.
- **Quick Text & Wi-Fi Password Sharing**: Dedicated expandable section to share text snippets, URLs, and Wi-Fi passwords across devices.

### 🎬 Media Streaming & Preview Lightbox
- **In-App Media Player**: Stream MP4 videos, listen to MP3 audio, and view high-res images in responsive lightboxes without downloading.
- **Code & Document Inspector**: Preview text files, JSON, Python, and code snippets directly inside an in-browser inspector.

### 🎨 Glassmorphism 2.0 UI & Audio Feedback
- **Modern Glass Aesthetics**: Dark & light theme toggle, ambient background glow mesh, and smooth micro-animations.
- **Audio Feedback**: Subtle sound cues for successful uploads, deletions, and actions (toggleable).

---

## 🔒 Security & Privacy
- **100% Local & Offline**: All file transfers remain strictly inside your local Wi-Fi network. Zero external cloud servers, zero telemetry.
- **Path Traversal Protection**: Uses normalized path resolution (`resolve_secure_path`) to prevent access to files outside `SharedFiles/`.

---

## 📦 Downloads & Installation

### For Windows Users (Zero Setup)
1. Download **`Airbase-v1.0-Windows.zip`** attached below.
2. Extract the zip file to any folder.
3. Double-click **`Airbase.exe`** to launch!

---

## 🙏 Feedback & Contributions
Found a bug or have a feature suggestion? Please open an issue or pull request on [GitHub](https://github.com/SakethGoljana/Airbase).

Thank you for supporting Airbase! 🚀

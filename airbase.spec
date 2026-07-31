# -*- mode: python ; coding: utf-8 -*-
"""
Airbase PyInstaller spec file — with pywebview (native in-app window)
Run with: pyinstaller airbase.spec --noconfirm
"""

from PyInstaller.utils.hooks import collect_data_files, collect_dynamic_libs

# ── Bundle templates and static assets ──────────────────────────────────────
added_files = [
    ('templates', 'templates'),
    ('static',    'static'),
]
added_files += collect_data_files('qrcode')
added_files += collect_data_files('webview')

# ── Hidden imports ────────────────────────────────────────────────────────────
hidden_imports = [
    # Flask / server
    'flask', 'flask.templating', 'jinja2', 'jinja2.ext',
    'werkzeug', 'werkzeug.serving', 'werkzeug.debug', 'click',
    # Image / QR
    'PIL', 'PIL.Image', 'PIL.ImageDraw', 'PIL.ImageFont', 'PIL.ImageOps',
    'qrcode', 'qrcode.image.pil',
    # Tray
    'pystray', 'pystray._win32',
    # pywebview — Windows backends
    'webview', 'webview.platforms', 'webview.platforms.winforms',
    'webview.platforms.edgechromium', 'webview.platforms.mshtml',
    'clr', 'clr_loader',
]

block_cipher = None

a = Analysis(
    ['share_server_gui.py'],
    pathex=['.'],
    binaries=[],
    datas=added_files,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'numpy', 'scipy', 'pandas'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='Airbase',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,      # No CMD window — pure GUI app
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='static/images/app_icon.ico',
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='AirbaseApp',
)

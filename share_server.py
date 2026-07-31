import os
import socket
import io
import base64
import time
import zipfile
import shutil
import stat
import subprocess
from datetime import datetime
from pathlib import Path
from flask import Flask, render_template, request, jsonify, send_from_directory, send_file, abort
from werkzeug.utils import secure_filename
import qrcode

# ── Path Resolution (dev mode vs PyInstaller exe) ──────────────────────────
# When running as PyInstaller exe, templates/static are in sys._MEIPASS.
# User data (SharedFiles) is always next to the .exe / script.
import sys

def _get_resource_dir():
    """Directory containing templates/ and static/ — inside the bundle when frozen."""
    if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
        return sys._MEIPASS
    # Also allow override via env var set by share_server_gui.py
    return os.environ.get('AIRBASE_BASE_DIR', os.path.dirname(os.path.abspath(__file__)))

def _get_data_dir():
    """Directory where SharedFiles/ is stored — always beside the exe/script."""
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.environ.get('AIRBASE_APP_DIR', os.path.dirname(os.path.abspath(__file__)))

RESOURCE_DIR = _get_resource_dir()
BASE_DIR = _get_data_dir()

app = Flask(
    __name__,
    template_folder=os.path.join(RESOURCE_DIR, 'templates'),
    static_folder=os.path.join(RESOURCE_DIR, 'static')
)

app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024

SHARED_FOLDER = os.path.abspath(os.path.join(BASE_DIR, 'SharedFiles'))
os.makedirs(SHARED_FOLDER, exist_ok=True)

IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico', '.tiff'}
TEXT_EXTENSIONS = {'.txt', '.md', '.py', '.js', '.json', '.html', '.css', '.c', '.cpp', '.h', '.java', '.sh', '.bat', '.cmd', '.xml', '.yaml', '.yml', '.csv', '.log', '.ini'}

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.5)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        try:
            return socket.gethostbyname(socket.gethostname())
        except Exception:
            return '127.0.0.1'

def generate_qr_code(text):
    try:
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=8,
            border=2,
        )
        qr.add_data(text)
        qr.make(fit=True)
        img = qr.make_image(fill_color="#0f172a", back_color="#ffffff")
        
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        return f"data:image/png;base64,{base64.b64encode(buffered.getvalue()).decode('utf-8')}"
    except Exception as e:
        print(f"Error generating QR code: {e}")
        return ""

def resolve_secure_path(relative_path=""):
    """
    Safely resolve relative_path inside SHARED_FOLDER.
    Prevents path traversal attacks while keeping spaces & folder names intact.
    Returns (abs_path, clean_relative_path, is_valid)
    """
    if not relative_path:
        return SHARED_FOLDER, "", True
        
    clean_rel = relative_path.replace('\\', '/').strip('/')
    parts = [p.strip() for p in clean_rel.split('/') if p and p != '.']
    
    if any(p == '..' for p in parts):
        return None, "", False
        
    full_path = os.path.abspath(os.path.join(SHARED_FOLDER, *parts))
    
    if full_path.startswith(SHARED_FOLDER):
        rel_path = os.path.relpath(full_path, SHARED_FOLDER).replace('\\', '/')
        if rel_path == '.':
            rel_path = ""
        return full_path, rel_path, True
        
    return None, "", False

def safe_delete_path(target_path):
    """
    Robust deletion for Windows handling Read-Only attributes, 
    OneDrive sync locks, and process handles.
    """
    if not os.path.exists(target_path):
        return True

    def remove_readonly(func, path, exc_info):
        try:
            os.chmod(path, stat.S_IWRITE)
            func(path)
        except Exception:
            pass

    if os.path.isdir(target_path):
        # 1. Try shutil.rmtree with read-only error handler
        try:
            shutil.rmtree(target_path, onerror=remove_readonly)
        except Exception as e:
            print(f"shutil.rmtree notice: {e}")

        # 2. If folder still exists (e.g. OneDrive file lock), fallback to Windows force rmdir
        if os.path.exists(target_path):
            try:
                subprocess.run(['cmd', '/c', 'rmdir', '/s', '/q', target_path], capture_output=True, text=True)
            except Exception as e:
                print(f"Windows rmdir fallback notice: {e}")

        return not os.path.exists(target_path)
    else:
        # File deletion
        try:
            os.chmod(target_path, stat.S_IWRITE)
            os.remove(target_path)
        except Exception:
            try:
                subprocess.run(['cmd', '/c', 'del', '/f', '/q', target_path], capture_output=True, text=True)
            except Exception:
                pass
        return not os.path.exists(target_path)

def get_unique_filename(folder, raw_name):
    clean_name = os.path.basename(raw_name)
    clean_name = "".join(c for c in clean_name if c not in '<>:"/\\|?*\x00').strip()
    if not clean_name:
        clean_name = f"file_{int(time.time())}"
        
    filepath = os.path.join(folder, clean_name)
    if not os.path.exists(filepath):
        return clean_name
        
    stem, ext = os.path.splitext(clean_name)
    counter = 1
    while True:
        candidate = f"{stem}({counter}){ext}"
        candidate_path = os.path.join(folder, candidate)
        if not os.path.exists(candidate_path):
            return candidate
        counter += 1

def format_size(size_in_bytes):
    if size_in_bytes < 1024:
        return f"{size_in_bytes} B"
    elif size_in_bytes < 1024 * 1024:
        return f"{size_in_bytes / 1024:.1f} KB"
    elif size_in_bytes < 1024 * 1024 * 1024:
        return f"{size_in_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{size_in_bytes / (1024 * 1024 * 1024):.2f} GB"

def get_file_category(ext):
    ext = ext.lower()
    if ext in IMAGE_EXTENSIONS:
        return 'image'
    elif ext in {'.pdf'}:
        return 'pdf'
    elif ext in {'.mp4', '.mkv', '.mov', '.avi', '.webm'}:
        return 'video'
    elif ext in {'.mp3', '.wav', '.ogg', '.flac', '.m4a'}:
        return 'audio'
    elif ext in {'.zip', '.rar', '.7z', '.tar', '.gz'}:
        return 'archive'
    elif ext in {'.doc', '.docx', '.txt', '.rtf', '.odt', '.md', '.csv', '.xlsx', '.pptx'}:
        return 'document'
    elif ext in {'.py', '.js', '.html', '.css', '.json', '.cpp', '.java', '.c', '.sh', '.bat', '.cmd', '.yaml', '.yml'}:
        return 'code'
    return 'generic'

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/info')
def server_info():
    ip = get_local_ip()
    port = 5000
    local_url = f"http://{ip}:{port}"
    qr_data = generate_qr_code(local_url)
    
    total, used, free = shutil.disk_usage(SHARED_FOLDER)
    
    return jsonify({
        'ip': ip,
        'port': port,
        'url': local_url,
        'qr_code': qr_data,
        'disk_free_formatted': format_size(free),
        'disk_total_formatted': format_size(total)
    })

@app.route('/api/files')
def list_files():
    subpath = request.args.get('subpath', '')
    target_dir, safe_rel, valid = resolve_secure_path(subpath)
    
    if not valid or not os.path.exists(target_dir):
        target_dir = SHARED_FOLDER
        safe_rel = ""
    
    files_list = []
    folders_list = []
    category_counts = {'image': 0, 'video': 0, 'audio': 0, 'document': 0, 'code': 0, 'archive': 0, 'pdf': 0, 'generic': 0, 'folder': 0}
    total_bytes = 0

    try:
        entries = os.scandir(target_dir)
        for entry in entries:
            stat = entry.stat()
            rel_file_path = os.path.join(safe_rel, entry.name).replace('\\', '/') if safe_rel else entry.name
            
            if entry.is_dir():
                item_count = len([f for f in os.listdir(entry.path) if not f.startswith('.')])
                category_counts['folder'] += 1
                folders_list.append({
                    'name': entry.name,
                    'is_dir': True,
                    'item_count': item_count,
                    'mtime': stat.st_mtime,
                    'formatted_time': datetime.fromtimestamp(stat.st_mtime).strftime('%b %d, %I:%M %p'),
                    'path': rel_file_path
                })
            elif entry.is_file():
                ext = os.path.splitext(entry.name)[1].lower()
                is_img = ext in IMAGE_EXTENSIONS
                is_txt = ext in TEXT_EXTENSIONS
                category = get_file_category(ext)
                
                category_counts[category] = category_counts.get(category, 0) + 1
                total_bytes += stat.st_size
                
                files_list.append({
                    'name': entry.name,
                    'is_dir': False,
                    'size': stat.st_size,
                    'formatted_size': format_size(stat.st_size),
                    'mtime': stat.st_mtime,
                    'formatted_time': datetime.fromtimestamp(stat.st_mtime).strftime('%b %d, %I:%M %p'),
                    'category': category,
                    'ext': ext,
                    'is_image': is_img,
                    'is_text': is_txt,
                    'path': rel_file_path,
                    'download_url': f"/download/{rel_file_path}",
                    'preview_url': f"/preview/{rel_file_path}" if is_img else None
                })
        
        folders_list.sort(key=lambda x: x['name'].lower())
        files_list.sort(key=lambda x: x['mtime'], reverse=True)
    except Exception as e:
        print(f"Error listing files: {e}")
        return jsonify({'error': 'Failed to list files'}), 500
        
    return jsonify({
        'current_subpath': safe_rel,
        'folders': folders_list,
        'files': files_list,
        'stats': {
            'total_items': len(folders_list) + len(files_list),
            'total_files': len(files_list),
            'total_folders': len(folders_list),
            'total_bytes': total_bytes,
            'formatted_total_size': format_size(total_bytes),
            'category_counts': category_counts
        }
    })

@app.route('/api/create-folder', methods=['POST'])
def create_folder():
    data = request.get_json(silent=True) or {}
    subpath = data.get('subpath', '')
    folder_name = data.get('folder_name', '').strip()
    
    if not folder_name:
        return jsonify({'error': 'Folder name cannot be empty'}), 400
        
    clean_folder_name = "".join(c for c in folder_name if c not in '<>:"/\\|?*\x00').strip()
    if not clean_folder_name:
        return jsonify({'error': 'Invalid folder name'}), 400
        
    target_dir, safe_rel, valid = resolve_secure_path(subpath)
    if not valid:
        return jsonify({'error': 'Invalid target path'}), 400
        
    new_folder_path = os.path.join(target_dir, clean_folder_name)
    
    if os.path.exists(new_folder_path):
        return jsonify({'error': 'A file or folder with that name already exists'}), 400
        
    try:
        os.makedirs(new_folder_path, exist_ok=True)
        return jsonify({'success': True, 'folder_name': clean_folder_name, 'subpath': safe_rel})
    except Exception as e:
        return jsonify({'error': f'Failed to create folder: {str(e)}'}), 500

@app.route('/api/upload', methods=['POST'])
def upload_files():
    if 'files' not in request.files:
        return jsonify({'error': 'No file part in request'}), 400
        
    subpath = request.form.get('subpath', '')
    target_dir, safe_rel, valid = resolve_secure_path(subpath)
    if not valid or not os.path.exists(target_dir):
        target_dir = SHARED_FOLDER
        
    uploaded_files = request.files.getlist('files')
    if not uploaded_files or all(f.filename == '' for f in uploaded_files):
        return jsonify({'error': 'No selected file'}), 400
        
    results = []
    for file in uploaded_files:
        if file and file.filename != '':
            original_name = os.path.basename(file.filename)
            final_name = get_unique_filename(target_dir, original_name)
            save_path = os.path.join(target_dir, final_name)
            
            file.save(save_path)
            
            was_renamed = (final_name != original_name)
            results.append({
                'original_name': original_name,
                'saved_name': final_name,
                'was_renamed': was_renamed
            })
            
    return jsonify({
        'success': True,
        'uploaded': results
    })

@app.route('/api/share-note', methods=['POST'])
def share_note():
    data = request.get_json(silent=True) or {}
    subpath = data.get('subpath', '')
    target_dir, safe_rel, valid = resolve_secure_path(subpath)
    if not valid:
        target_dir = SHARED_FOLDER
        
    title = data.get('title', '').strip() or 'Quick Note'
    content = data.get('content', '').strip()
    
    if not content:
        return jsonify({'error': 'Note content cannot be empty'}), 400
        
    filename = f"{title}.txt"
    final_name = get_unique_filename(target_dir, filename)
    filepath = os.path.join(target_dir, final_name)
    
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return jsonify({'success': True, 'saved_name': final_name})
    except Exception as e:
        return jsonify({'error': f'Failed to save note: {str(e)}'}), 500

@app.route('/api/file-content/<path:filepath>')
def get_file_content(filepath):
    target_file, rel_path, valid = resolve_secure_path(filepath)
    
    if valid and target_file and os.path.exists(target_file) and os.path.isfile(target_file):
        try:
            stat = os.stat(target_file)
            if stat.st_size > 2 * 1024 * 1024:
                return jsonify({'error': 'File too large for code viewer (max 2MB)'}), 400
                
            with open(target_file, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()
            return jsonify({'name': os.path.basename(target_file), 'content': content, 'size': stat.st_size})
        except Exception as e:
            return jsonify({'error': f'Error reading file: {str(e)}'}), 500
    return jsonify({'error': 'File not found'}), 404

@app.route('/download/<path:filepath>')
def download_file(filepath):
    target_file, rel_path, valid = resolve_secure_path(filepath)
    if valid and target_file and os.path.exists(target_file):
        target_dir = os.path.dirname(target_file)
        filename = os.path.basename(target_file)
        return send_from_directory(target_dir, filename, as_attachment=True)
    abort(404)

@app.route('/preview/<path:filepath>')
def preview_file(filepath):
    target_file, rel_path, valid = resolve_secure_path(filepath)
    if valid and target_file and os.path.exists(target_file):
        target_dir = os.path.dirname(target_file)
        filename = os.path.basename(target_file)
        return send_from_directory(target_dir, filename)
    abort(404)

@app.route('/api/download-zip', methods=['POST'])
def download_zip():
    data = request.get_json(silent=True) or {}
    subpath = data.get('subpath', '')
    selected_files = data.get('files', [])
    target_dir, safe_rel, valid = resolve_secure_path(subpath)
    if not valid:
        target_dir = SHARED_FOLDER
        safe_rel = ""
    
    if not selected_files:
        selected_files = [f for f in os.listdir(target_dir) if os.path.isfile(os.path.join(target_dir, f))]
        
    if not selected_files:
        return jsonify({'error': 'No files available to zip'}), 400

    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
        for item in selected_files:
            item_path, rel_path, item_valid = resolve_secure_path(item)
            if item_valid and item_path and os.path.exists(item_path) and os.path.isfile(item_path):
                zf.write(item_path, arcname=os.path.basename(item_path))

    memory_file.seek(0)
    zip_filename = f"HomeLANShare_{safe_rel.replace('/', '_') or 'Root'}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
    
    return send_file(
        memory_file,
        mimetype='application/zip',
        as_attachment=True,
        download_name=zip_filename
    )

@app.route('/api/delete/<path:filepath>', methods=['POST'])
def delete_item(filepath):
    target_path, rel_path, valid = resolve_secure_path(filepath)
    
    if valid and target_path and os.path.exists(target_path) and target_path != SHARED_FOLDER:
        success = safe_delete_path(target_path)
        if success:
            return jsonify({'success': True, 'path': filepath})
        else:
            return jsonify({'error': f'Permission denied or file locked on Windows: {os.path.basename(target_path)}'}), 500
    return jsonify({'error': 'Item not found or protected'}), 404

@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({'error': 'File exceeds maximum upload limit of 500MB'}), 413

if __name__ == '__main__':
    local_ip = get_local_ip()
    print("=" * 60)
    print("      HOME LAN SHARE - LOCAL NETWORK FILE HUB")
    print("=" * 60)
    print(f" -> Local Laptop URL: http://localhost:5000")
    print(f" -> Wi-Fi Network URL: http://{local_ip}:5000")
    print(f" -> Shared Folder:    {SHARED_FOLDER}")
    print("=" * 60)
    
    app.run(host='0.0.0.0', port=5000, debug=False)

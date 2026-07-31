/**
 * Home LAN Share — Advanced Client Application with Subfolders
 * Supports Live Sync, Folder Navigation, Subfolder Creation, Clipboard Paste (Ctrl+V),
 * Zip Archiving, Media Lightbox, and Disk Space Analytics.
 */

let serverUrl = '';
let currentSubpath = '';
let currentFiles = [];
let currentFolders = [];
let selectedFilenames = new Set();
let activeCategoryFilter = 'all';
let deleteTargetFilename = null;
let soundEnabled = true;
let audioCtx = null;

const FOLDER_ICON = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;

const FILE_ICONS = {
    pdf: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
    video: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`,
    audio: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
    archive: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg>`,
    document: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
    code: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
    generic: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`
};

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initServerInfo();
    setupDragAndDrop();
    setupClipboardPaste();
    fetchFiles();
    
    setInterval(fetchFiles, 2500);
    document.getElementById('qr-wrapper').addEventListener('click', openQrModal);
});

// 1. Theme Switcher
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    setTheme(savedTheme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'light' : 'dark');
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    const darkIcon = document.querySelector('.theme-icon-dark');
    const lightIcon = document.querySelector('.theme-icon-light');
    if (darkIcon && lightIcon) {
        darkIcon.style.display = theme === 'dark' ? 'block' : 'none';
        lightIcon.style.display = theme === 'light' ? 'block' : 'none';
    }
}

// 2. Audio Feedback
function playAudioCue(type) {
    if (!soundEnabled) return;
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        const now = audioCtx.currentTime;
        if (type === 'success') {
            osc.frequency.setValueAtTime(523.25, now);
            osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.1);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
            osc.start(now);
            osc.stop(now + 0.25);
        } else if (type === 'copy') {
            osc.frequency.setValueAtTime(880, now);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
            osc.start(now);
            osc.stop(now + 0.12);
        }
    } catch (e) {}
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    const btn = document.getElementById('btn-sound-toggle');
    btn.style.opacity = soundEnabled ? '1' : '0.4';
    showToast(soundEnabled ? 'Audio feedback enabled' : 'Audio feedback muted', 'info');
}

// 3. Server Info
async function initServerInfo() {
    try {
        const res = await fetch('/api/info');
        if (!res.ok) throw new Error('Info fetch failed');
        const data = await res.json();
        
        serverUrl = data.url;
        document.getElementById('network-url-input').value = data.url;
        
        if (data.disk_free_formatted) {
            document.getElementById('disk-free-badge').textContent = `💾 Free Space: ${data.disk_free_formatted} on Laptop`;
        }

        if (data.qr_code) {
            document.getElementById('qr-image').src = data.qr_code;
            document.getElementById('qr-modal-img').src = data.qr_code;
            document.getElementById('qr-modal-url-text').textContent = data.url;
            document.getElementById('btn-download-qr').href = data.qr_code;
        }
    } catch (err) {
        document.getElementById('network-url-input').value = window.location.origin;
    }
}

// 4. Copy URL
function copyNetworkUrl() {
    const input = document.getElementById('network-url-input');
    const textToCopy = input.value;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textToCopy).then(onCopySuccess).catch(() => fallbackCopy(input));
    } else {
        fallbackCopy(input);
    }
}

function fallbackCopy(input) {
    input.select();
    document.execCommand('copy');
    onCopySuccess();
}

function onCopySuccess() {
    playAudioCue('copy');
    const copyText = document.getElementById('copy-btn-text');
    const originalText = copyText.textContent;
    copyText.textContent = 'Copied!';
    showToast('Network URL copied to clipboard!', 'success');
    
    setTimeout(() => copyText.textContent = originalText, 2000);
}

// 5. Drag and Drop
function setupDragAndDrop() {
    const dropZone = document.getElementById('drop-zone');
    
    ['dragenter', 'dragover'].forEach(name => {
        dropZone.addEventListener(name, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('drag-over');
        });
    });

    ['dragleave', 'drop'].forEach(name => {
        dropZone.addEventListener(name, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('drag-over');
        });
    });

    dropZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            uploadFiles(files);
        }
    });
}

// 6. Ctrl+V Clipboard Listener
function setupClipboardPaste() {
    window.addEventListener('paste', (e) => {
        const clipboardData = e.clipboardData || e.originalEvent.clipboardData;
        if (!clipboardData) return;

        const files = clipboardData.files;
        if (files && files.length > 0) {
            e.preventDefault();
            showToast(`Pasted ${files.length} file(s) from clipboard!`, 'info');
            uploadFiles(files);
        } else {
            const text = clipboardData.getData('text');
            if (text && text.trim().length > 0) {
                const activeTag = document.activeElement ? document.activeElement.tagName : '';
                if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
                    e.preventDefault();
                    document.getElementById('note-content-input').value = text;
                    openNotesPad();
                    showToast('Pasted text into Quick Note pad!', 'info');
                }
            }
        }
    });
}

function handleFileSelect(e) {
    const files = e.target.files;
    if (files && files.length > 0) {
        uploadFiles(files);
    }
    e.target.value = '';
}

// 7. Uploading Files to Active Subfolder
function uploadFiles(filesList) {
    const files = Array.from(filesList);
    const MAX_SIZE = 500 * 1024 * 1024;
    
    files.forEach(file => {
        if (file.size > MAX_SIZE) {
            showToast(`File "${file.name}" exceeds 500MB limit`, 'danger');
            return;
        }
        uploadSingleFile(file);
    });
}

function uploadSingleFile(file) {
    const container = document.getElementById('progress-container');
    const id = 'prog-' + Math.random().toString(36).substr(2, 9);
    
    const item = document.createElement('div');
    item.className = 'progress-item';
    item.id = id;
    item.innerHTML = `
        <div class="progress-header">
            <span class="progress-filename" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
            <span class="progress-status" id="status-${id}">0%</span>
        </div>
        <div class="progress-bar-bg">
            <div class="progress-bar-fill" id="bar-${id}"></div>
        </div>
    `;
    container.prepend(item);

    const formData = new FormData();
    formData.append('files', file);
    formData.append('subpath', currentSubpath);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload', true);

    xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            const bar = document.getElementById(`bar-${id}`);
            const status = document.getElementById(`status-${id}`);
            if (bar) bar.style.width = `${pct}%`;
            if (status) status.textContent = `${pct}%`;
        }
    };

    xhr.onload = () => {
        if (xhr.status === 200) {
            try {
                const res = JSON.parse(xhr.responseText);
                playAudioCue('success');
                
                const status = document.getElementById(`status-${id}`);
                if (status) status.textContent = 'Completed ✓';

                if (res.uploaded && res.uploaded.length > 0) {
                    const info = res.uploaded[0];
                    if (info.was_renamed) {
                        showToast(`Uploaded as "${info.saved_name}" to avoid overwrite`, 'info');
                    } else {
                        showToast(`Uploaded "${info.saved_name}" successfully`, 'success');
                    }
                }
                setTimeout(() => item.remove(), 2200);
                fetchFiles();
            } catch (err) {
                showToast(`Upload failed for ${file.name}`, 'danger');
            }
        } else {
            showToast(`Upload failed for ${file.name}`, 'danger');
            item.remove();
        }
    };

    xhr.onerror = () => {
        showToast(`Network error uploading ${file.name}`, 'danger');
        item.remove();
    };

    xhr.send(formData);
}

// 8. Create Subfolder
function openCreateFolderModal() {
    document.getElementById('new-folder-name-input').value = '';
    document.getElementById('folder-modal').style.display = 'flex';
    setTimeout(() => document.getElementById('new-folder-name-input').focus(), 100);
}

function closeCreateFolderModal(e) {
    if (!e || e.target === document.getElementById('folder-modal') || e.target.classList.contains('modal-close') || e.target.classList.contains('btn-secondary')) {
        document.getElementById('folder-modal').style.display = 'none';
    }
}

async function submitCreateFolder() {
    const folderName = document.getElementById('new-folder-name-input').value.trim();
    if (!folderName) {
        showToast('Please enter a folder name', 'danger');
        return;
    }

    try {
        const res = await fetch('/api/create-folder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subpath: currentSubpath, folder_name: folderName })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            playAudioCue('success');
            showToast(`Folder "${data.folder_name}" created!`, 'success');
            closeCreateFolderModal();
            fetchFiles();
        } else {
            showToast(data.error || 'Failed to create folder', 'danger');
        }
    } catch (err) {
        showToast('Server error creating folder', 'danger');
    }
}

// 9. Subfolder Navigation & Breadcrumbs
function navigateToFolder(subpath) {
    currentSubpath = subpath;
    selectedFilenames.clear();
    updateBatchBar();
    fetchFiles();
}

function renderBreadcrumbs() {
    const container = document.getElementById('breadcrumbs-bar');
    const targetSubtext = document.getElementById('upload-target-subtext');
    
    targetSubtext.textContent = `Uploading to: SharedFiles / ${currentSubpath}`;

    const parts = currentSubpath.split('/').filter(p => p);
    let html = `<span class="crumb-item ${parts.length === 0 ? 'active' : ''}" onclick="navigateToFolder('')">📁 SharedFiles</span>`;
    
    let accumulatedPath = '';
    parts.forEach((part, index) => {
        accumulatedPath += (accumulatedPath ? '/' : '') + part;
        const isLast = index === parts.length - 1;
        const clickPath = accumulatedPath;
        
        html += `<span class="crumb-separator">/</span>`;
        html += `<span class="crumb-item ${isLast ? 'active' : ''}" onclick="${isLast ? '' : `navigateToFolder('${escapeJsString(clickPath)}')`}">${escapeHtml(part)}</span>`;
    });

    container.innerHTML = html;
}

// 10. Quick Shared Notes Pad
function toggleNotesPad() {
    const body = document.getElementById('notes-pad-body');
    const arrow = document.getElementById('notes-toggle-arrow');
    const isHidden = body.style.display === 'none';
    body.style.display = isHidden ? 'flex' : 'none';
    arrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
}

function openNotesPad() {
    const body = document.getElementById('notes-pad-body');
    const arrow = document.getElementById('notes-toggle-arrow');
    body.style.display = 'flex';
    arrow.style.transform = 'rotate(180deg)';
}

async function submitQuickNote() {
    const title = document.getElementById('note-title-input').value.trim();
    const content = document.getElementById('note-content-input').value.trim();

    if (!content) {
        showToast('Please type some text before sharing', 'danger');
        return;
    }

    try {
        const res = await fetch('/api/share-note', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subpath: currentSubpath, title, content })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            playAudioCue('success');
            showToast(`Shared note "${data.saved_name}"`, 'success');
            document.getElementById('note-title-input').value = '';
            document.getElementById('note-content-input').value = '';
            toggleNotesPad();
            fetchFiles();
        } else {
            showToast(data.error || 'Failed to save note', 'danger');
        }
    } catch (err) {
        showToast('Server error saving note', 'danger');
    }
}

// 11. Fetch & Render Files
async function fetchFiles() {
    try {
        const res = await fetch(`/api/files?subpath=${encodeURIComponent(currentSubpath)}`);
        if (!res.ok) return;
        const data = await res.json();
        
        currentSubpath = data.current_subpath || '';
        currentFiles = data.files || [];
        currentFolders = data.folders || [];
        
        renderBreadcrumbs();
        updateStorageAnalytics(data.stats);
        renderFilesList();
    } catch (err) {
        console.error('Fetch error:', err);
    }
}

function updateStorageAnalytics(stats) {
    if (!stats) return;
    const summary = document.getElementById('analytics-summary');
    summary.textContent = `${stats.formatted_total_size} used across ${stats.total_files} file(s) and ${stats.total_folders} folder(s)`;

    const total = stats.total_items || 1;
    const counts = stats.category_counts || {};

    document.getElementById('bar-cat-image').style.width = `${((counts.image || 0) / total) * 100}%`;
    document.getElementById('bar-cat-document').style.width = `${(((counts.document || 0) + (counts.pdf || 0)) / total) * 100}%`;
    document.getElementById('bar-cat-video').style.width = `${(((counts.video || 0) + (counts.audio || 0)) / total) * 100}%`;
    document.getElementById('bar-cat-code').style.width = `${((counts.code || 0) / total) * 100}%`;
    document.getElementById('bar-cat-other').style.width = `${(((counts.archive || 0) + (counts.generic || 0) + (counts.folder || 0)) / total) * 100}%`;
}

function setCategoryFilter(category) {
    activeCategoryFilter = category;
    document.querySelectorAll('.filter-tabs .tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-category') === category);
    });
    renderFilesList();
}

function renderFilesList() {
    const grid = document.getElementById('files-grid');
    const emptyState = document.getElementById('empty-state');
    const countBadge = document.getElementById('file-count');
    const searchVal = document.getElementById('file-search-input').value.toLowerCase().trim();
    const sortVal = document.getElementById('sort-select').value;

    let folders = [...currentFolders];
    let files = [...currentFiles];

    if (activeCategoryFilter === 'folder') {
        files = [];
    } else if (activeCategoryFilter !== 'all') {
        folders = [];
        files = files.filter(f => {
            if (activeCategoryFilter === 'video') return f.category === 'video' || f.category === 'audio';
            if (activeCategoryFilter === 'document') return f.category === 'document' || f.category === 'pdf';
            return f.category === activeCategoryFilter;
        });
    }

    if (searchVal) {
        folders = folders.filter(f => f.name.toLowerCase().includes(searchVal));
        files = files.filter(f => f.name.toLowerCase().includes(searchVal));
    }

    if (sortVal === 'oldest') files.sort((a, b) => a.mtime - b.mtime);
    else if (sortVal === 'name') {
        files.sort((a, b) => a.name.localeCompare(b.name));
        folders.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortVal === 'size') files.sort((a, b) => b.size - a.size);
    else files.sort((a, b) => b.mtime - a.mtime);

    const totalCount = folders.length + files.length;
    countBadge.textContent = `${totalCount} item${totalCount === 1 ? '' : 's'}`;

    if (totalCount === 0) {
        grid.innerHTML = '';
        emptyState.style.display = 'flex';
        return;
    }
    emptyState.style.display = 'none';

    let html = '';

    // Render Subfolders first
    folders.forEach(folder => {
        html += `
            <div class="file-card folder-card">
                <div class="file-card-top">
                    <div class="file-thumb folder-thumb-icon" onclick="navigateToFolder('${escapeJsString(folder.path)}')">
                        ${FOLDER_ICON}
                    </div>
                    <div class="file-meta">
                        <span class="file-name" onclick="navigateToFolder('${escapeJsString(folder.path)}')" title="${escapeHtml(folder.name)}">📁 ${escapeHtml(folder.name)}</span>
                        <span class="file-subtext">${folder.item_count} item${folder.item_count === 1 ? '' : 's'} • ${folder.formatted_time}</span>
                    </div>
                </div>
                <div class="file-actions">
                    <button class="btn btn-primary" onclick="navigateToFolder('${escapeJsString(folder.path)}')">
                        Open Folder
                    </button>
                    <button class="btn btn-secondary btn-icon-only" title="Delete Folder" onclick="promptDelete('${escapeJsString(folder.path)}', true)">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            </div>
        `;
    });

    // Render Files
    files.forEach(file => {
        const isChecked = selectedFilenames.has(file.path);
        const iconSvg = FILE_ICONS[file.category] || FILE_ICONS.generic;
        const thumbContent = file.is_image
            ? `<img src="${file.preview_url}" alt="${escapeHtml(file.name)}" class="file-thumb-img" loading="lazy">`
            : iconSvg;

        html += `
            <div class="file-card ${isChecked ? 'selected' : ''}">
                <div class="file-card-top">
                    <input type="checkbox" class="file-select-check" ${isChecked ? 'checked' : ''} onchange="toggleSelectFile('${escapeJsString(file.path)}', this.checked)">
                    <div class="file-thumb" onclick="openFilePreview('${escapeJsString(file.path)}')">
                        ${thumbContent}
                    </div>
                    <div class="file-meta">
                        <span class="file-name" onclick="openFilePreview('${escapeJsString(file.path)}')" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
                        <span class="file-subtext">${file.formatted_size} • ${file.formatted_time}</span>
                    </div>
                </div>
                <div class="file-actions">
                    <a href="${file.download_url}" download class="btn btn-primary">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Download
                    </a>
                    <button class="btn btn-secondary btn-icon-only" title="Delete File" onclick="promptDelete('${escapeJsString(file.path)}', false)">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            </div>
        `;
    });

    grid.innerHTML = html;
}

// 12. Batch Selection
function toggleSelectFile(filePath, isChecked) {
    if (isChecked) selectedFilenames.add(filePath);
    else selectedFilenames.delete(filePath);
    updateBatchBar();
}

function toggleSelectAll(checkbox) {
    if (checkbox.checked) {
        currentFiles.forEach(f => selectedFilenames.add(f.path));
    } else {
        selectedFilenames.clear();
    }
    updateBatchBar();
    renderFilesList();
}

function updateBatchBar() {
    const batchBar = document.getElementById('batch-bar');
    const selectedCount = document.getElementById('selected-count');
    
    if (selectedFilenames.size > 0) {
        batchBar.style.display = 'flex';
        selectedCount.textContent = `${selectedFilenames.size} item${selectedFilenames.size === 1 ? '' : 's'} selected`;
    } else {
        batchBar.style.display = 'none';
    }
}

// 13. Zip Batch Download
async function downloadSelectedZip() {
    if (selectedFilenames.size === 0) return;
    triggerZipDownload(Array.from(selectedFilenames));
}

async function downloadAllZip() {
    triggerZipDownload([]);
}

async function triggerZipDownload(fileList) {
    showToast('Generating ZIP archive...', 'info');
    try {
        const res = await fetch('/api/download-zip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subpath: currentSubpath, files: fileList })
        });
        if (!res.ok) throw new Error('Zip failed');
        
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `HomeLANShare_Files.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast('Downloaded ZIP archive!', 'success');
    } catch (err) {
        showToast('Error generating ZIP file', 'danger');
    }
}

// 14. Preview Modals
function openFilePreview(filePath) {
    const file = currentFiles.find(f => f.path === filePath);
    if (!file) return;

    if (file.is_image) {
        document.getElementById('media-modal-title').textContent = file.name;
        document.getElementById('media-preview-container').innerHTML = `<img src="${file.preview_url}" alt="${escapeHtml(file.name)}">`;
        document.getElementById('media-download-link').href = file.download_url;
        document.getElementById('media-modal').style.display = 'flex';
    } else if (file.category === 'video') {
        document.getElementById('media-modal-title').textContent = file.name;
        document.getElementById('media-preview-container').innerHTML = `<video src="${file.download_url}" controls autoplay></video>`;
        document.getElementById('media-download-link').href = file.download_url;
        document.getElementById('media-modal').style.display = 'flex';
    } else if (file.category === 'audio') {
        document.getElementById('media-modal-title').textContent = file.name;
        document.getElementById('media-preview-container').innerHTML = `<audio src="${file.download_url}" controls autoplay></audio>`;
        document.getElementById('media-download-link').href = file.download_url;
        document.getElementById('media-modal').style.display = 'flex';
    } else if (file.is_text || file.category === 'code') {
        openCodeViewer(filePath);
    } else {
        window.location.href = file.download_url;
    }
}

async function openCodeViewer(filePath) {
    try {
        const safePath = filePath.split('/').map(p => encodeURIComponent(p)).join('/');
        const res = await fetch(`/api/file-content/${safePath}`);
        const data = await res.json();
        
        if (res.ok && data.content !== undefined) {
            document.getElementById('code-modal-title').textContent = data.name;
            document.getElementById('code-viewer-body').textContent = data.content;
            document.getElementById('code-download-link').href = `/download/${safePath}`;
            document.getElementById('code-modal').style.display = 'flex';
        } else {
            showToast(data.error || 'Cannot view file content', 'danger');
        }
    } catch (err) {
        showToast('Error loading file content', 'danger');
    }
}

function copyCodeContent() {
    const text = document.getElementById('code-viewer-body').textContent;
    navigator.clipboard.writeText(text).then(() => {
        playAudioCue('copy');
        showToast('Code copied to clipboard!', 'success');
    });
}

function closeMediaModal(e) {
    if (!e || e.target === document.getElementById('media-modal') || e.target.classList.contains('modal-close')) {
        document.getElementById('media-modal').style.display = 'none';
        document.getElementById('media-preview-container').innerHTML = '';
    }
}

function closeCodeModal(e) {
    if (!e || e.target === document.getElementById('code-modal') || e.target.classList.contains('modal-close')) {
        document.getElementById('code-modal').style.display = 'none';
    }
}

// 15. Delete Prompt
function promptDelete(filePath, isDir) {
    deleteTargetFilename = filePath;
    const name = filePath.split('/').pop();
    document.getElementById('delete-modal-text').innerHTML = `Are you sure you want to delete ${isDir ? 'folder' : 'file'} <strong>"${escapeHtml(name)}"</strong>?${isDir ? ' All files inside will be deleted.' : ''}`;
    document.getElementById('delete-modal').style.display = 'flex';
    document.getElementById('btn-confirm-delete').onclick = () => confirmDelete();
}

async function confirmDelete() {
    if (!deleteTargetFilename) return;
    try {
        const safePath = deleteTargetFilename.split('/').map(p => encodeURIComponent(p)).join('/');
        const res = await fetch(`/api/delete/${safePath}`, { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.success) {
            showToast(`Deleted successfully`, 'info');
            closeDeleteModal();
            fetchFiles();
        } else {
            showToast(data.error || 'Failed to delete', 'danger');
        }
    } catch (err) {
        showToast('Server error deleting', 'danger');
    }
}

function closeDeleteModal(e) {
    if (!e || e.target === document.getElementById('delete-modal') || e.target.classList.contains('modal-close') || e.target.classList.contains('btn-secondary')) {
        document.getElementById('delete-modal').style.display = 'none';
        deleteTargetFilename = null;
    }
}

// 16. QR Modal
function openQrModal() {
    document.getElementById('qr-modal').style.display = 'flex';
}

function closeQrModal(e) {
    if (!e || e.target === document.getElementById('qr-modal') || e.target.classList.contains('modal-close')) {
        document.getElementById('qr-modal').style.display = 'none';
    }
}

// 17. Toast System
function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconSvg = '';
    if (type === 'success') {
        iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
    } else if (type === 'danger') {
        iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    } else {
        iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    }

    toast.innerHTML = `${iconSvg} <span>${escapeHtml(msg)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        toast.style.transition = 'all 0.25s ease';
        setTimeout(() => toast.remove(), 250);
    }, 3200);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function escapeJsString(str) {
    if (!str) return '';
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

# Security Policy & Architecture Blueprint 🛡️

Airbase is designed with a **privacy-first, local-only security architecture**.

## Security Model

1. **Local Network Isolation**:
   - Airbase runs exclusively on your local area network (LAN).
   - No external cloud servers, relay nodes, or third-party telemetries are used.
   - Files are stored directly in your local `SharedFiles/` directory on your hard drive.

2. **Directory Traversal Protection**:
   - Every file API endpoint validates paths using `resolve_secure_path()`.
   - Access attempts containing `../` or attempting to break out of `SharedFiles/` are rejected with `403 Forbidden`.

3. **File Lock Safety**:
   - File deletions use Windows read-only attribute stripping (`stat.S_IWRITE`) and `onerror` exception handling to safely resolve locks from OneDrive or background indexers.

## Reporting Vulnerabilities

If you discover a security issue or vulnerability in Airbase:
- Please open an issue on GitHub or contact the maintainers directly.
- We aim to address security reports within 24 hours.

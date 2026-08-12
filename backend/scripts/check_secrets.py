import os
import sys
import re
from pathlib import Path

# High-risk secret regex patterns
PATTERNS = [
    (r'gsk_[a-zA-Z0-9]{40,}', 'Groq API Key'),
    (r'AC[a-f0-9]{32}', 'Twilio Account SID'),
    (r'SK[a-f0-9]{32}', 'Twilio API Secret'),
    (r'SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}', 'SendGrid API Key'),
    (r'AIzaSy[a-zA-Z0-9_-]{33}', 'Google API Key'),
]

# Paths to ignore during pre-commit scan
IGNORE_DIRS = {'.git', 'node_modules', '__pycache__', '.pytest_cache', 'uploads', 'dist'}
IGNORE_FILES = {'.env', '.env.local', 'check_secrets.py'}

def scan_secrets(root_dir: Path) -> bool:
    found_secret = False
    for path in root_dir.rglob('*'):
        if path.is_file():
            # Check ignored directories/files
            if any(part in IGNORE_DIRS for part in path.parts):
                continue
            if path.name in IGNORE_FILES:
                continue
            if path.suffix in ['.pyc', '.png', '.jpg', '.jpeg', '.mp4', '.mp3', '.zip', '.db']:
                continue
                
            try:
                content = path.read_text(encoding='utf-8', errors='ignore')
                for pattern, name in PATTERNS:
                    matches = re.findall(pattern, content)
                    if matches:
                        print(f"[BLOCKED] SECRET EXPOSURE: Found {name} in {path}")
                        found_secret = True
            except Exception as e:
                pass

    return found_secret

if __name__ == '__main__':
    project_root = Path(__file__).resolve().parent.parent.parent
    print(f"[SecretScanner] Scanning repository at {project_root}...")
    if scan_secrets(project_root):
        print("[ERROR] Live secret keys detected in tracked codebase files! Commit rejected.")
        sys.exit(1)
    else:
        print("[SUCCESS] Pre-commit check passed: No exposed secret keys detected.")
        sys.exit(0)

import os

MAX_FILES_PER_DIR = 2  # You can change this
BASE_PATH = '.'        # Start from current directory

def print_tree(path, prefix=''):
    try:
        entries = sorted(os.listdir(path))
    except PermissionError:
        print(f"{prefix}└── [Permission Denied]")
        return

    dirs = [e for e in entries if os.path.isdir(os.path.join(path, e))]
    files = [e for e in entries if os.path.isfile(os.path.join(path, e))]

    total_entries = len(dirs) + min(len(files), MAX_FILES_PER_DIR)
    for idx, entry in enumerate(dirs + files[:MAX_FILES_PER_DIR]):
        is_last = idx == total_entries - 1
        connector = "└── " if is_last else "├── "
        print(f"{prefix}{connector}{entry}")
        full_path = os.path.join(path, entry)
        if os.path.isdir(full_path):
            new_prefix = prefix + ("    " if is_last else "│   ")
            print_tree(full_path, new_prefix)

print(BASE_PATH)
print_tree(BASE_PATH)


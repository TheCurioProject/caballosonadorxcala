import os
import re

directory = '/Users/macmini1tb/Desktop/hotelsonador/src'
exclude_files = [
    'Navigation.tsx',
    'layout.tsx' # Exclude admin layout (header/menu)
]
exclude_dirs = [
    '/components/ui/' # Exclude all UI components as requested
]

def process_file(filepath):
    filename = os.path.basename(filepath)
    if filename in exclude_files:
        return
    for ed in exclude_dirs:
        if ed in filepath.replace('\\', '/'):
            return
            
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        original = content
        
        # Replace text-sm -> text-base md:text-sm
        content = re.sub(r'(?<![:\w\-])text-sm\b', 'text-base md:text-sm', content)
        
        # Replace text-xs -> text-sm md:text-xs
        content = re.sub(r'(?<![:\w\-])text-xs\b', 'text-sm md:text-xs', content)
        
        if content != original:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Updated {filepath}")
    except Exception as e:
        print(f"Error processing {filepath}: {e}")

if __name__ == '__main__':
    print("Starting typography update...")
    count = 0
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.tsx') or file.endswith('.ts'):
                process_file(os.path.join(root, file))
                count += 1
    print(f"Finished checking {count} files.")

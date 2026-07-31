import os
import re

directory = '/Users/macmini1tb/Desktop/hotelsonador/src'
exclude_files = [
    'Navigation.tsx',
    'layout.tsx' # Exclude admin layout (header/menu)
]
exclude_dirs = [
    '/components/ui/' # Exclude all UI components
]

def responsive_bump(match):
    full_match = match.group(0)
    
    # Mapping for exact compound classes
    compounds = {
        "text-sm md:text-xs": "text-sm md:text-base",
        "text-base md:text-sm": "text-base md:text-lg",
        "text-base md:text-lg": "text-lg md:text-xl",
        "text-lg md:text-xl": "text-xl md:text-2xl",
    }
    if full_match in compounds:
        return compounds[full_match]
    
    # Mapping for single classes
    singles = {
        "text-base": "text-lg md:text-xl",
        "text-lg": "text-xl md:text-2xl"
    }
    if full_match in singles:
        return singles[full_match]
        
    return full_match

# Regex to match either a compound class or a single class
pattern = re.compile(r'(?<![:\w\-])(?:text-(?:xs|sm|base|lg|xl)\s+md:text-(?:xs|sm|base|lg|xl)|text-(?:base|lg)\b(?!\s+md:text-))')

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
        
        # Apply the simultaneous exact regex replacement
        content = pattern.sub(responsive_bump, content)
        
        if content != original:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Updated {filepath}")
    except Exception as e:
        print(f"Error processing {filepath}: {e}")

if __name__ == '__main__':
    print("Starting typography update v2 (Full Responsive Mapping)...")
    count = 0
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.tsx') or file.endswith('.ts'):
                process_file(os.path.join(root, file))
                count += 1
    print(f"Finished checking {count} files.")

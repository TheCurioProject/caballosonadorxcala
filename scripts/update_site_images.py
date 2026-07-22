import json
import re

def update_site_images():
    with open('cloudinary_mapping.json', 'r') as f:
        mappings = json.load(f)
        
    with open('src/lib/siteImages.ts', 'r') as f:
        content = f.read()
        
    for local_path, cloud_url in mappings.items():
        # Replace instances of url: '/some/local/path' with url: 'https://...'
        # We need to be careful with quotes
        pattern = r"url:\s*['\"]" + re.escape(local_path) + r"['\"]"
        replacement = f"url: '{cloud_url}'"
        content = re.sub(pattern, replacement, content)
        
    with open('src/lib/siteImages.ts', 'w') as f:
        f.write(content)
        print("Updated siteImages.ts")

if __name__ == '__main__':
    update_site_images()

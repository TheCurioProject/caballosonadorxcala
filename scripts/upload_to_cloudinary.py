import os
import time
import hashlib
import subprocess
import json

cloud_name = 'p6nhvksw'
api_key = '472136528885595'
api_secret = 'cw5aAUdInsciv3OMSsX21QSSYKw'

def generate_signature(params_to_sign):
    sorted_params = sorted(params_to_sign.items())
    query_string = '&'.join([f"{k}={v}" for k, v in sorted_params])
    string_to_sign = query_string + api_secret
    return hashlib.sha1(string_to_sign.encode('utf-8')).hexdigest()

def upload_file(file_path):
    # relative path inside public, e.g. 'imagenes/02_hero/hero_01_img_4885.webp'
    rel_path = os.path.relpath(file_path, 'public')
    # public_id removes extension and prepends 'hotelsonador/'
    public_id = 'hotelsonador/' + os.path.splitext(rel_path)[0]

    timestamp = str(int(time.time()))
    
    params_to_sign = {
        'public_id': public_id,
        'overwrite': 'true',
        'timestamp': timestamp,
    }
    
    signature = generate_signature(params_to_sign)
    
    cmd = [
        'curl', '-s', '-X', 'POST',
        f'https://api.cloudinary.com/v1_1/{cloud_name}/image/upload',
        '-F', f'file=@{file_path}',
        '-F', f'api_key={api_key}',
        '-F', f'timestamp={timestamp}',
        '-F', f'public_id={public_id}',
        '-F', 'overwrite=true',
        '-F', f'signature={signature}'
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    try:
        response = json.loads(result.stdout)
        if 'secure_url' in response:
            return public_id, response['secure_url']
        else:
            print(f"Error uploading {file_path}: {response}")
            return None, None
    except Exception as e:
        print(f"Failed to parse response for {file_path}: {e}")
        return None, None

def main():
    if not os.path.exists('public'):
        print("public directory not found")
        return

    supported_exts = ('.webp', '.png', '.jpg', '.jpeg', '.JPG', '.PNG')
    
    mappings = {}
    count = 0
    
    for root, _, files in os.walk('public'):
        for file in files:
            if file.endswith(supported_exts):
                file_path = os.path.join(root, file)
                print(f"Uploading {file_path}...")
                public_id, secure_url = upload_file(file_path)
                if secure_url:
                    # Keep original rel path with starting slash as key
                    rel_key = '/' + os.path.relpath(file_path, 'public')
                    mappings[rel_key] = secure_url
                    count += 1
                    print(f"  Success -> {secure_url}")
                time.sleep(0.1) # Small delay to avoid rate limits

    with open('cloudinary_mapping.json', 'w') as f:
        json.dump(mappings, f, indent=2)
        
    print(f"Successfully uploaded {count} images. Mapping saved to cloudinary_mapping.json")

if __name__ == '__main__':
    main()

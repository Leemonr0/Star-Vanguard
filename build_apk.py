import os
import io
import sys
import shutil
import zipfile
import subprocess
import urllib.request
from PIL import Image

def build():
    print("========================================")
    print("   STAR VANGUARD - ANDROID APK BUILDER  ")
    print("========================================")

    base_apk = "base_template.apk"
    if not os.path.exists(base_apk):
        print("[1/6] Downloading clean WebView APK template...")
        url = "https://github.com/hookhonan/sudoku-pure/releases/download/v2.0/sudoku-pure.apk"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=20) as resp, open(base_apk, 'wb') as f:
            f.write(resp.read())
        print(f"      Downloaded {base_apk} ({os.path.getsize(base_apk)} bytes)")
    else:
        print(f"[1/6] Found cached {base_apk}")

    print("[2/6] Loading APK structure & preparing assets...")
    zf_in = zipfile.ZipFile(base_apk, 'r')
    manifest = bytearray(zf_in.read('AndroidManifest.xml'))
    arsc = bytearray(zf_in.read('resources.arsc'))

    # 1. Patch screenOrientation in AndroidManifest.xml:
    # 0x01 = SCREEN_ORIENTATION_PORTRAIT -> 0x04 = SCREEN_ORIENTATION_SENSOR (auto-rotates freely)
    target_attr = bytes([0x1d, 0x00, 0x00, 0x00, 0x05, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff, 0x08, 0x00, 0x00, 0x10, 0x01, 0x00, 0x00, 0x00])
    idx = manifest.find(target_attr)
    if idx != -1:
        manifest[idx + 16] = 0x04 # SCREEN_ORIENTATION_SENSOR
        print("      Patched AndroidManifest.xml: screenOrientation -> SENSOR (supports landscape & portrait)")
    else:
        print("      Note: screenOrientation attribute already modified or not found")

    # Patch targetSdkVersion to 28 (0x1c) so all Android versions allow v1 jarsigner installation
    target_sdk_attr = bytes([0x1d, 0x00, 0x00, 0x00, 0x0a, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff, 0x08, 0x00, 0x00, 0x10, 0x22, 0x00, 0x00, 0x00])
    idx_sdk = manifest.find(target_sdk_attr)
    if idx_sdk != -1:
        manifest[idx_sdk + 16] = 0x1c # targetSdkVersion 28
        print("      Patched AndroidManifest.xml: targetSdkVersion -> 28 (universal Android install compatibility)")
    else:
        print("      Note: targetSdkVersion already patched")

    # 2. Patch app_name in resources.arsc
    old_str = b'\x0e\x12\xe6\x95\xb0\xe7\x8b\xac Sudoku Pure\x00'
    new_str = b'\x11\x11Star Vanguard 360\x00\x00'
    arsc_idx = arsc.find(old_str)
    if arsc_idx != -1:
        arsc[arsc_idx:arsc_idx + len(old_str)] = new_str
        print("      Patched resources.arsc: app name -> 'Star Vanguard 360'")
    else:
        print("      Note: resources.arsc app name already updated")

    # 3. Generate icon variations for Android launcher
    print("[3/6] Generating Android mipmap launcher icons...")
    icon_src = "icon-512.png"
    if not os.path.exists(icon_src):
        # Fallback if not yet created
        img = Image.new('RGBA', (512, 512), (0, 240, 255, 255))
        img.save(icon_src)

    base_img = Image.open(icon_src).convert('RGBA')
    icon_sizes = {
        'res/mipmap-mdpi-v4/ic_launcher.png': (48, 48),
        'res/mipmap-mdpi-v4/ic_launcher_round.png': (48, 48),
        'res/mipmap-hdpi-v4/ic_launcher.png': (72, 72),
        'res/mipmap-hdpi-v4/ic_launcher_round.png': (72, 72),
        'res/mipmap-xhdpi-v4/ic_launcher.png': (96, 96),
        'res/mipmap-xhdpi-v4/ic_launcher_round.png': (96, 96),
        'res/mipmap-xxhdpi-v4/ic_launcher.png': (144, 144),
        'res/mipmap-xxhdpi-v4/ic_launcher_round.png': (144, 144),
        'res/mipmap-xxxhdpi-v4/ic_launcher.png': (192, 192),
        'res/mipmap-xxxhdpi-v4/ic_launcher_round.png': (192, 192),
    }

    icon_bytes_map = {}
    for path, sz in icon_sizes.items():
        resized = base_img.resize(sz, Image.Resampling.LANCZOS)
        buf = io.BytesIO()
        resized.save(buf, format='PNG')
        icon_bytes_map[path] = buf.getvalue()

    # 4. Assemble unsigned APK
    unsigned_apk = "StarVanguard-unsigned.apk"
    print(f"[4/6] Packaging game files into {unsigned_apk}...")

    # Files to put in assets/
    game_files = [
        "index.html",
        "styles.css",
        "game.js",
        "audio.js",
        "manifest.json",
        "icon-192.png",
        "icon-512.png"
    ]

    with zipfile.ZipFile(unsigned_apk, 'w', zipfile.ZIP_DEFLATED) as zf_out:
        # Copy original APK entries (excluding old signatures, modified manifest/arsc, old icons, old assets)
        for item in zf_in.infolist():
            fn = item.filename
            if fn.startswith('META-INF/'):
                continue # Strip old signature
            if fn.startswith('assets/'):
                continue # Replace with our game assets
            if fn in icon_bytes_map:
                continue # Replace with our custom icons

            if fn == 'AndroidManifest.xml':
                zf_out.writestr(item, manifest)
            elif fn == 'resources.arsc':
                zf_out.writestr(item, arsc)
            else:
                zf_out.writestr(item, zf_in.read(fn))

        # Add custom launcher icons
        for icon_path, icon_data in icon_bytes_map.items():
            zf_out.writestr(icon_path, icon_data)

        # Add game assets
        for gf in game_files:
            if os.path.exists(gf):
                with open(gf, 'rb') as f:
                    content = f.read()
                # Place at assets/<filename>
                target_path = f"assets/{gf}"
                zf_out.writestr(target_path, content)
                print(f"      + Added {target_path} ({len(content)} bytes)")
            else:
                print(f"      ! Warning: missing {gf}")

    zf_in.close()

    # 5. Sign APK using jarsigner
    output_apk = "StarVanguard.apk"
    keystore = "release.keystore"
    keytool_exe = r"C:\Program Files\Java\jdk-21\bin\keytool.exe"
    jarsigner_exe = r"C:\Program Files\Java\jdk-21\bin\jarsigner.exe"

    if not os.path.exists(keytool_exe) or not os.path.exists(jarsigner_exe):
        # Check in PATH
        keytool_exe = shutil.which("keytool") or keytool_exe
        jarsigner_exe = shutil.which("jarsigner") or jarsigner_exe

    print("[5/6] Signing APK with Java release keystore...")
    if not os.path.exists(keystore):
        print("      Generating release keystore...")
        cmd_gen = [
            keytool_exe, "-genkey", "-v",
            "-keystore", keystore,
            "-alias", "star_vanguard",
            "-keyalg", "RSA",
            "-keysize", "2048",
            "-validity", "10000",
            "-storepass", "space123456",
            "-keypass", "space123456",
            "-dname", "CN=StarVanguard, OU=Galaxy, O=StarGames, L=Orbit, S=Cosmos, C=RU"
        ]
        res = subprocess.run(cmd_gen, capture_output=True, text=True)
        if res.returncode != 0:
            print("      Keytool error:", res.stderr)

    # Sign the APK
    cmd_sign = [
        jarsigner_exe,
        "-keystore", keystore,
        "-storepass", "space123456",
        "-keypass", "space123456",
        "-signedjar", output_apk,
        unsigned_apk,
        "star_vanguard"
    ]
    res_sign = subprocess.run(cmd_sign, capture_output=True, text=True)
    if res_sign.returncode != 0:
        print("      Jarsigner error:", res_sign.stderr)
        return False

    # 6. Verify signature
    print("[6/6] Verifying signed APK...")
    cmd_verify = [jarsigner_exe, "-verify", output_apk]
    res_ver = subprocess.run(cmd_verify, capture_output=True, text=True)
    if "jar verified" in res_ver.stdout:
        print("      [SUCCESS] APK signature verified successfully!")
    else:
        print("      Verification output:", res_ver.stdout)

    # Clean up intermediate unsigned file
    if os.path.exists(unsigned_apk):
        os.remove(unsigned_apk)

    # Also create a ZIP package for messengers that restrict .apk extensions
    zip_apk = "StarVanguard_APK.zip"
    with zipfile.ZipFile(zip_apk, 'w', zipfile.ZIP_DEFLATED) as zf_zip:
        zf_zip.write(output_apk, arcname="StarVanguard.apk")
    print(f"      Created {zip_apk} (for Telegram / WhatsApp if .apk is restricted)")

    size_kb = os.path.getsize(output_apk) / 1024
    print("========================================")
    print(f" BUILD COMPLETE: {output_apk} ({size_kb:.1f} KB)")
    print(f" ZIP ARCHIVE:    {zip_apk}")
    print(" Ready to install on Android devices!")
    print("========================================")
    return True

if __name__ == '__main__':
    build()

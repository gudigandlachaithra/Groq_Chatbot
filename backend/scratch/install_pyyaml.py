import urllib.request
import json
import tarfile
import os
import subprocess
import sys

def main():
    print("Fetching PyYAML details from PyPI...")
    try:
        response = urllib.request.urlopen("https://pypi.org/pypi/pyyaml/json")
        data = json.loads(response.read().decode())
    except Exception as e:
        print(f"Error fetching metadata: {e}")
        sys.exit(1)

    # Get the source release (.tar.gz) URL for the current latest version (or 6.0.2/6.0.3)
    releases = data.get("releases", {})
    version = data.get("info", {}).get("version", "6.0.3")
    
    # We target 6.0.2 or 6.0.3 specifically, but fallback to whatever is current
    version_releases = releases.get(version, [])
    source_url = None
    for release in version_releases:
        if release.get("packagetype") == "sdist":
            source_url = release.get("url")
            break

    if not source_url:
        # Hardcode fallback URL if json schema is unexpected
        source_url = f"https://files.pythonhosted.org/packages/49/a0/ad9ee0d11c1dfb9fc1dc109f2b8423450e189283e7428f522851ee8e7456/PyYAML-6.0.3.tar.gz"
        version = "6.0.3"

    print(f"Downloading PyYAML {version} from {source_url}...")
    tar_filename = "pyyaml.tar.gz"
    try:
        urllib.request.urlretrieve(source_url, tar_filename)
        print("Download complete.")
    except Exception as e:
        print(f"Error downloading: {e}")
        sys.exit(1)

    print("Extracting archive...")
    extracted_dir = None
    try:
        with tarfile.open(tar_filename, "r:gz") as tar:
            tar.extractall()
            # Find the directory name
            for member in tar.getmembers():
                if member.isdir():
                    extracted_dir = member.name.split('/')[0]
                    break
        if not extracted_dir:
            extracted_dir = f"PyYAML-{version}"
        print(f"Extracted to {extracted_dir}")
    except Exception as e:
        print(f"Error extracting: {e}")
        sys.exit(1)

    # Now execute setup.py --without-libyaml install in virtualenv python
    venv_python = os.path.abspath(os.path.join("..", "..", ".venv", "Scripts", "python.exe"))
    if not os.path.exists(venv_python):
        # try fallback path
        venv_python = os.path.abspath(os.path.join(".venv", "Scripts", "python.exe"))
    
    print(f"Running setup.py in {extracted_dir} using {venv_python}...")
    try:
        # Run install command without libyaml
        subprocess.run(
            [venv_python, "setup.py", "--without-libyaml", "install"],
            cwd=extracted_dir,
            check=True
        )
        print("PyYAML installed successfully without libyaml compiler extensions!")
    except Exception as e:
        print(f"Error installing PyYAML: {e}")
        sys.exit(1)

    # Cleanup downloaded files
    try:
        os.remove(tar_filename)
        # optional: remove extracted folder
        import shutil
        shutil.rmtree(extracted_dir)
        print("Cleaned up download directories.")
    except Exception as e:
        print(f"Warning during cleanup: {e}")

if __name__ == "__main__":
    main()

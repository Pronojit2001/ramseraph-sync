import os
import sys
import urllib.request
import urllib.parse
import json
import subprocess
import shutil
import stat
import argparse
import base64

def load_env():
    """Load environment variables from a local .env file if it exists."""
    if os.path.exists('.env'):
        with open('.env', 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    key, _, val = line.partition('=')
                    os.environ[key.strip()] = val.strip()

def remove_readonly(func, path, excinfo):
    """OnError handler for shutil.rmtree to remove read-only attributes on Windows."""
    os.chmod(path, stat.S_IWRITE)
    func(path)

def make_request(url, token=None, method='GET', data=None):
    """Utility to make GitHub API requests using standard library urllib."""
    headers = {
        'User-Agent': 'GitHub-Profile-Sync-Script',
        'Accept': 'application/vnd.github.v3+json'
    }
    if token:
        headers['Authorization'] = f'token {token}'
    
    req_data = None
    if data is not None:
        req_data = json.dumps(data).encode('utf-8')
        headers['Content-Type'] = 'application/json'
        
    req = urllib.request.Request(url, headers=headers, method=method, data=req_data)
    try:
        with urllib.request.urlopen(req) as response:
            return response.status, json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        err_content = ""
        try:
            err_content = e.read().decode('utf-8')
        except Exception:
            pass
        return e.code, err_content
    except Exception as e:
        return 500, str(e)

def fetch_source_repos(source_user, token=None):
    """Retrieve all public repositories for the source user."""
    print(f"Fetching public repositories for user '{source_user}'...")
    repos = []
    page = 1
    while True:
        url = f"https://api.github.com/users/{source_user}/repos?per_page=100&page={page}"
        status, data = make_request(url, token=token)
        if status != 200:
            print(f"Error fetching source repos: {data} (status {status})")
            sys.exit(1)
        if not data:
            break
        repos.extend(data)
        if len(data) < 100:
            break
        page += 1
    return repos

def repo_exists_in_target(target_user, repo_name, token):
    """Check if repository exists on the target user's account."""
    url = f"https://api.github.com/repos/{target_user}/{repo_name}"
    status, _ = make_request(url, token=token)
    return status == 200

def create_target_repo(repo_name, description, token):
    """Create a new public repository on the authenticated user's account."""
    url = "https://api.github.com/user/repos"
    payload = {
        "name": repo_name,
        "description": description or f"Mirrored repository from ramSeraph/{repo_name}",
        "private": False,
        "has_issues": True,
        "has_projects": True,
        "has_wiki": True
    }
    status, response = make_request(url, token=token, method='POST', data=payload)
    if status in (200, 201):
        print(f"Successfully created target repository: {repo_name}")
        return True
    else:
        print(f"Failed to create target repository '{repo_name}': {response} (status {status})")
        return False

def sync_repository(source_clone_url, target_push_url, repo_name, dry_run=False):
    """Sync a repository by mirror cloning it and pushing it to the target."""
    temp_dir = f"temp_sync_{repo_name}"
    
    if dry_run:
        print(f"[DRY-RUN] Would mirror clone from {source_clone_url} and push to target.")
        return True

    # 1. Clean up any existing temp directory
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir, onerror=remove_readonly)
        
    try:
        print(f"Mirror cloning {repo_name}...")
        # Mirror clone fetches all branches, tags, and commit history
        subprocess.run(["git", "clone", "--mirror", source_clone_url, temp_dir], check=True)
        
        print(f"Pushing mirror to target repository for {repo_name}...")
        # Push mirror pushes all branches, tags, and commits to target
        subprocess.run(["git", "push", "--mirror", target_push_url], cwd=temp_dir, check=True)
        print(f"Sync complete for {repo_name}!")
        return True
    except FileNotFoundError:
        print(f"Warning: Git is not installed locally. Skipping repository mirroring for '{repo_name}'.")
        print("Note: The repository will still be indexed in the profile catalog.")
        return True
    except subprocess.CalledProcessError as e:
        print(f"Git operation failed for {repo_name}: {e}")
        return False
    finally:
        # Clean up local clone
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, onerror=remove_readonly)

def fetch_releases(source_user, repo_name, token=None):
    """Fetch all releases and their assets for a repository."""
    url = f"https://api.github.com/repos/{source_user}/{repo_name}/releases"
    status, releases = make_request(url, token=token)
    if status == 200:
        return releases
    return []

def upload_file_to_repo(username, token, repo, path, content, commit_message):
    """Upload or update a file in a repository using the GitHub API."""
    url = f"https://api.github.com/repos/{username}/{repo}/contents/{path}"
    
    # Check if file exists to get SHA
    check_status, check_resp = make_request(url, token)
    sha = None
    if check_status == 200:
        sha = check_resp.get("sha")
        
    content_base64 = base64.b64encode(content.encode('utf-8')).decode('utf-8')
    payload = {
        "message": commit_message,
        "content": content_base64
    }
    if sha:
        payload["sha"] = sha
        
    status, response = make_request(url, token, method='PUT', data=payload)
    if status in (200, 201):
        print(f"Successfully uploaded {path} to {repo}.")
        return True
    else:
        print(f"Failed to upload {path} to {repo}: {response} (status {status})")
        return False

def generate_and_upload_catalog(target_user, target_token, repos):
    """Generates the main profile README, individual repository catalogs, and search database, then uploads them."""
    print("\nGenerating Data Catalog Portal and Index...")
    
    # 1. Fetch all releases and build data_index_list
    data_index_list = []
    for idx, r in enumerate(repos, 1):
        name = r['name']
        desc = r['description'] or ""
        html_url = r['html_url']
        
        print(f"Indexing releases for [{idx}/{len(repos)}] '{name}'...")
        releases = fetch_releases("ramSeraph", name, token=target_token)
        
        assets_list = []
        for rel in releases:
            rel_name = rel['name'] or rel['tag_name']
            for asset in rel.get('assets', []):
                assets_list.append({
                    'name': asset['name'],
                    'size': asset['size'],
                    'download_url': asset['browser_download_url'],
                    'release_name': rel_name
                })
        
        data_index_list.append({
            'name': name,
            'description': desc,
            'html_url': html_url,
            'assets': assets_list,
            'releases_count': len(releases)
        })
        
    # Inject local converted shapefiles if they exist (or statically define them)
    local_shapefiles_entry = {
        "name": "local_converted_shapefiles",
        "description": "User-supplied Indian administrative boundaries (States, Districts, Blocks) converted from binary UTM Zone 44N Shapefiles into web-optimized, reprojected WGS84 GeoJSON geometries.",
        "html_url": "local",
        "assets": [
            {
                "name": "India_State_Boundaries.geojson",
                "size": 2368407,
                "download_url": "shapefiles/India_State_Boundaries.geojson",
                "release_name": "Local Conversion"
            },
            {
                "name": "India_District_boundaries.geojson",
                "size": 5472851,
                "download_url": "shapefiles/India_District_boundaries.geojson",
                "release_name": "Local Conversion"
            },
            {
                "name": "India_district_Block_boundaries.geojson",
                "size": 16641865,
                "download_url": "shapefiles/India_district_Block_boundaries.geojson",
                "release_name": "Local Conversion"
            }
        ],
        "releases_count": 1
    }
    # Dynamically update sizes if files are present locally
    for asset in local_shapefiles_entry["assets"]:
        local_path = os.path.join("shapefiles", asset["name"])
        if os.path.exists(local_path):
            asset["size"] = os.path.getsize(local_path)
            
    data_index_list.append(local_shapefiles_entry)
        
    # Write search index locally for offline/testing purposes
    local_index_path = 'data_index.json'
    try:
        with open(local_index_path, 'w', encoding='utf-8') as f:
            json.dump(data_index_list, f, indent=2)
        print(f"Saved local search index database to {local_index_path}")
    except Exception as e:
        print(f"Failed to write local data_index.json: {e}")
        
    # Upload data_index.json to the sync repository (ramseraph-sync) so the web app can fetch it
    print("Uploading search index to ramseraph-sync...")
    upload_file_to_repo(
        target_user, target_token, "ramseraph-sync", "data_index.json", 
        json.dumps(data_index_list, indent=2), "Update data search index"
    )

    # 2. Categories definition for README structure
    categories = {
        "India Spatial & Topographical Maps": [
            "india_topo_maps", "american_world_topo_maps", "russian_world_topo_maps"
        ],
        "India Building Footprints": [
            "indian_buildings", "google_buildings_india", "ms_buildings_india", "essd_copernicus_building_heights_india"
        ],
        "India GIS & Boundary Datasets": [
            "indian_admin_boundaries", "indian_land_features", "indian_water_features", 
            "indian_railways", "indian_transport", "indian_power_infra", "indian_cadastrals", 
            "overture_places_india", "local_converted_shapefiles"
        ],
        "India Open Data Scrapers & Archives": [
            "opendata", "indian_gazettes", "india-environmental-approvals", 
            "india_natural_disasters", "indian_facilities", "indian_communications"
        ],
        "Neighboring Countries Maps": [
            "myanmar_survey_maps", "nepal_survey_maps"
        ],
        "GIS Software & Tools": [
            "captchabreaker", "duckdb-wasm", "josm-gcs-imagery-enabler", "josm-webp-plugin", 
            "nisaba", "nisaba-tools"
        ]
    }
    
    # Map index items for easy lookup
    indexed_map = {item['name']: item for item in data_index_list}
    
    categorized_repos = {cat: [] for cat in categories}
    uncategorized_repos = []
    
    for item in data_index_list:
        name = item['name']
        found = False
        for cat, list_repos in categories.items():
            if name in list_repos:
                categorized_repos[cat].append(item)
                found = True
                break
        if not found:
            uncategorized_repos.append(item)
            
    if uncategorized_repos:
        categorized_repos["Other Tools & Repositories"] = uncategorized_repos

    # Ensure target Profile repository exists (TARGET_USER/TARGET_USER)
    profile_repo = target_user
    profile_repo_url = f"https://api.github.com/repos/{target_user}/{profile_repo}"
    status, _ = make_request(profile_repo_url, target_token)
    
    if status == 404:
        print(f"Profile repository '{profile_repo}' does not exist. Creating it...")
        create_url = "https://api.github.com/user/repos"
        payload = {
            "name": profile_repo,
            "description": "My GitHub Profile README and Data Portal Catalog",
            "private": False,
            "auto_init": True
        }
        create_status, create_resp = make_request(create_url, target_token, method='POST', data=payload)
        if create_status not in (200, 201):
            print(f"Failed to create Profile README repo: {create_resp}")
            sys.exit(1)
        print("Created Profile README repository.")
        
    # Start building the main README.md
    readme_content = f"""# Pronojit2001 - GIS & Map Datasets Portal

Welcome to my profile! This page hosts an automated, indexed catalog of open-source geospatial data, topo maps, and building footprint datasets mirrored from **[ramSeraph](https://github.com/ramSeraph)**.

Explore the interactive search dashboard here:
👉 **[Geodemia AI Web Application](https://{target_user}.github.io/ramseraph-sync/)**

> [!NOTE]
> This portal indexes over **700 GB** of open-source geospatial datasets. Since the raw files are extremely large, they are indexed here with direct download links from the original sources.

---

## 🗺️ Dataset Catalog

"""
    
    # Process each category for README
    for cat_name, cat_items in categorized_repos.items():
        if not cat_items:
            continue
            
        readme_content += f"### {cat_name}\n\n"
        
        for item in cat_items:
            name = item['name']
            desc = item['description'] or "*No description available.*"
            all_assets = item['assets']
            releases_count = item['releases_count']
            
            readme_content += f"#### [{name}](https://github.com/{target_user}/{name})\n"
            readme_content += f"{desc}\n\n"
            
            if releases_count == 0:
                readme_content += "*No releases/data files available in this repository.*\n\n"
                continue
                
            if not all_assets:
                readme_content += "*No downloadable data files in releases.*\n\n"
                continue
                
            readme_content += f"📦 **Total Data Files**: {len(all_assets)} | **Total Releases**: {releases_count}\n\n"
            
            # If assets count <= 15, list them directly in a neat table
            if len(all_assets) <= 15:
                readme_content += "| File Name | Size | Release | Download Link |\n"
                readme_content += "| --- | --- | --- | --- |\n"
                for asset in all_assets:
                    size_mb = asset['size'] / (1024 * 1024)
                    size_str = f"{size_mb:.2f} MB" if size_mb < 1024 else f"{(size_mb/1024):.2f} GB"
                    readme_content += f"| `{asset['name']}` | {size_str} | {asset['release_name']} | [Download]({asset['download_url']}) |\n"
                readme_content += "\n"
            else:
                # If too many assets, create a sub-catalog file and link to it
                sub_catalog_path = f"catalogs/{name}.md"
                sub_catalog_content = f"# {name} - Data Catalog\n\n"
                sub_catalog_content += f"Below is the complete file index for the **[{name}](https://github.com/{target_user}/{name})** repository.\n\n"
                sub_catalog_content += f"**Total Files**: {len(all_assets)}\n\n"
                sub_catalog_content += "| File Name | Size | Release | Download Link |\n"
                sub_catalog_content += "| --- | --- | --- | --- |\n"
                for asset in all_assets:
                    size_mb = asset['size'] / (1024 * 1024)
                    size_str = f"{size_mb:.2f} MB" if size_mb < 1024 else f"{(size_mb/1024):.2f} GB"
                    sub_catalog_content += f"| `{asset['name']}` | {size_str} | {asset['release_name']} | [Download]({asset['download_url']}) |\n"
                
                # Upload sub-catalog
                upload_file_to_repo(target_user, target_token, profile_repo, sub_catalog_path, sub_catalog_content, f"Update catalog index for {name}")
                
                readme_content += f"🔗 **[View Complete File Index ({len(all_assets)} files)](catalogs/{name}.md)**\n\n"
                
        readme_content += "---\n\n"
        
    readme_content += """
*This catalog is automatically updated daily via GitHub Actions.*
"""
    
    # Upload main profile README
    upload_file_to_repo(target_user, target_token, profile_repo, "README.md", readme_content, "Update Profile README with Datasets Catalog")
    print("Catalog portal sync completed!")

def main():
    parser = argparse.ArgumentParser(description="Mirror GitHub repositories from a source user to target user and create a profile catalog.")
    parser.add_argument("--dry-run", action="store_true", help="Perform API checks and local file generation without pushing to GitHub.")
    parser.add_argument("--single", help="Sync only a single repository by name (useful for testing).")
    args = parser.parse_args()

    load_env()
    
    source_user = "ramSeraph"
    target_user = os.environ.get("TARGET_GITHUB_USERNAME")
    target_token = os.environ.get("TARGET_GITHUB_TOKEN")
    
    if not target_user or not target_token:
        print("Error: TARGET_GITHUB_USERNAME and TARGET_GITHUB_TOKEN environment variables must be set.")
        print("Please read the instructions in the implementation_plan.md to set them.")
        sys.exit(1)

    print(f"Target GitHub User: {target_user}")
    
    repos = fetch_source_repos(source_user, token=target_token)
    print(f"Total source repositories found: {len(repos)}")

    if args.single:
        repos = [r for r in repos if r['name'].lower() == args.single.lower()]
        if not repos:
            print(f"Error: Single repository '{args.single}' not found in source list.")
            sys.exit(1)
        print(f"Filtering to single repository: {repos[0]['name']}")

    success_count = 0
    fail_count = 0

    # 1. Mirror the code repositories (Skip if single catalog-only is run or just loop)
    for idx, repo in enumerate(repos, 1):
        repo_name = repo['name']
        source_clone_url = repo['clone_url']
        description = repo['description']
        
        target_push_url = f"https://{target_token}@github.com/{target_user}/{repo_name}.git"
        
        print(f"\n[{idx}/{len(repos)}] Processing '{repo_name}'...")
        
        # Check if repo exists on target
        exists = repo_exists_in_target(target_user, repo_name, target_token)
        
        if not exists:
            print(f"Repository '{repo_name}' does not exist on target account.")
            if args.dry_run:
                print(f"[DRY-RUN] Would create repository '{repo_name}'")
                success_count += 1
                continue
            else:
                created = create_target_repo(repo_name, description, target_token)
                if not created:
                    fail_count += 1
                    continue
        else:
            print(f"Repository '{repo_name}' already exists on target account.")

        # Sync code (clone and push)
        success = sync_repository(source_clone_url, target_push_url, repo_name, dry_run=args.dry_run)
        if success:
            success_count += 1
        else:
            fail_count += 1

    print("\n" + "="*40)
    print("Git Repositories Sync Summary:")
    print(f"  Total processed: {len(repos)}")
    print(f"  Successfully synced: {success_count}")
    print(f"  Failed: {fail_count}")
    print("="*40)

    # 2. Build and upload the Data Catalog Portal (only if not syncing single repo)
    if not args.single:
        if args.dry_run:
            print("\n[DRY-RUN] Skipping Profile Catalog generation and upload.")
        else:
            generate_and_upload_catalog(target_user, target_token, repos)

if __name__ == "__main__":
    main()

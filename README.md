# ramSeraph Repository Sync Manager

This repository automates the process of mirroring all public repositories from the GitHub profile [ramSeraph](https://github.com/ramSeraph) to your target GitHub profile.

## How It Works
- A GitHub Actions workflow (`.github/workflows/sync.yml`) runs on a daily schedule (or can be triggered manually).
- It runs the `sync.py` script, which:
  1. Queries the GitHub API for all public repositories of `ramSeraph`.
  2. Checks if each repository exists on your profile.
  3. If a repository is missing, it creates it automatically.
  4. Performs a mirror clone of the source repository and pushes it to your repository.

## Setup Requirements

For the workflow to authenticate and create/push repositories, you must configure two Repository Secrets:
1. Go to your repository settings: **Settings** > **Secrets and variables** > **Actions**.
2. Click **New repository secret**.
3. Create the following secrets:
   - `TARGET_GITHUB_USERNAME`: Your target GitHub username.
   - `TARGET_GITHUB_TOKEN`: Your GitHub Personal Access Token (PAT) with `repo` scope.

## How to Trigger Sync Manually
1. Go to the **Actions** tab of this repository.
2. Select **Daily Profile Sync** in the left sidebar.
3. Click the **Run workflow** dropdown on the right side and click **Run workflow**.

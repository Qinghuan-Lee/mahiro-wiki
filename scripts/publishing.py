"""Publish article changes through the repository's existing Git credentials."""

import subprocess
from pathlib import PurePosixPath

from build import POST_ID, ROOT, collect_posts


def git(*args, timeout=15):
    result = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
        check=False,
    )
    if result.returncode:
        raise ValueError(result.stderr.strip() or result.stdout.strip() or "Git 命令执行失败")
    return result.stdout.strip("\n")


def article_changes():
    tracked = git("diff", "--name-only", "--no-renames", "-z", "HEAD", "--", "posts/").split("\0")
    untracked = git("ls-files", "--others", "--exclude-standard", "-z", "--", "posts/").split("\0")
    changes = {}
    for name in tracked + untracked:
        path = PurePosixPath(name)
        if path.parent != PurePosixPath("posts") or path.suffix != ".md" or not POST_ID.fullmatch(path.stem):
            continue
        article = ROOT / path
        # A plain Markdown file stays local until saved with article metadata.
        if name in untracked and article.is_file():
            if not article.read_text(encoding="utf-8-sig").startswith("---\n"):
                continue
        changes[name] = "changed" if article.exists() else "deleted"
    return changes


def pending_commits():
    return int(git("rev-list", "--count", "origin/main..HEAD"))


def publish():
    if git("branch", "--show-current") != "main":
        raise ValueError("请切换到 main 分支后发布")
    changes = article_changes()
    ahead = pending_commits()
    if not changes and not ahead:
        return "没有待发布的文章改动。"

    collect_posts()
    added_or_modified = [name for name, status in changes.items() if status == "changed"]
    if added_or_modified:
        git("add", "--intent-to-add", "--", *added_or_modified)
    if changes:
        git("commit", "--only", "-m", "Update published articles", "--", *changes)

    try:
        git("push", "origin", "HEAD:main", timeout=90)
    except (ValueError, subprocess.TimeoutExpired) as error:
        reason = "连接 GitHub 超时" if isinstance(error, subprocess.TimeoutExpired) else str(error)
        raise ValueError(f"文章提交已保存在本地。修复以下问题后，可以再次点击发布。\n{reason}") from error
    return "已推送到 GitHub。可在 Actions 查看上线进度。"

#!/usr/bin/env python3
"""Build the file scope and review prompt for the simplify skill."""

from __future__ import annotations

import argparse
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


STATUS_MAP = {
    "M": "modified",
    "A": "added",
    "R": "renamed",
    "C": "copied",
}


@dataclass(frozen=True)
class ChangedFile:
    path: str
    status: str


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Print the simplify review scope and prompt.",
    )
    parser.add_argument(
        "--staged",
        action="store_true",
        help="Inspect only staged changes.",
    )
    parser.add_argument(
        "--ref",
        default="HEAD",
        help="Git ref to diff against when --staged is not set.",
    )
    parser.add_argument(
        "--cwd",
        default=".",
        help="Repository directory. Defaults to the current directory.",
    )
    parser.add_argument(
        "files",
        nargs="*",
        help="Explicit files to review.",
    )
    return parser.parse_args(argv)


def run_git(cwd: Path, args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *args],
        cwd=cwd,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def parse_diff_output(stdout: str) -> list[ChangedFile]:
    files: list[ChangedFile] = []
    for line in stdout.splitlines():
        if not line.strip():
            continue
        parts = line.split("\t")
        status_code = parts[0][0] if parts and parts[0] else ""
        status = STATUS_MAP.get(status_code)
        if not status:
            continue
        path_index = 2 if status in {"renamed", "copied"} else 1
        if len(parts) > path_index and parts[path_index]:
            files.append(ChangedFile(path=parts[path_index], status=status))
    return files


def get_changed_files(cwd: Path, staged: bool, ref: str, files: list[str]) -> list[ChangedFile]:
    if files:
        return [ChangedFile(path=file, status="modified") for file in files]

    args = ["diff", "--name-status"]
    if staged:
        args.append("--cached")
    else:
        args.append(ref)

    result = run_git(cwd, args)
    if result.returncode == 0:
        changed = parse_diff_output(result.stdout)
        if changed:
            return changed

    fallback = run_git(cwd, ["diff", "--name-status", "HEAD~1"])
    if fallback.returncode == 0:
        return parse_diff_output(fallback.stdout)

    return []


def build_prompt(files: list[ChangedFile]) -> str:
    file_list = "\n".join(f"- {file.path} ({file.status})" for file in files)
    return f"""Review the following recently changed files and apply simplification improvements.

## Principles

- **Preserve functionality**: Never change what the code does. All existing tests must continue to pass.
- **Apply project standards**: Follow any conventions from CLAUDE.md or AGENTS.md in this project.
- **Enhance clarity**: Reduce unnecessary complexity and nesting, eliminate redundant code and abstractions, improve variable and function names, consolidate related logic, remove unnecessary comments that describe obvious code. Avoid nested ternary operators: prefer switch statements or if/else chains for multiple conditions.
- **Maintain balance**: Do not over-simplify. Avoid overly clever solutions that are hard to understand. Do not combine too many concerns into single functions. Do not remove helpful abstractions. Prioritize readability over fewer lines.

## Scope

Only review and modify these files:
{file_list}

## Process

1. Read each file listed above
2. Identify concrete improvements (dead code, unclear names, redundant logic, inconsistent patterns)
3. Apply changes one file at a time
4. After all changes, run existing tests to verify nothing is broken
5. Summarize what you changed and why

Do NOT add new features, change public APIs, or refactor code outside the listed files."""


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    cwd = Path(args.cwd).expanduser().resolve()
    changed_files = get_changed_files(cwd, args.staged, args.ref, args.files)

    if not changed_files:
        print("No changed files found. Specify file paths or make some changes first.")
        return 1

    print(build_prompt(changed_files))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

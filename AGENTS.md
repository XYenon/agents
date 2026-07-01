# Global Agent Guidelines

- **Tool Use**:
  - Parallelize independent reads and searches when they are already needed, especially with commands such as `cat`, `rg`, `sed`, `ls`, `nl`, and `wc`. Use parallelism to reduce latency, not to widen exploration.
  - When searching for text or files, prefer using `rg` or `rg --files` respectively because `rg` is much faster than alternatives like `grep`. (If the `rg` command is not found, then use alternatives.)
- **Data Processing**: Use the `jq` tool when processing JSON files, and the `yq` tool when processing YAML files.
- **Dependency Management**: If you need to execute software that is not installed in the current environment, use `nix-shell -p <package> --run "<command>"` to temporarily introduce the dependency and execute a single command (supports multiple packages, e.g., `-p pkg1 pkg2`).
- **Commit Messages**: When writing a commit message, follow the exact formatting conventions and patterns used in the existing commit history of the project or file.
- **Remote Publishing**: Unless the user explicitly requests it, do not push code, do not open or comment on pull requests or issues, and do not send anything to any code hosting platform (including but not limited to GitHub, GitLab, Codebase, and any internal platforms). This applies to git push, gh pr create, gh issue create, gh pr comment, and any equivalent operations.

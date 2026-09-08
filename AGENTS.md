# Global Agent Guidelines

- **Tool Use**:
  - When searching for text or files, prefer using `rg` or `rg --files` respectively because `rg` is much faster than alternatives like `grep`. (If the `rg` command is not found, then use alternatives.)
  - When searching for files, prefer using `fd` instead of `find` because `fd` is faster and has a simpler interface. (If the `fd` command is not found, then use alternatives.)
  - Do not run broad searches over huge roots such as the whole filesystem (`/`), the entire `$HOME`, or all of `/nix/store`. Scope searches to the relevant project or directory instead.
- **Data Processing**: When processing structured data or configuration files (JSON, YAML, TOML, XML, CSV, etc.), prefer format-aware tools (e.g., `jq` for JSON, `yq` for YAML/XML, `taplo` for TOML) over manual text manipulation whenever possible.
- **Dependency Management**: If you need to execute software that is not installed in the current environment, use `nix shell nixpkgs#<package> --command <command>` to temporarily introduce the dependency and execute a single command (supports multiple packages, e.g., `nix shell nixpkgs#pkg1 nixpkgs#pkg2 --command <command>`).
- **Commit Messages**: When writing a commit message, follow the exact formatting conventions and patterns used in the existing commit history of the project or file.
- **Remote Publishing**: Unless the user explicitly requests it, do not push code, do not open or comment on pull requests or issues, and do not send anything to any code hosting platform (including but not limited to GitHub, GitLab, Codebase, and any internal platforms). This applies to git push, gh pr create, gh issue create, gh pr comment, and any equivalent operations.

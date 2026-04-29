# Global Agent Guidelines

- **Data Processing**: Use the `jq` tool when processing JSON files, and the `yq` tool when processing YAML files.
- **Dependency Management**: If you need to execute software that is not installed in the current environment, use `nix-shell -p <package> --run "<command>"` to temporarily introduce the dependency and execute a single command (supports multiple packages, e.g., `-p pkg1 pkg2`).
- **Commit Messages**: When writing a commit message, follow the exact formatting conventions and patterns used in the existing commit history of the project or file.

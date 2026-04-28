# agents

A generic collection of capabilities and skills designed for AI agents. These skills empower AI assistants with advanced tools for terminal interaction, web search, and more, independent of any specific agent framework.

## Skills

* **`kitty`**: Instructions and tools for using the kitty terminal's remote control feature. Allows AI agents to spawn background windows/tabs, manage concurrent processes (like dev servers, watchers, or long builds), send text commands, and inspect terminal output.
* **`searxng-search`**: Search the web using a self-hosted SearXNG instance via its API. Supports advanced filtering including categories, specific search engines, time ranges, and language preferences.

## Usage

These skills are designed to be framework-agnostic. You can integrate them into your preferred AI agent framework, custom CLI tools, or personal assistant setups by providing the agent with access to the respective `SKILL.md` instructions and any associated scripts.

## License

This project is licensed under the GNU Affero General Public License Version 3 (AGPL-3.0). See the [LICENSE](./LICENSE) file for more details.

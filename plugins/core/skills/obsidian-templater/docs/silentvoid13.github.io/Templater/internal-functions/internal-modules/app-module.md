---
title: "tp.app - Templater"
source_url: "https://silentvoid13.github.io/Templater/internal-functions/internal-modules/app-module"
fetched_at: "2026-01-28T13:51:35.698401+00:00"
---



# [App Module](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/app-module.html#app-module)

This module exposes the app instance. Prefer to use this over the global app instance.

This is mostly useful when writing scripts.

Refer to the Obsidian [developer documentation](https://docs.obsidian.md/Reference/TypeScript+API/App) for more information.

## [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/app-module.html#examples)

```
// Get all folders
<%
tp.app.vault.getAllLoadedFiles()
  .filter(x => x instanceof tp.obsidian.TFolder)
  .map(x => x.name)
%>

// Update frontmatter of existing file
<%*
const file = tp.file.find_tfile("path/to/file");
await tp.app.fileManager.processFrontMatter(file, (frontmatter) => {
  frontmatter["key"] = "value";
});
%>
```

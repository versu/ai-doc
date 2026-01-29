---
title: "tp.obsidian - Templater"
source_url: "https://silentvoid13.github.io/Templater/internal-functions/internal-modules/obsidian-module"
fetched_at: "2026-01-28T13:51:35.698401+00:00"
---



# [Obsidian Module](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/obsidian-module.html#obsidian-module)

This module exposes all the functions and classes from the Obsidian API.

This is mostly useful when writing scripts.

Refer to the Obsidian API [declaration file](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts) for more information.

## [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/obsidian-module.html#examples)

```
// Get all folders
<%
tp.app.vault.getAllLoadedFiles()
  .filter(x => x instanceof tp.obsidian.TFolder)
  .map(x => x.name)
%>

// Normalize path
<% tp.obsidian.normalizePath("Path/to/file.md") %>

// Html to markdown
<% tp.obsidian.htmlToMarkdown("\<h1>Heading\</h1>\<p>Paragraph\</p>") %>

// HTTP request
<%*
const response = await tp.obsidian.requestUrl("https://jsonplaceholder.typicode.com/todos/1");
tR += response.json.title;
%>
```

---
title: "tp.hooks - Templater"
source_url: "https://silentvoid13.github.io/Templater/internal-functions/internal-modules/hooks-module"
fetched_at: "2026-01-28T13:51:35.698401+00:00"
---



# [Hooks Module](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/hooks-module.html#hooks-module)

This module exposes hooks that allow you to execute code when a Templater event occurs.

* [Documentation](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/hooks-module.html#documentation)
  + [`tp.hooks.on_all_templates_executed(callback_function: () => any)`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/hooks-module.html#tphookson_all_templates_executedcallback_function---any)
* [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/hooks-module.html#examples)

## [Documentation](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/hooks-module.html#documentation)

Function documentation is using a specific syntax. More information [here](https://silentvoid13.github.io/Templater/syntax.html#function-documentation-syntax).

### [`tp.hooks.on_all_templates_executed(callback_function: () => any)`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/hooks-module.html#tphookson_all_templates_executedcallback_function---any)

Hooks into when all actively running templates have finished executing. Most of the time this will be a single template, unless you are using `tp.file.include` or `tp.file.create_new`.

Multiple invokations of this method will have their callback functions run in parallel.

##### [Arguments](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/hooks-module.html#arguments)

* `callback_function`: Callback function that will be executed when all actively running templates have finished executing.

## [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/hooks-module.html#examples)

```
// Update frontmatter after template finishes executing
<%*
tp.hooks.on_all_templates_executed(async () => {
  const file = tp.file.find_tfile(tp.file.path(true));
  await tp.app.fileManager.processFrontMatter(file, (frontmatter) => {
    frontmatter["key"] = "value";
  });
});
%>
// Run a command from another plugin that modifies the current file, after Templater has updated the file
<%*
tp.hooks.on_all_templates_executed(() => {
  tp.app.commands.executeCommandById("obsidian-linter:lint-file");
});
-%>
```

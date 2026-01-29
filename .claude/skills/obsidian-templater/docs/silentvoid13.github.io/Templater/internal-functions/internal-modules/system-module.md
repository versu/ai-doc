---
title: "tp.system - Templater"
source_url: "https://silentvoid13.github.io/Templater/internal-functions/internal-modules/system-module"
fetched_at: "2026-01-28T13:51:35.698401+00:00"
---



# [System Module](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/system-module.html#system-module)

This module contains system related functions.

* [Documentation](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/system-module.html#documentation)
  + [`tp.system.clipboard()`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/system-module.html#tpsystemclipboard)
  + [`tp.system.multi_suggester(text_items: string[] ⎮ ((item: T) => string), items: T[], throw_on_cancel: boolean = false, title: string = "", limit?: number = undefined)`](system-module.html#tpsystemmulti_suggestertext_items-string--item-t--string-items-t-throw_on_cancel-boolean--false-title-string---limit-number--undefined)
  + [`tp.system.prompt(prompt_text?: string, default_value?: string, throw_on_cancel: boolean = false, multiline?: boolean = false)`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/system-module.html#tpsystempromptprompt_text-string-default_value-string-throw_on_cancel-boolean--false-multiline-boolean--false)
  + [`tp.system.suggester(text_items: string[] ⎮ ((item: T) => string), items: T[], throw_on_cancel: boolean = false, placeholder: string = "", limit?: number = undefined)`](system-module.html#tpsystemsuggestertext_items-string--item-t--string-items-t-throw_on_cancel-boolean--false-placeholder-string---limit-number--undefined)
* [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/system-module.html#examples-4)

## [Documentation](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/system-module.html#documentation)

Function documentation is using a specific syntax. More information [here](https://silentvoid13.github.io/Templater/syntax.html#function-documentation-syntax).

### [`tp.system.clipboard()`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/system-module.html#tpsystemclipboard)

Retrieves the clipboard's content.

##### [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/system-module.html#examples)

```
// Clipboard
<% tp.system.clipboard() %>
```

### [`tp.system.multi_suggester(text_items: string[] ⎮ ((item: T) => string), items: T[], throw_on_cancel: boolean = false, title: string = "", limit?: number = undefined)`](system-module.html#tpsystemmulti_suggestertext_items-string--item-t--string-items-t-throw_on_cancel-boolean--false-title-string---limit-number--undefined)

Spawns a suggester prompt that supports selecting multiple items and returns the user's chosen items.

##### [Arguments](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/system-module.html#arguments)

* `text_items`: Array of strings representing the text that will be displayed for each item in the suggester prompt. This can also be a function that maps an item to its text representation.
* `items`: Array containing the values of each item in the correct order.
* `throw_on_cancel`: Throws an error if the prompt is canceled, instead of returning a `null` value.
* `title`: Text placed at the top of the modal.
* `limit`: Limit the number of items rendered at once (useful to improve performance when displaying large lists).

##### [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/system-module.html#examples-1)

```
// Multi-suggester
<% await tp.system.multi_suggester(["Happy", "Sad", "Confused"], ["Happy", "Sad", "Confused"]) %>
// Multi-suggester with mapping function (same as above example)
<% await tp.system.multi_suggester((item) => item, ["Happy", "Sad", "Confused"]) %>
// Multi-suggester for files
<% (await tp.system.multi_suggester((item) => item.basename, tp.app.vault.getMarkdownFiles())).map(f => `[[${f.basename}]]`) %>
// Multi-suggester for tags
<% await tp.system.multi_suggester(item => item, Object.keys(tp.app.metadataCache.getTags()).map(x => x.replace("#", ""))) %>
// Reuse value from multi-suggester
<%*
let selectedValues = await tp.system.multi_suggester(["Happy", "Sad", "Confused"], ["Happy", "Sad", "Confused"]);
%>
# <% selectedValues %>
selected values: <% selectedValues %>
```

### [`tp.system.prompt(prompt_text?: string, default_value?: string, throw_on_cancel: boolean = false, multiline?: boolean = false)`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/system-module.html#tpsystempromptprompt_text-string-default_value-string-throw_on_cancel-boolean--false-multiline-boolean--false)

Spawns a prompt modal and returns the user's input.

##### [Arguments](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/system-module.html#arguments-1)

* `prompt_text`: Text placed above the input field.
* `default_value`: A default value for the input field.
* `throw_on_cancel`: Throws an error if the prompt is canceled, instead of returning a `null` value.
* `multiline`: If set to `true`, the input field will be a multiline textarea. Defaults to `false`.

##### [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/system-module.html#examples-2)

```
// Prompt
<% await tp.system.prompt("Please enter a value") %>
// Prompt with default value
<% await tp.system.prompt("What is your mood today?", "happy") %>
// Multiline prompt
<% await tp.system.prompt("What is your mood today?", null, false, true) %>
// Reuse output from prompt
<%*
let value = await tp.system.prompt("Please enter a value");
%>
# <% value %>
selected value: <% value %>
```

### [`tp.system.suggester(text_items: string[] ⎮ ((item: T) => string), items: T[], throw_on_cancel: boolean = false, placeholder: string = "", limit?: number = undefined)`](system-module.html#tpsystemsuggestertext_items-string--item-t--string-items-t-throw_on_cancel-boolean--false-placeholder-string---limit-number--undefined)

Spawns a suggester prompt and returns the user's chosen item.

##### [Arguments](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/system-module.html#arguments-2)

* `text_items`: Array of strings representing the text that will be displayed for each item in the suggester prompt. This can also be a function that maps an item to its text representation.
* `items`: Array containing the values of each item in the correct order.
* `throw_on_cancel`: Throws an error if the prompt is canceled, instead of returning a `null` value.
* `placeholder`: Placeholder string of the prompt.
* `limit`: Limit the number of items rendered at once (useful to improve performance when displaying large lists).

##### [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/system-module.html#examples-3)

```
// Suggester
<% await tp.system.suggester(["Happy", "Sad", "Confused"], ["Happy", "Sad", "Confused"]) %>
// Suggester with mapping function (same as above example)
<% await tp.system.suggester((item) => item, ["Happy", "Sad", "Confused"]) %>
// Suggester for files
[[<% (await tp.system.suggester((item) => item.basename, tp.app.vault.getMarkdownFiles())).basename %>]]
// Suggester for tags
<% await tp.system.suggester(item => item, Object.keys(tp.app.metadataCache.getTags()).map(x => x.replace("#", ""))) %>
// Reuse value from suggester
<%*
let selectedValue = await tp.system.suggester(["Happy", "Sad", "Confused"], ["Happy", "Sad", "Confused"]);
%>
# <% selectedValue %>
selected value: <% selectedValue %>
```

## [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/system-module.html#examples-4)

```
// Clipboard
<% tp.system.clipboard() %>

// Multi-suggester
<% await tp.system.multi_suggester(["Happy", "Sad", "Confused"], ["Happy", "Sad", "Confused"]) %>
// Multi-suggester with mapping function (same as above example)
<% await tp.system.multi_suggester((item) => item, ["Happy", "Sad", "Confused"]) %>
// Multi-suggester for files
<% (await tp.system.multi_suggester((item) => item.basename, tp.app.vault.getMarkdownFiles())).map(f => `[[${f.basename}]]`) %>
// Multi-suggester for tags
<% await tp.system.multi_suggester(item => item, Object.keys(tp.app.metadataCache.getTags()).map(x => x.replace("#", ""))) %>
// Reuse value from multi-suggester
<%*
let selectedValues = await tp.system.multi_suggester(["Happy", "Sad", "Confused"], ["Happy", "Sad", "Confused"]);
%>
# <% selectedValues %>
selected values: <% selectedValues %>

// Prompt
<% await tp.system.prompt("Please enter a value") %>
// Prompt with default value
<% await tp.system.prompt("What is your mood today?", "happy") %>
// Multiline prompt
<% await tp.system.prompt("What is your mood today?", null, false, true) %>
// Reuse output from prompt
<%*
let value = await tp.system.prompt("Please enter a value");
%>
# <% value %>
selected value: <% value %>

// Suggester
<% await tp.system.suggester(["Happy", "Sad", "Confused"], ["Happy", "Sad", "Confused"]) %>
// Suggester with mapping function (same as above example)
<% await tp.system.suggester((item) => item, ["Happy", "Sad", "Confused"]) %>
// Suggester for files
[[<% (await tp.system.suggester((item) => item.basename, tp.app.vault.getMarkdownFiles())).basename %>]]
// Suggester for tags
<% await tp.system.suggester(item => item, Object.keys(tp.app.metadataCache.getTags()).map(x => x.replace("#", ""))) %>
// Reuse value from suggester
<%*
let selectedValue = await tp.system.suggester(["Happy", "Sad", "Confused"], ["Happy", "Sad", "Confused"]);
%>
# <% selectedValue %>
selected value: <% selectedValue %>
```

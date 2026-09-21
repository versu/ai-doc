---
title: "tp.frontmatter - Templater"
source_url: "https://silentvoid13.github.io/Templater/internal-functions/internal-modules/frontmatter-module"
fetched_at: "2026-01-28T13:51:35.698401+00:00"
---



# [Frontmatter Module](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/frontmatter-module.html#frontmatter-module)

This modules exposes all the frontmatter variables of a file as variables.

* [Documentation](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/frontmatter-module.html#documentation)
  + [`tp.frontmatter.<frontmatter_variable_name>`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/frontmatter-module.html#tpfrontmatterfrontmatter_variable_name)
* [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/frontmatter-module.html#examples)

## [Documentation](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/frontmatter-module.html#documentation)

### [`tp.frontmatter.<frontmatter_variable_name>`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/frontmatter-module.html#tpfrontmatterfrontmatter_variable_name)

Retrieves the file's frontmatter variable value.

If your frontmatter variable name contains spaces, you can reference it using the bracket notation like so:

```
<% tp.frontmatter["variable name with spaces"] %>
```

## [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/frontmatter-module.html#examples)

Let's say you have the following file:

```
---
alias: myfile
note type: seedling
---

file content
```

Then you can use the following template:

```
File's metadata alias: <% tp.frontmatter.alias %>
Note's type: <% tp.frontmatter["note type"] %>
```

For lists in frontmatter, you can use JavaScript array prototype methods to manipulate how the data is displayed.

```
---
categories:
  - book
  - movie
---
```

```
<% tp.frontmatter.categories.map(prop => `  - "${prop}"`).join("\n") %>
```

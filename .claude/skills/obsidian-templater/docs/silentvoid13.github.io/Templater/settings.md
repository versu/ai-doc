---
title: "Settings - Templater"
source_url: "https://silentvoid13.github.io/Templater/settings"
fetched_at: "2026-01-28T13:51:35.698401+00:00"
---



# [Settings](https://silentvoid13.github.io/Templater/settings.html#settings)

## [General Settings](https://silentvoid13.github.io/Templater/settings.html#general-settings)

* `Template folder location`: Files in this folder will be available as templates.
* `Syntax Highlighting on Desktop` adds syntax highlighting for [Templater](https://github.com/SilentVoid13/Templater) commands in edit mode.
* `Syntax Highlighting on Mobile` adds syntax highlighting for [Templater](https://github.com/SilentVoid13/Templater) commands in edit mode on mobile. Use with caution: this may break live preview on mobile platforms."
* `Automatic jump to cursor` automatically triggers `tp.file.cursor` after inserting a template. You can also set a hotkey to manually trigger `tp.file.cursor`.
* `Trigger Templater on new file creation`: [Templater](https://github.com/SilentVoid13/Templater) will listen for the new file creation event, and, if it matches a rule you've set, replace every command it finds in the new file's content. This makes [Templater](https://github.com/SilentVoid13/Templater) compatible with other plugins like the Daily note core plugin, Calendar plugin, Review plugin, Note refactor plugin, etc.
  + Make sure to set up rules under either Folder Templates or File Regex Template below.
  + **Warning:** This can be dangerous if you create new files with unknown / unsafe content on creation. Make sure that every new file's content is safe on creation."

## [Template Hotkeys](https://silentvoid13.github.io/Templater/settings.html#template-hotkeys)

Template Hotkeys allows you to bind a template to a hotkey.

## [Folder Templates](https://silentvoid13.github.io/Templater/settings.html#folder-templates)

**Note**: This setting is hidden by default. To view it first enable the `Trigger Template on new file creation` setting. And since it's mutually exclusive with File Regex Templates, enabling one will disable the other.

You can specify a template that will automatically be used on a selected folder and children using the `Folder Templates` functionality. The deepest match will be used, so the order of the rules is irrelevant.

Add a rule for "`/`" if you need a catch-all.

## [File Regex Templates](https://silentvoid13.github.io/Templater/settings.html#file-regex-templates)

**Note**: This setting is hidden by default. To view it first enable the `Trigger Template on new file creation` setting. And since it's mutually exclusive with Folder Templates, enabling one will disable the other.

You can specify regex declarations that a new file's path will be tested against. If a regex matches, the associated template will automatically be used. Rules are tested top-to-bottom, and the first match will be used.

End with a rule for "`.*`" if you need a catch-all.

Use a tool like [Regex101](https://regex101.com/) to verify your regexes.

## [Startup Templates](https://silentvoid13.github.io/Templater/settings.html#startup-templates)

Startup Templates are templates that will get executed once when Templater starts.

These templates won't output anything.

This can be useful to set up templates adding hooks to obsidian events for example.

## [User Script Functions](https://silentvoid13.github.io/Templater/settings.html#user-script-functions)

All JavaScript files in this folder will be loaded as CommonJS modules, to import custom [user functions](https://silentvoid13.github.io/Templater/user-functions/overview.html).

The folder needs to be accessible from the vault.

Check the [documentation](https://silentvoid13.github.io/Templater/user-functions/script-user-functions.html) for more information.

## [User System Command Functions](https://silentvoid13.github.io/Templater/settings.html#user-system-command-functions)

Allows you to create [user functions](https://silentvoid13.github.io/Templater/user-functions/overview.html) linked to system commands.

Check the [documentation](https://silentvoid13.github.io/Templater/user-functions/system-user-functions.html) for more information.

**Warning:** It can be dangerous to execute arbitrary system commands from untrusted sources. Only run system commands that you understand, from trusted sources.

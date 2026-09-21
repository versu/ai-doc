---
title: "Commands - Templater"
source_url: "https://silentvoid13.github.io/Templater/commands/overview"
fetched_at: "2026-01-28T13:51:35.698401+00:00"
---



# [Commands](https://silentvoid13.github.io/Templater/commands/overview.html#commands)

## [Command Types](https://silentvoid13.github.io/Templater/commands/overview.html#command-types)

[Templater](https://github.com/SilentVoid13/Templater) defines 2 types of opening tags, that defines 2 types of **commands**:

* `<%`: Interpolation command. It will output the result of the expression that's inside.
* `<%*`: [JavaScript execution command](https://silentvoid13.github.io/Templater/commands/execution-command.html). It will execute the JavaScript code that's inside. It does not output anything by default.

The closing tag for a command is always the same: `%>`

## [Command utilities](https://silentvoid13.github.io/Templater/commands/overview.html#command-utilities)

In addition to the different types of commands, you can also use command utilities. They are also declared in the opening tag of the command. All command utilities work with all command types. The available command utilities are:

* [Whitespace Control](https://silentvoid13.github.io/Templater/commands/whitespace-control.html)
* [Dynamic Commands](https://silentvoid13.github.io/Templater/commands/dynamic-command.html)
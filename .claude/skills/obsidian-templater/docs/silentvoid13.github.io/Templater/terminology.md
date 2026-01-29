---
title: "Terminology - Templater"
source_url: "https://silentvoid13.github.io/Templater/terminology"
fetched_at: "2026-01-28T13:51:35.698401+00:00"
---



# [Terminology](https://silentvoid13.github.io/Templater/terminology.html#terminology)

To understand how [Templater](https://github.com/SilentVoid13/Templater) works, let's define a few terms:

* A **template** is a file that contains **[commands](https://silentvoid13.github.io/Templater/commands/overview.html)**.
* A text snippet that starts with an opening tag `<%`, ends with a closing tag `%>` is what we will call a **[command](https://silentvoid13.github.io/Templater/commands/overview.html)**.
* A **function** is an object that we can invoke inside a **command** and that returns a value (the replacement string)

There are two types of functions you can use:

* [Internal functions](https://silentvoid13.github.io/Templater/internal-functions/overview.html). They are **predefined** functions that are built within the plugin. As an example, `tp.date.now` is an internal function that will return the current date.
* [User functions](https://silentvoid13.github.io/Templater/user-functions/overview.html). Users can define their own functions. They are either [system command](https://silentvoid13.github.io/Templater/user-functions/system-user-functions.html) or [user scripts](https://silentvoid13.github.io/Templater/user-functions/script-user-functions.html).

### [Example](https://silentvoid13.github.io/Templater/terminology.html#example)

The following template contains 2 commands, calling 2 different internal functions:

```
Yesterday: <% tp.date.yesterday("YYYY-MM-DD") %>
Tomorrow: <% tp.date.tomorrow("YYYY-MM-DD") %>
```

We'll see in the next part the syntax required to write some commands.

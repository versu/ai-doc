---
title: "User Functions - Templater"
source_url: "https://silentvoid13.github.io/Templater/user-functions/overview"
fetched_at: "2026-01-28T13:51:35.698401+00:00"
---



# [User Functions](https://silentvoid13.github.io/Templater/user-functions/overview.html#user-functions)

You can define your own functions in Templater.

There are two types of user functions you can use:

* [Script User Functions](https://silentvoid13.github.io/Templater/user-functions/script-user-functions.html)
* [System Command User Functions](https://silentvoid13.github.io/Templater/user-functions/system-user-functions.html)

## [Invoking User Functions](https://silentvoid13.github.io/Templater/user-functions/overview.html#invoking-user-functions)

You can call a user function using the usual function call syntax: `tp.user.<user_function_name>()`, where `<user_function_name>` is the function name you defined.

For example, if you defined a system command user function named `echo`, a complete command invocation would look like this:

```
<% tp.user.echo() %>
```

## [No mobile support](https://silentvoid13.github.io/Templater/user-functions/overview.html#no-mobile-support)

Currently user functions are unavailable on Obsidian for mobile.

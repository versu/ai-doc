---
title: "tp.date - Templater"
source_url: "https://silentvoid13.github.io/Templater/internal-functions/internal-modules/date-module"
fetched_at: "2026-01-28T13:51:35.698401+00:00"
---



# [Date Module](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/date-module.html#date-module)

This module contains every internal function related to dates.

* [Documentation](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/date-module.html#documentation)
  + [`tp.date.now(format: string = "YYYY-MM-DD", offset?: number⎮string, reference?: string, reference_format?: string)`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/date-module.html#tpdatenowformat-string--yyyy-mm-dd-offset-numberstring-reference-string-reference_format-string)
  + [`tp.date.tomorrow(format: string = "YYYY-MM-DD")`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/date-module.html#tpdatetomorrowformat-string--yyyy-mm-dd)
  + [`tp.date.weekday(format: string = "YYYY-MM-DD", weekday: number, reference?: string, reference_format?: string)`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/date-module.html#tpdateweekdayformat-string--yyyy-mm-dd-weekday-number-reference-string-reference_format-string)
  + [`tp.date.yesterday(format: string = "YYYY-MM-DD")`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/date-module.html#tpdateyesterdayformat-string--yyyy-mm-dd)
* [Moment.js](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/date-module.html#momentjs)
* [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/date-module.html#examples-5)

## [Documentation](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/date-module.html#documentation)

Function documentation is using a specific syntax. More information [here](https://silentvoid13.github.io/Templater/syntax.html#function-documentation-syntax).

### [`tp.date.now(format: string = "YYYY-MM-DD", offset?: number⎮string, reference?: string, reference_format?: string)`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/date-module.html#tpdatenowformat-string--yyyy-mm-dd-offset-numberstring-reference-string-reference_format-string)

Retrieves the date.

##### [Arguments](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/date-module.html#arguments)

* `format`: The format for the date. Defaults to `"YYYY-MM-DD"`. Refer to [format reference](https://momentjs.com/docs/#/displaying/format/).
* `offset`: Duration to offset the date from. If a number is provided, duration will be added to the date in days. You can also specify the offset as a string using the ISO 8601 format.
* `reference`: The date referential, e.g. set this to the note's title.
* `reference_format`: The format for the reference date. Refer to [format reference](https://momentjs.com/docs/#/displaying/format/).

##### [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/date-module.html#examples)

```
// Date now
<% tp.date.now() %>
// Date now with format
<% tp.date.now("Do MMMM YYYY") %>
// Last week
<% tp.date.now("YYYY-MM-DD", -7) %>
// Next week
<% tp.date.now("YYYY-MM-DD", 7) %>
// Last month
<% tp.date.now("YYYY-MM-DD", "P-1M") %>
// Next year
<% tp.date.now("YYYY-MM-DD", "P1Y") %>
// File's title date + 1 day (tomorrow)
<% tp.date.now("YYYY-MM-DD", 1, tp.file.title, "YYYY-MM-DD") %>
// File's title date - 1 day (yesterday)
<% tp.date.now("YYYY-MM-DD", -1, tp.file.title, "YYYY-MM-DD") %>
```

### [`tp.date.tomorrow(format: string = "YYYY-MM-DD")`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/date-module.html#tpdatetomorrowformat-string--yyyy-mm-dd)

Retrieves tomorrow's date.

##### [Arguments](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/date-module.html#arguments-1)

* `format`: The format for the date. Defaults to `"YYYY-MM-DD"`. Refer to [format reference](https://momentjs.com/docs/#/displaying/format/).

##### [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/date-module.html#examples-1)

```
// Date tomorrow
<% tp.date.tomorrow() %>
// Date tomorrow with format
<% tp.date.tomorrow("Do MMMM YYYY") %>
```

### [`tp.date.weekday(format: string = "YYYY-MM-DD", weekday: number, reference?: string, reference_format?: string)`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/date-module.html#tpdateweekdayformat-string--yyyy-mm-dd-weekday-number-reference-string-reference_format-string)

##### [Arguments](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/date-module.html#arguments-2)

* `format`: The format for the date. Defaults to `"YYYY-MM-DD"`. Refer to [format reference](https://momentjs.com/docs/#/displaying/format/).
* `weekday`: Week day number. If the locale assigns Monday as the first day of the week, `0` will be Monday, `-7` will be last week's day.
* `reference`: The date referential, e.g. set this to the note's title.
* `reference_format`: The format for the reference date. Refer to [format reference](https://momentjs.com/docs/#/displaying/format/).

##### [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/date-module.html#examples-2)

```
// This week's Monday
<% tp.date.weekday("YYYY-MM-DD", 0) %>
// Next Monday
<% tp.date.weekday("YYYY-MM-DD", 7) %>
// File's title Monday
<% tp.date.weekday("YYYY-MM-DD", 0, tp.file.title, "YYYY-MM-DD") %>
// File's title previous Monday
<% tp.date.weekday("YYYY-MM-DD", -7, tp.file.title, "YYYY-MM-DD") %>
```

### [`tp.date.yesterday(format: string = "YYYY-MM-DD")`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/date-module.html#tpdateyesterdayformat-string--yyyy-mm-dd)

Retrieves yesterday's date.

##### [Arguments](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/date-module.html#arguments-3)

* `format`: The format for the date. Defaults to `"YYYY-MM-DD"`. Refer to [format reference](https://momentjs.com/docs/#/displaying/format/).

##### [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/date-module.html#examples-3)

```
// Date yesterday
<% tp.date.yesterday() %>
// Date yesterday with format
<% tp.date.yesterday("Do MMMM YYYY") %>
```

## [Moment.js](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/date-module.html#momentjs)

Templater gives you access to the `moment` object, with all of its functionalities.

More information on moment.js [here](https://momentjs.com/docs/#/displaying/).

##### [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/date-module.html#examples-4)

```
// Date now
<% moment(tp.file.title, "YYYY-MM-DD").format("YYYY-MM-DD") %>
// Get start of month from note title
<% moment(tp.file.title, "YYYY-MM-DD").startOf("month").format("YYYY-MM-DD") %>
// Get end of month from note title
<% moment(tp.file.title, "YYYY-MM-DD").endOf("month").format("YYYY-MM-DD") %>
```

## [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/date-module.html#examples-5)

```
// Date now
<% tp.date.now() %>
// Date now with format
<% tp.date.now("Do MMMM YYYY") %>
// Last week
<% tp.date.now("YYYY-MM-DD", -7) %>
// Next week
<% tp.date.now("YYYY-MM-DD", 7) %>
// Last month
<% tp.date.now("YYYY-MM-DD", "P-1M") %>
// Next year
<% tp.date.now("YYYY-MM-DD", "P1Y") %>
// File's title date + 1 day (tomorrow)
<% tp.date.now("YYYY-MM-DD", 1, tp.file.title, "YYYY-MM-DD") %>
// File's title date - 1 day (yesterday)
<% tp.date.now("YYYY-MM-DD", -1, tp.file.title, "YYYY-MM-DD") %>

// Date tomorrow
<% tp.date.tomorrow() %>
// Date tomorrow with format
<% tp.date.tomorrow("Do MMMM YYYY") %>

// This week's Monday
<% tp.date.weekday("YYYY-MM-DD", 0) %>
// Next Monday
<% tp.date.weekday("YYYY-MM-DD", 7) %>
// File's title Monday
<% tp.date.weekday("YYYY-MM-DD", 0, tp.file.title, "YYYY-MM-DD") %>
// File's title previous Monday
<% tp.date.weekday("YYYY-MM-DD", -7, tp.file.title, "YYYY-MM-DD") %>

// Date yesterday
<% tp.date.yesterday() %>
// Date yesterday with format
<% tp.date.yesterday("Do MMMM YYYY") %>
```

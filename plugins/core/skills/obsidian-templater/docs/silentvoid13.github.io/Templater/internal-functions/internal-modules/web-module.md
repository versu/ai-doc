---
title: "tp.web - Templater"
source_url: "https://silentvoid13.github.io/Templater/internal-functions/internal-modules/web-module"
fetched_at: "2026-01-28T13:51:35.698401+00:00"
---



# [Web Module](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/web-module.html#web-module)

This modules contains every internal function related to the web (making web requests).

* [Documentation](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/web-module.html#documentation)
  + [`tp.web.daily_quote()`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/web-module.html#tpwebdaily_quote)
  + [`tp.web.random_picture(size?: string, query?: string, include_size?: boolean)`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/web-module.html#tpwebrandom_picturesize-string-query-string-include_size-boolean)
  + [`tp.web.request(url: string, path?: string)`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/web-module.html#tpwebrequesturl-string-path-string)
* [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/web-module.html#examples-3)

## [Documentation](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/web-module.html#documentation)

Function documentation is using a specific syntax. More information [here](https://silentvoid13.github.io/Templater/syntax.html#function-documentation-syntax).

### [`tp.web.daily_quote()`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/web-module.html#tpwebdaily_quote)

Retrieves and parses the daily quote from `https://github.com/Zachatoo/quotes-database` as a callout.

##### [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/web-module.html#examples)

```
// Daily quote
<% await tp.web.daily_quote() %>
```

### [`tp.web.random_picture(size?: string, query?: string, include_size?: boolean)`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/web-module.html#tpwebrandom_picturesize-string-query-string-include_size-boolean)

Gets a random image from `https://unsplash.com/`.

##### [Arguments](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/web-module.html#arguments)

* `size`: Image size in the format `<width>x<height>`.
* `query`: Limits selection to photos matching a search term. Multiple search terms can be passed separated by a comma.
* `include_size`: Optional argument to include the specified size in the image link markdown. Defaults to false.

##### [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/web-module.html#examples-1)

```
// Random picture
<% await tp.web.random_picture() %>
// Random picture with size
<% await tp.web.random_picture("200x200") %>
// Random picture with size and query
<% await tp.web.random_picture("200x200", "landscape,water") %>
```

### [`tp.web.request(url: string, path?: string)`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/web-module.html#tpwebrequesturl-string-path-string)

Makes a HTTP request to the specified URL. Optionally, you can specify a path to extract specific data from the response.

##### [Arguments](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/web-module.html#arguments-1)

* `url`: The URL to which the HTTP request will be made.
* `path`: A path within the response JSON to extract specific data.

##### [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/web-module.html#examples-2)

```
// Simple request
<% await tp.web.request("https://jsonplaceholder.typicode.com/todos/1") %>
// Request with path
<% await tp.web.request("https://jsonplaceholder.typicode.com/todos", "0.title") %>
```

## [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/web-module.html#examples-3)

```
// Daily quote
<% await tp.web.daily_quote() %>

// Random picture
<% await tp.web.random_picture() %>
// Random picture with size
<% await tp.web.random_picture("200x200") %>
// Random picture with size and query
<% await tp.web.random_picture("200x200", "landscape,water") %>

// Simple request
<% await tp.web.request("https://jsonplaceholder.typicode.com/todos/1") %>
// Request with path
<% await tp.web.request("https://jsonplaceholder.typicode.com/todos", "0.title") %>
```

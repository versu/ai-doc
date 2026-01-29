---
title: "tp.file - Templater"
source_url: "https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module"
fetched_at: "2026-01-28T13:51:35.698401+00:00"
---



# [File Module](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#file-module)

This module contains every internal function related to files.

* [Documentation](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#documentation)
  + [`tp.file.content`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#tpfilecontent)
  + [`tp.file.create_new(template: TFile ⎮ string, filename?: string, open_new: boolean = false, folder?: TFolder | string)`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#tpfilecreate_newtemplate-tfile--string-filename-string-open_new-boolean--false-folder-tfolder--string)
  + [`tp.file.creation_date(format: string = "YYYY-MM-DD HH:mm")`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#tpfilecreation_dateformat-string--yyyy-mm-dd-hhmm)
  + [`tp.file.cursor(order?: number)`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#tpfilecursororder-number)
  + [`tp.file.cursor_append(content: string)`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#tpfilecursor_appendcontent-string)
  + [`tp.file.exists(filepath: string)`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#tpfileexistsfilepath-string)
  + [`tp.file.find_tfile(filename: string)`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#tpfilefind_tfilefilename-string)
  + [`tp.file.folder(absolute: boolean = false)`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#tpfilefolderabsolute-boolean--false)
  + [`tp.file.include(include_link: string ⎮ TFile)`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#tpfileincludeinclude_link-string--tfile)
  + [`tp.file.last_modified_date(format: string = "YYYY-MM-DD HH:mm")`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#tpfilelast_modified_dateformat-string--yyyy-mm-dd-hhmm)
  + [`tp.file.move(new_path: string, file_to_move?: TFile)`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#tpfilemovenew_path-string-file_to_move-tfile)
  + [`tp.file.path(relative: boolean = false)`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#tpfilepathrelative-boolean--false)
  + [`tp.file.rename(new_title: string)`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#tpfilerenamenew_title-string)
  + [`tp.file.selection()`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#tpfileselection)
  + [`tp.file.tags`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#tpfiletags)
  + [`tp.file.title`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#tpfiletitle)
* [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#examples-16)

## [Documentation](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#documentation)

Function documentation is using a specific syntax. More information [here](https://silentvoid13.github.io/Templater/syntax.html#function-documentation-syntax).

### [`tp.file.content`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#tpfilecontent)

The string contents of the file at the time that Templater was executed. Manipulating this string will *not* update the current file.

##### [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#examples)

```
// Retrieve file content
<% tp.file.content %>
```

### [`tp.file.create_new(template: TFile ⎮ string, filename?: string, open_new: boolean = false, folder?: TFolder | string)`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#tpfilecreate_newtemplate-tfile--string-filename-string-open_new-boolean--false-folder-tfolder--string)

Creates a new file using a specified template or with a specified content.

##### [Arguments](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#arguments)

* `template`: Either the template used for the new file content, or the file content as a string. If it is the template to use, you retrieve it with `tp.file.find_tfile(TEMPLATENAME)`.
* `filename`: The filename of the new file, defaults to "Untitled".
* `open_new`: Whether to open or not the newly created file. Warning: if you use this option, since commands are executed asynchronously, the file can be opened first and then other commands are appended to that new file and not the previous file.
* `folder`: The folder to put the new file in, defaults to Obsidian's default location. If you want the file to appear in a different folder, specify it with `"PATH/TO/FOLDERNAME"` or `tp.app.vault.getAbstractFileByPath("PATH/TO/FOLDERNAME")`.

##### [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#examples-1)

```
// File creation
<%* await tp.file.create_new("MyFileContent", "MyFilename") %>
// File creation with template
<%* await tp.file.create_new(tp.file.find_tfile("MyTemplate"), "MyFilename") %>
// File creation and open created note
<%* await tp.file.create_new("MyFileContent", "MyFilename", true) %>
// File creation in current folder
<%* await tp.file.create_new("MyFileContent", "MyFilename", false, tp.file.folder(true)) %>
// File creation in specified folder with string path
<%* await tp.file.create_new("MyFileContent", "MyFilename", false, "Path/To/MyFolder") %>
// File creation in specified folder with TFolder
<%* await tp.file.create_new("MyFileContent", "MyFilename", false, tp.app.vault.getAbstractFileByPath("MyFolder")) %>
// File creation and append link to current note
[[<% (await tp.file.create_new("MyFileContent", "MyFilename")).basename %>]]
```

### [`tp.file.creation_date(format: string = "YYYY-MM-DD HH:mm")`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#tpfilecreation_dateformat-string--yyyy-mm-dd-hhmm)

Retrieves the file's creation date.

##### [Arguments](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#arguments-1)

* `format`: The format for the date. Defaults to `"YYYY-MM-DD HH:mm"`. Refer to [format reference](https://momentjs.com/docs/#/displaying/format/).

##### [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#examples-2)

```
// File creation date
<% tp.file.creation_date() %>
// File creation date with format
<% tp.file.creation_date("dddd Do MMMM YYYY HH:mm") %>
```

### [`tp.file.cursor(order?: number)`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#tpfilecursororder-number)

Sets the cursor to this location after the template has been inserted.

You can navigate between the different cursors using the configured hotkey in Obsidian settings.

##### [Arguments](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#arguments-2)

* `order`: The order of the different cursors jump, e.g. it will jump from 1 to 2 to 3, and so on.
  If you specify multiple tp.file.cursor with the same order, the editor will switch to multi-cursor.

##### [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#examples-3)

```
// File cursor
<% tp.file.cursor() %>
// File multi-cursor
<% tp.file.cursor(1) %>Content<% tp.file.cursor(1) %>
```

### [`tp.file.cursor_append(content: string)`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#tpfilecursor_appendcontent-string)

Appends some content after the active cursor in the file.

##### [Arguments](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#arguments-3)

* `content`: The content to append after the active cursor.

##### [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#examples-4)

```
// File cursor append
<% tp.file.cursor_append("Some text") %>
```

### [`tp.file.exists(filepath: string)`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#tpfileexistsfilepath-string)

Check to see if a file exists by it's file path. The full path to the file, relative to the Vault and containing the extension, must be provided.

##### [Arguments](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#arguments-4)

* `filepath`: The full file path of the file we want to check existence for.

##### [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#examples-5)

```
// File existence
<% await tp.file.exists("MyFolder/MyFile.md") %>
// File existence of current file
<% await tp.file.exists(tp.file.folder(true) + "/" + tp.file.title + ".md") %>
```

### [`tp.file.find_tfile(filename: string)`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#tpfilefind_tfilefilename-string)

Search for a file and returns its `TFile` instance.

##### [Arguments](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#arguments-5)

* `filename`: The filename we want to search and resolve as a `TFile`.

##### [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#examples-6)

```
// File find TFile
<% tp.file.find_tfile("MyFile").basename %>
```

### [`tp.file.folder(absolute: boolean = false)`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#tpfilefolderabsolute-boolean--false)

Retrieves the file's folder name.

##### [Arguments](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#arguments-6)

* `absolute`: If set to `true`, returns the vault-absolute path of the folder. If `false`, only returns the basename of the folder (the last part). Defaults to `false`.

##### [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#examples-7)

```
// File folder (Folder)
<% tp.file.folder() %>
// File folder with vault-absolute path (Path/To/Folder)
<% tp.file.folder(true) %>
```

### [`tp.file.include(include_link: string ⎮ TFile)`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#tpfileincludeinclude_link-string--tfile)

Includes the file's link content. Templates in the included content will be resolved. Any frontmatter in the included file will be merged with the parent file.

##### [Arguments](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#arguments-7)

* `include_link`: The link to the file to include, e.g. `"[[MyFile]]"`, or a TFile object. Also supports sections or blocks inclusions.

##### [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#examples-8)

```
// File include
<% await tp.file.include("[[Template1]]") %>
// File include TFile
<% await tp.file.include(tp.file.find_tfile("MyFile")) %>
// File include section
<% await tp.file.include("[[MyFile#Section1]]") %>
// File include block
<% await tp.file.include("[[MyFile#^block1]]") %>
```

### [`tp.file.last_modified_date(format: string = "YYYY-MM-DD HH:mm")`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#tpfilelast_modified_dateformat-string--yyyy-mm-dd-hhmm)

Retrieves the file's last modification date.

##### [Arguments](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#arguments-8)

* `format`: The format for the date. Defaults to `"YYYY-MM-DD HH:mm"`. Refer to [format reference](https://momentjs.com/docs/#/displaying/format/).

##### [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#examples-9)

```
// File last modified date
<% tp.file.last_modified_date() %>
// File last modified date with format
<% tp.file.last_modified_date("dddd Do MMMM YYYY HH:mm") %>
```

### [`tp.file.move(new_path: string, file_to_move?: TFile)`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#tpfilemovenew_path-string-file_to_move-tfile)

Moves the file to the desired vault location.

##### [Arguments](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#arguments-9)

* `new_path`: The new vault relative path of the file, without the file extension. Note: the new path needs to include the folder and the filename, e.g. `"/Notes/MyNote"`.
* `file_to_move`: The file to move, defaults to the current file.

##### [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#examples-10)

```
// File move
<%* await tp.file.move("/A/B/" + tp.file.title) %>
// File move and rename
<%* await tp.file.move("/A/B/NewTitle") %>
```

### [`tp.file.path(relative: boolean = false)`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#tpfilepathrelative-boolean--false)

Retrieves the file's absolute path on the system.

##### [Arguments](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#arguments-10)

* `relative`: If set to `true`, only retrieves the vault's relative path.

##### [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#examples-11)

```
// File path
<% tp.file.path() %>
// File relative path (relative to vault root)
<% tp.file.path(true) %>
```

### [`tp.file.rename(new_title: string)`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#tpfilerenamenew_title-string)

Renames the file (keeps the same file extension).

##### [Arguments](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#arguments-11)

* `new_title`: The new file title.

##### [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#examples-12)

```
// File rename
<%* await tp.file.rename("MyNewName") %>
// File append a 2 to the file name
<%* await tp.file.rename(tp.file.title + "2") %>
```

### [`tp.file.selection()`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#tpfileselection)

Retrieves the active file's text selection.

##### [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#examples-13)

```
// File selection
<% tp.file.selection() %>
```

### [`tp.file.tags`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#tpfiletags)

Retrieves the file's tags (array of string).

##### [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#examples-14)

```
// File tags
<% tp.file.tags %>
```

### [`tp.file.title`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#tpfiletitle)

Retrieves the file's title.

##### [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#examples-15)

```
// File title
<% tp.file.title %>
// Strip the Zettelkasten ID of title (if space separated)
<% tp.file.title.split(" ")[1] %>
```

## [Examples](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/file-module.html#examples-16)

```
// Retrieve file content
<% tp.file.content %>

// File creation
<%* await tp.file.create_new("MyFileContent", "MyFilename") %>
// File creation with template
<%* await tp.file.create_new(tp.file.find_tfile("MyTemplate"), "MyFilename") %>
// File creation and open created note
<%* await tp.file.create_new("MyFileContent", "MyFilename", true) %>
// File creation in current folder
<%* await tp.file.create_new("MyFileContent", "MyFilename", false, tp.file.folder(true)) %>
// File creation in specified folder with string path
<%* await tp.file.create_new("MyFileContent", "MyFilename", false, "Path/To/MyFolder") %>
// File creation in specified folder with TFolder
<%* await tp.file.create_new("MyFileContent", "MyFilename", false, tp.app.vault.getAbstractFileByPath("MyFolder")) %>
// File creation and append link to current note
[[<% (await tp.file.create_new("MyFileContent", "MyFilename")).basename %>]]

// File creation date
<% tp.file.creation_date() %>
// File creation date with format
<% tp.file.creation_date("dddd Do MMMM YYYY HH:mm") %>

// File cursor
<% tp.file.cursor() %>
// File multi-cursor
<% tp.file.cursor(1) %>Content<% tp.file.cursor(1) %>

// File cursor append
<% tp.file.cursor_append("Some text") %>

// File existence
<% await tp.file.exists("MyFolder/MyFile.md") %>
// File existence of current file
<% await tp.file.exists(tp.file.folder(true) + "/" + tp.file.title + ".md") %>

// File find TFile
<% tp.file.find_tfile("MyFile").basename %>

// File folder (Folder)
<% tp.file.folder() %>
// File folder with vault-absolute path (Path/To/Folder)
<% tp.file.folder(true) %>

// File include
<% await tp.file.include("[[Template1]]") %>
// File include TFile
<% await tp.file.include(tp.file.find_tfile("MyFile")) %>
// File include section
<% await tp.file.include("[[MyFile#Section1]]") %>
// File include block
<% await tp.file.include("[[MyFile#^block1]]") %>

// File last modified date
<% tp.file.last_modified_date() %>
// File last modified date with format
<% tp.file.last_modified_date("dddd Do MMMM YYYY HH:mm") %>

// File move
<%* await tp.file.move("/A/B/" + tp.file.title) %>
// File move and rename
<%* await tp.file.move("/A/B/NewTitle") %>

// File path
<% tp.file.path() %>
// File relative path (relative to vault root)
<% tp.file.path(true) %>

// File rename
<%* await tp.file.rename("MyNewName") %>
// File append a 2 to the file name
<%* await tp.file.rename(tp.file.title + "2") %>

// File selection
<% tp.file.selection() %>

// File tags
<% tp.file.tags %>

// File title
<% tp.file.title %>
// Strip the Zettelkasten ID of title (if space separated)
<% tp.file.title.split(" ")[1] %>
```

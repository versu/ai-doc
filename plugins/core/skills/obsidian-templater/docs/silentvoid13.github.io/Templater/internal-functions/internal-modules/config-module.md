---
title: "tp.config - Templater"
source_url: "https://silentvoid13.github.io/Templater/internal-functions/internal-modules/config-module"
fetched_at: "2026-01-28T13:51:35.698401+00:00"
---



# [Config Module](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/config-module.html#config-module)

This module exposes Templater's running configuration.

This is mostly useful when writing scripts requiring some context information.

* [Documentation](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/config-module.html#documentation)
  + [`tp.config.active_file?`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/config-module.html#tpconfigactive_file)
  + [`tp.config.run_mode`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/config-module.html#tpconfigrun_mode)
  + [`tp.config.target_file`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/config-module.html#tpconfigtarget_file)
  + [`tp.config.template_file`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/config-module.html#tpconfigtemplate_file)

## [Documentation](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/config-module.html#documentation)

### [`tp.config.active_file?`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/config-module.html#tpconfigactive_file)

The active file (if existing) when launching Templater.

### [`tp.config.run_mode`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/config-module.html#tpconfigrun_mode)

The `RunMode`, representing the way Templater was launched (Create new from template, Append to active file, ...).

### [`tp.config.target_file`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/config-module.html#tpconfigtarget_file)

The `TFile` object representing the target file where the template will be inserted.

### [`tp.config.template_file`](https://silentvoid13.github.io/Templater/internal-functions/internal-modules/config-module.html#tpconfigtemplate_file)

The `TFile` object representing the template file.

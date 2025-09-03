# yaml-extend

**yaml-extend** — a small wrapper around [`js-yaml`] that adds focused, deterministic templating features to YAML: imports, per-module params, locals, private fields, typed interpolations and small tag payloads — with caching and a file-watching `LiveLoader`.

> Package name: **`yaml-extend`**

---

## Table of contents

- [Why yaml-extend](#why-yaml-extend)
- [Install](#install)
- [Quickstart](#quickstart)
- [Directives (syntax & semantics)](#directives-syntax--semantics)
- [Interpolations & wrappers](#interpolations--wrappers)
- [Tags with payloads](#tags-with-payloads)
- [Evaluation order & semantics (important)](#evaluation-order--semantics-important)
- [API reference](#api-reference)
- [CLI / resolve helpers](#cli--resolve-helpers)
- [Live reloading (LiveLoader)](#live-reloading-liveloader)
- [Options & diagnostics](#options--diagnostics)
- [Security & sandboxing](#security--sandboxing)
- [Examples & repo layout](#examples--repo-layout)
- [Troubleshooting / common errors](#troubleshooting--common-errors)
- [Contributing](#contributing)
- [License](#license)

---

## Why yamlx

`yamlx` keeps YAML simple while giving you the small, practical features people build wrappers for:

- Import other YAML files with parameter overrides (`%IMPORT` + `$imp`)
- Declare module params (`%PARAM`) and pass overrides from loader
- Declare locals (`%LOCAL`) and transient locals with `$this`
- Mark evaluation-only nodes that are removed from output (`%PRIVATE`)
- Type-aware interpolations with explicit wrappers (`{}`, `[]`, scalar / `${}`)
- Small tag payloads (safe, single-scalar payloads for tags like `!switch(...)`)
- Deterministic left-to-right evaluation and immediate circular-import detection
- Built-in caching and a `LiveLoader` for watch+reload workflows

Design goal: keep YAML familiar and simple while enabling safe, deterministic configuration templating.

---

## Install

```bash
# npm
npm install yamlx

# yarn
yarn add yamlx
```

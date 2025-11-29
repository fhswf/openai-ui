## [Unreleased]

### Features

* single popup for tool details
  Replaced individual tool usage details with a single popup window that displays all tool information when any tool badge is clicked.

## [0.28.2](https://github.com/fhswf/openai-ui/compare/v0.28.1...v0.28.2) (2025-11-27)

### Bug Fixes

* remove deprecated APIs ([41f7ffc](https://github.com/fhswf/openai-ui/commit/41f7ffc8dacd8eddd51a244076bc396f1d63f218))  
  Removed usage of deprecated endpoints/APIs and updated call sites to the new interfaces.

* remove deprecated APIs ([475f80d](https://github.com/fhswf/openai-ui/commit/475f80d456837da81c0a27f62e2e911cf7c6b7ab))  
  Follow-up cleanup and tests adjusted for API changes.

## [0.28.1](https://github.com/fhswf/openai-ui/compare/v0.28.0...v0.28.1) (2025-11-24)

### Bug Fixes

* handle potential undefined currentChat in MessageMenu ([446ccbe](https://github.com/fhswf/openai-ui/commit/446ccbe35f4219b0f167324673f0bbdbe79ede62)), closes [#71](https://github.com/fhswf/openai-ui/issues/71)  
  Added guards/null checks to prevent runtime errors when currentChat is not set; improved unit/edge-case handling.

# [0.28.0](https://github.com/fhswf/openai-ui/compare/v0.27.2...v0.28.0) (2025-11-10)

### Features

* tool details ([2c80c01](https://github.com/fhswf/openai-ui/commit/2c80c0120331701332e06e36b0c52d3416be2af1))  
  Added UI and data plumbing to show detailed information for tool calls (arguments, outputs, timestamps).

## [0.27.2](https://github.com/fhswf/openai-ui/compare/v0.27.1...v0.27.2) (2025-11-04)

### Bug Fixes

* handle missing source in web search call ([3fc0021](https://github.com/fhswf/openai-ui/commit/3fc00211e65200169dc925678376433cadcc0f73))  
  Added fallback/default handling when web search results lack the source field to avoid crashes.

## [0.27.1](https://github.com/fhswf/openai-ui/compare/v0.27.0...v0.27.1) (2025-10-31)

### Bug Fixes

* handle missing information gracefully ([afd8437](https://github.com/fhswf/openai-ui/commit/afd8437d7e429588f8b96fd49658d7822b654ad6))  
  Defensive checks added across UI components to display placeholders instead of failing.

# [0.27.0](https://github.com/fhswf/openai-ui/compare/v0.26.2...v0.27.0) (2025-10-31)

### Bug Fixes

* handle exception in JSON parsing ([0e5fd3b](https://github.com/fhswf/openai-ui/commit/0e5fd3bf84a5324186ad38606b7bcfd12fade4b3))  
  Try/catch around JSON.parse and fallback behavior added.

* update tool when output item is done ([0c680ff](https://github.com/fhswf/openai-ui/commit/0c680ff4a6eb7f8da1f1a2e3fa5533781cdb7bd3))  
  State updates ensure tool instances refresh when outputs complete.

* use reviver function when loading state ([327631f](https://github.com/fhswf/openai-ui/commit/327631f2b32440293fca755ac6ba7b7c3dc7ab97))  
  JSON reviver restores complex types (dates, maps) when restoring persisted state.


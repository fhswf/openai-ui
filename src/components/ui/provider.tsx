"use client";

import {
  ChakraProvider,
  createSystem,
  defineConfig,
  defaultConfig,
} from "@chakra-ui/react";
import { ColorModeProvider, type ColorModeProviderProps } from "./color-mode";

const config = defineConfig({
  cssVarsRoot: ":where(:root)",
  theme: {
    semanticTokens: {
      colors: {
        bg: {
          DEFAULT: {
            value: { _light: "#f8fafc", _dark: "#0f172a" },
          },
          muted: {
            value: { _light: "#f1f5f9", _dark: "#1e293b" },
          },
          panel: {
            value: { _light: "#ffffff", _dark: "#1e293b" },
          },
          disabled: {
            value: { _light: "#e2e8f0", _dark: "#334155" },
          },
        },
        fg: {
          DEFAULT: {
            value: { _light: "#1e293b", _dark: "#f1f5f9" },
          },
          muted: {
            value: { _light: "#475569", _dark: "#cbd5e1" },
          },
          subtle: {
            value: { _light: "#64748b", _dark: "#94a3b8" },
          },
          error: {
            value: { _light: "#b91c1c", _dark: "#fca5a5" },
          },
          disabled: {
            value: { _light: "#334155", _dark: "#e2e8f0" },
          },
          inverted: {
            value: { _light: "#f8fafc", _dark: "#0f172a" },
          },
        },
        border: {
          DEFAULT: {
            value: { _light: "#cbd5e1", _dark: "#475569" },
          },
          muted: {
            value: { _light: "#e2e8f0", _dark: "#334155" },
          },
          emphasized: {
            value: { _light: "#94a3b8", _dark: "#64748b" },
          },
          disabled: {
            value: { _light: "#cbd5e1", _dark: "#64748b" },
          },
        },
        blue: {
          contrast: {
            value: { _light: "#ffffff", _dark: "#172b3b" },
          },
          fg: {
            value: { _light: "#005a9c", _dark: "#9ad0ff" },
          },
          subtle: {
            value: { _light: "#e0f2fe", _dark: "#1e3a52" },
          },
          muted: {
            value: { _light: "#bae6fd", _dark: "#244b6a" },
          },
          emphasized: {
            value: { _light: "#7dd3fc", _dark: "#315e80" },
          },
          solid: {
            value: { _light: "#005a9c", _dark: "#9ad0ff" },
          },
          hover: {
            value: { _light: "#004476", _dark: "#b5dcff" },
          },
          focusRing: {
            value: { _light: "#0284c7", _dark: "#7dd3fc" },
          },
          border: {
            value: { _light: "#0284c7", _dark: "#66b9f2" },
          },
        },
      },
    },
    layerStyles: {
      disabled: {
        value: {
          bg: "bg.disabled",
          color: "fg.disabled",
          borderColor: "border.disabled",
          opacity: 1,
          cursor: "not-allowed",
        },
      },
    },
  },
  globalCss: {
    "html, body": {
      backgroundColor: "bg",
      color: "fg",
      fontFamily: "body",
    },
    '[type="primary"]': {
      colorPalette: "blue",
    },
    '[data-scope="switch"], [data-scope="radio-group"]': {
      colorPalette: "blue",
    },
  },
});

const system = createSystem(defaultConfig, config);

export function Provider(props: ColorModeProviderProps) {
  return (
    <ChakraProvider value={system}>
      <ColorModeProvider {...props} />
    </ChakraProvider>
  );
}

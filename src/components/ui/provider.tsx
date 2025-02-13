"use client"

import { ChakraProvider, createSystem, defineConfig, defaultConfig, defaultSystem } from "@chakra-ui/react"
import {
  ColorModeProvider,
  type ColorModeProviderProps,
} from "./color-mode"

const config = defineConfig({
  cssVarsRoot: ":where(:root)",
  globalCss: {
    '[type="primary"]': {
      colorPalette: "blue",
    },
    '[data-scope="switch"], [data-scope="radio-group"]': {
      colorPalette: "blue",
    },
  },
})

const system = createSystem(defaultConfig, config)

export function Provider(props: ColorModeProviderProps) {

  return (
    <ChakraProvider value={system}>
      <ColorModeProvider {...props} />
    </ChakraProvider>
  )
}

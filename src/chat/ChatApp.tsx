import React, { Suspense, useEffect } from 'react'
import { ChatProvider, useGlobal } from "./context"
import { useTheme } from '../components/hooks'
import { Theme, ProgressCircle } from "@chakra-ui/react"

import './style.less'
const Chat = React.lazy(() => import("./Chat"))



export default function ChatApp() {
  const [current, toggleCurrent] = useTheme()

  const loading = (
    <ProgressCircle.Root
      size="lg"
      color="blue.400"
    />
  )
  return (
    <Suspense fallback={loading}>
      <ChatProvider>
        <Theme value={current}>
          <Chat />
        </Theme>
      </ChatProvider>
    </Suspense>
  )
}

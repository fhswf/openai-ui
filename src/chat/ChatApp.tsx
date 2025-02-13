import React, { Suspense, useEffect } from 'react'
import { ChatProvider, useGlobal } from "./context"
import { Loading } from '../components/Loading'
import { useTheme } from '../components/hooks'
import { Theme } from "@chakra-ui/react"

import './style.less'
const Chat = React.lazy(() => import("./Chat"))



export default function ChatApp() {
  const [current, toggleCurrent] = useTheme()

  return (
    <Suspense fallback={<Loading />}>
      <ChatProvider>
        <Theme value={current}>
          <Chat />
        </Theme>
      </ChatProvider>
    </Suspense>
  )
}

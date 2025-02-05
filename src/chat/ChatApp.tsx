import React, { Suspense, useEffect } from 'react'
import { ChatProvider, useGlobal } from "./context"
import { Loading } from '../components/Loading'
import './style.less'
const Chat = React.lazy(() => import("./Chat"))



export default function ChatApp() {
  return (
    <Suspense fallback={<Loading />}>
      <ChatProvider>
        <Chat />
      </ChatProvider>
    </Suspense>
  )
}

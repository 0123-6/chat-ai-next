'use client'

import '../index.css'
import 'highlight.js/styles/default.css'
import hljs from 'highlight.js'
import {marked} from 'marked'
import {use, useEffect, useRef, useState, useSyncExternalStore} from 'react'
import xss from 'xss'
import {Button} from 'antd'
import {userStore} from '@/store/user.ts'
import {historyStore} from '@/store/history.ts'
import LoginModal from '@/components/LoginModal.tsx'
import ChatDrawer from '@/components/ChatDrawer.tsx'
import ChatMessage from '@/components/ChatMessage.tsx'
import {useAsyncEffect} from '@/util/hooks/useEffectUtil.ts'
import {useResetState} from '@/util/hooks/useResetState.ts'
import {useScrollControl} from '@/util/hooks/useScrollControl.ts'
import {baseFetch, streamFetch} from '@/util/api.ts'

interface IChat {
  question: string;
  // 流式分片拼接的临时存储，实现实时打字机效果
  streamingAnswer?: string;
}

interface IProps {
  params: Promise<{ conversationId?: string[] }>,
}

// 流式数据结构（对应后端SSE推送格式）
interface IStreamData {
  code: number;
  msg: string;
  data: {
    conversationId: string;
    partialAnswer?: string;
  };
}
export default function Page(props: IProps) {
  const [loginModalOpen, setLoginModalOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const {
    userInfo,
    initialized,
  } = useSyncExternalStore(userStore.subscribe, userStore.getSnapshot, userStore.getSnapshot)
  const {conversationId: conversationIdArr} = use(props.params)
  // 可选捕获路由：/chat -> undefined, /chat/xxx -> ['xxx']
  // 保存当前会话ID（可能由后端返回更新）
  const conversationIdRef = useRef<string | undefined>(conversationIdArr?.[0])

  const fullHelpContent = '有什么我能帮你的吗？'
  const [helpContent, setHelpContent, _resetHelpContent] = useResetState((): string => '')
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const helpContentIndex = useRef(0)
  useEffect(() => {
    timer.current = setInterval(() => {
      setHelpContent(fullHelpContent.slice(0, helpContentIndex.current + 1))
      helpContentIndex.current += 1
      if (helpContentIndex.current === fullHelpContent.length) {
        clearInterval(timer.current)
        timer.current = undefined
      }
    }, 40)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [question, setQuestion, resetQuestion] = useResetState(() => '')
  const clickSend = () => {
    // 没有内容,直接退出
    if (!question.trim()) {
      return
    }

    setChatList(prevState => [...prevState, {
      question: question.trim(),
      streamingAnswer: '', // 初始化流式回答
    }])
    resetQuestion()
  }
  const [isFetching, setIsFetching, _resetIsFetching] = useResetState((): boolean => false)
  const [chatList, setChatList, resetChatList] = useResetState((): IChat[] => [])
  // 当前激活的复制按钮（点击或悬浮时显示）: 'q-0' 表示第0个问题, 'a-0' 表示第0个回答
  const [activeCopyIndex, setActiveCopyIndex] = useState<string | null>(null)
  // 滚动控制
  const {
    containerRef,
    setAutoScroll,
    showScrollBtn,
    handleScrollToBottom,
  } = useScrollControl(isFetching, [chatList])

  // 逐字渲染缓冲区
  const pendingTextRef = useRef('')
  const animFrameRef = useRef<ReturnType<typeof requestAnimationFrame> | undefined>(undefined)
  const streamEndedRef = useRef(false)

  const clearPendingText = () => {
    if (animFrameRef.current !== undefined) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = undefined
    }
    pendingTextRef.current = ''
    streamEndedRef.current = false
  }

  const flushPendingText = () => {
    if (animFrameRef.current !== undefined) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = undefined
    }
    if (pendingTextRef.current) {
      const remaining = pendingTextRef.current
      pendingTextRef.current = ''
      setChatList(prevState => {
        if (!prevState.length) return prevState
        return [
          ...prevState.slice(0, prevState.length - 1),
          {
            ...prevState.at(-1)!,
            streamingAnswer: (prevState.at(-1)?.streamingAnswer || '') + remaining,
          },
        ]
      })
    }
  }

  const startCharDrain = () => {
    if (animFrameRef.current !== undefined) return
    const drain = () => {
      if (!pendingTextRef.current.length) {
        animFrameRef.current = undefined
        streamEndedRef.current = false
        return
      }
      const bufferLen = pendingTextRef.current.length
      let charsPerFrame: number
      if (streamEndedRef.current) {
        // 流结束后加速输出，约0.3秒内输出完毕
        charsPerFrame = Math.max(3, Math.ceil(bufferLen / 20))
      } else {
        // 流进行中，自适应速度匹配后端
        charsPerFrame = Math.min(10, Math.max(1, Math.ceil(bufferLen / 5)))
      }
      const chars = pendingTextRef.current.slice(0, charsPerFrame)
      pendingTextRef.current = pendingTextRef.current.slice(charsPerFrame)
      setChatList(prevState => {
        if (!prevState.length) return prevState
        return [
          ...prevState.slice(0, prevState.length - 1),
          {
            ...prevState.at(-1)!,
            streamingAnswer: (prevState.at(-1)?.streamingAnswer || '') + chars,
          },
        ]
      })
      animFrameRef.current = requestAnimationFrame(drain)
    }
    animFrameRef.current = requestAnimationFrame(drain)
  }

  // 组件卸载时清理动画帧
  useEffect(() => {
    return () => {
      if (animFrameRef.current !== undefined) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [])

  const fetchHistory = async () => {
    const result = await baseFetch({
      url: 'ai/getHistoryById',
      method: 'post',
      data: {conversationId: conversationIdRef.current},
    })

    if (result.isOk && result.responseData?.data.list?.length) {
      // 将历史记录转换为 IChat 格式
      setChatList(result.responseData.data.list.map((item: { question: string; answer: string }) => ({
        question: item.question,
        streamingAnswer: item.answer,
      })))
    } else if (!result.isOk) {
      // conversationId 无效（过期、已删除或非法），从 URL 中移除
      conversationIdRef.current = undefined
      window.history.replaceState(null, '', '/next/chat')
    }
  }

  // 页面首次加载时获取历史会话
  useAsyncEffect(() => {
    if (!conversationIdRef.current) return
    fetchHistory()
  }, [])

  useAsyncEffect(
    () => {
      fetchQuestionWithSSE()
    },
    [chatList.length],
    {
      immediate: false,
    },
  )

  // 发送新消息时重置自动滚动
  useEffect(() => {
    if (chatList.length > 0) {
      setAutoScroll(true)
    }
  }, [chatList.length, setAutoScroll])

  const fetchQuestionAbortController = useRef<AbortController>(undefined)
  // 关闭SSE连接（统一管理，避免内存泄漏）
  const closeSSEConnection = () => {
    setIsFetching(false)
    fetchQuestionAbortController.current?.abort?.()
  }

  const clickNewChat = () => {
    clearPendingText()
    closeSSEConnection()
    resetChatList()
    setActiveCopyIndex(null)
    // 重置会话ID并更新URL（仅更新URL，不触发导航）
    conversationIdRef.current = undefined
    window.history.pushState(null, '', '/next/chat')
  }

  // 选择历史会话
  const handleSelectHistory = async (conversationId: string) => {
    clearPendingText()
    closeSSEConnection()
    resetChatList()
    setActiveCopyIndex(null)
    // 更新会话ID和URL（使用 replaceState 避免回退到上一次会话）
    conversationIdRef.current = conversationId
    window.history.replaceState(null, '', `/next/chat/${conversationId}`)
    // 获取历史数据
    await fetchHistory()
  }
  const fetchQuestionWithSSE = async () => {
    if (!chatList.length) return
    if (!chatList.at(-1)!.question) return
    // 查询id获取的,不是用户触发的
    if (chatList.at(-1)!.streamingAnswer) return

    clearPendingText()
    closeSSEConnection()

    setIsFetching(true)
    fetchQuestionAbortController.current = new AbortController()

    const result = await streamFetch<IStreamData>({
      url: '/api/ai/chat',
      data: {
        conversationId: conversationIdRef.current,
        question: chatList.at(-1)?.question,
      },
      signal: fetchQuestionAbortController.current.signal,
      onMessage: (streamData) => {
        // 后端返回新的 conversationId，更新 URL 和 ref
        if (streamData.code === 200 && streamData.data.conversationId && streamData.data.conversationId !== conversationIdRef.current) {
          conversationIdRef.current = streamData.data.conversationId
          // 仅更新 URL 供用户复制，不触发导航
          window.history.replaceState(null, '', `/next/chat/${streamData.data.conversationId}`)
          // 用户已登录时，刷新历史会话列表
          if (userStore.getSnapshot().userInfo) {
            historyStore.fetch()
          }
        }
        if (streamData.code === 200 && streamData.data.partialAnswer?.trim()) {
          pendingTextRef.current += streamData.data.partialAnswer
          startCharDrain()
        }
      },
    })

    if (!result.isOk && result.reason !== 'AbortError') {
      console.error('POST 流式请求失败：', result.reason)
      clearPendingText()
      setChatList(prevState => [
        ...prevState.slice(0, prevState.length - 1),
        {
          ...prevState.at(-1)!,
          streamingAnswer: '请求异常，请稍后重试',
        },
      ])
    }

    // 流结束，加速输出剩余缓冲内容（而非瞬间全部输出）
    if (pendingTextRef.current.length) {
      streamEndedRef.current = true
    }
    closeSSEConnection()
  }

  // 停止请求
  const clickStopFetch = () => {
    flushPendingText()
    closeSSEConnection()
  }
  useEffect(() => {
    // 配置 marked：启用代码高亮
    marked.setOptions({
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      highlight: (code, lang) => {
        // 如果指定了语言，且 highlight.js 支持该语言，则高亮
        if (lang && hljs.getLanguage(lang)) {
          try {
            return hljs.highlight(code, {language: lang}).value
          } catch (err) {
            console.error('代码高亮失败：', err)
          }
        }
        // 不支持的语言，默认高亮
        return hljs.highlightAuto(code).value
      },
      breaks: true, // 自动将 \n 转为 <br>
      gfm: true, // 支持 GitHub Flavored Markdown
    })
  }, [])
  // 辅助函数：将 Markdown 字符串转为 HTML
  // 优化 renderMarkdown 函数，增加 XSS 过滤
  const renderMarkdown = (content: string | undefined): string => {
    if (!content) return ''
    const htmlContent = marked.parse(content) as string
    const sanitized = xss(htmlContent)
    // 为表格添加可滚动容器，优化移动端显示
    return sanitized
      .replace(/<table\b[^>]*>/g, '<div class="table-wrapper">$&')
      .replace(/<\/table>/g, '</table></div>')
  }

  const textareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 1. 区分 Shift+Enter（换行） 和 纯Enter（发送）
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault() // 阻止纯Enter的默认换行行为
      clickSend() // 触发发送消息逻辑
    }
    // 当按住Shift+Enter时，不做特殊处理，保留默认换行行为
  }

  return (
    <div className={'w-full h-full flex flex-col overflow-y-auto overflow-x-hidden'}>
      {/*头部*/}
      <div className={'w-full px-4 h-12 flex justify-between items-center'}>
        {/* 左侧按钮组 */}
        <div className="flex items-center gap-2">
          {/* 汉堡菜单按钮 */}
          <button
            className="w-9 h-9 flex justify-center items-center hover:bg-[#00000012] rounded-xl"
            onClick={() => setDrawerOpen(true)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5"
                 stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"/>
            </svg>
          </button>
          {/* 新对话按钮 */}
          <button
            className="h-9 px-2 flex items-center gap-1 hover:bg-[#00000012] rounded-xl"
            onClick={clickNewChat}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5"
                 stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"/>
            </svg>
            <span className="text-sm">新对话</span>
          </button>
        </div>
        {/* 右侧登录按钮 */}
        {initialized && !userInfo && (
          <Button
            type={'primary'}
            size="large"
            style={{minWidth: 64, height: 40, color: 'white'}}
            onClick={() => setLoginModalOpen(true)}
          >登录</Button>
        )}
      </div>
      <div
        className={'w-full flex h-[calc(100%-48px)]'}
      >
        <div className={'grow min-w-0 h-full pb-5 flex flex-col justify-center items-center gap-y-6'}>
          {/* 内容区 - 全屏宽度可滚动 */}
          <div ref={containerRef}
               className={`w-full pt-5 relative flex flex-col items-center overflow-y-auto overflow-x-hidden ${chatList.length ? 'grow' : ''}`}>
            <div className="w-4/5 max-w-200 flex flex-col">
              {
                !chatList.length && (
                  <div className="w-full flex flex-col justify-center items-center gap-y-2">
                    <span className="mb-5 h-9 text-black font-bold text-2xl">{helpContent}</span>
                  </div>
                )
              }
              {
                !!chatList.length && (
                  <div className={'w-full flex flex-col gap-y-13'}>
                    {
                      chatList.map((item, index) => (
                        <ChatMessage
                          key={index}
                          question={item.question}
                          answerHtml={renderMarkdown(item.streamingAnswer)}
                          answerRaw={item.streamingAnswer}
                          index={index}
                          isAnswerComplete={!isFetching || index !== chatList.length - 1}
                          isLastItem={index === chatList.length - 1}
                          activeCopyIndex={activeCopyIndex}
                          onActiveCopyIndexChange={setActiveCopyIndex}
                        />
                      ))
                    }
                  </div>
                )
              }
            </div>
          </div>
          {/* 用户交互区 */}
          <div className={'relative w-4/5 max-w-200 rounded-2xl border border-[#e0e0e0] flex flex-col p-3'}>
            {/* 滚动到底部按钮 */}
            {(showScrollBtn) && (
              <button
                className="absolute -top-12 left-1/2 -translate-x-1/2 w-10 h-10 bg-white border border-gray-200 rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors z-10"
                onClick={handleScrollToBottom}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2}
                     stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3"/>
                </svg>
              </button>
            )}
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="询问任何问题"
              rows={4}
              className="box-border min-h-14 max-h-40 resize-none"
              onKeyDown={textareaKeyDown}
            ></textarea>
            {/*@keydown.enter.prevent="clickSend"*/}
            <div className={'flex justify-end items-center'}>
              {/* 发送按钮 */}
              <button
                className={`
              w-8 h-8 justify-center items-center rounded-full
               ${!!question ? 'bg-[#0057ff] text-white' : 'bg-[#d9d9d9] text-[#eeeeee] cursor-not-allowed'}
               ${isFetching ? 'hidden' : 'flex'}
               `}
                onClick={clickSend}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="1em"
                  height="1em"
                  fill="none"
                  viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="m3.543 8.883 7.042-7.047a2 2 0 0 1 2.828 0l7.043 7.046a1 1 0 0 1 0 1.415l-.701.701a1 1 0 0 1-1.414 0L13.3 5.956v15.792a1 1 0 0 1-1 1h-.99a1 1 0 0 1-1-1V6.342l-4.654 4.656a1 1 0 0 1-1.414 0l-.7-.7a1 1 0 0 1 0-1.415">
                  </path>
                </svg>
              </button>
              {/* 停止按钮 */}
              <button
                className={`
              w-8 h-8 justify-center items-center rounded-lg hover:bg-[#f6f6f6] text-[24px]
              ${isFetching ? 'flex' : 'hidden'}
              `}
                onClick={clickStopFetch}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="1em"
                  height="1em"
                  fill="none"
                  viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    fillRule="evenodd"
                    d="M12 23c6.075 0 11-4.925 11-11S18.075 1 12 1 1 5.925 1 12s4.925 11 11 11m0-20a9 9 0 1 1 0 18 9 9 0 0 1 0-18m-2 5.5A1.5 1.5 0 0 0 8.5 10v4a1.5 1.5 0 0 0 1.5 1.5h4a1.5 1.5 0 0 0 1.5-1.5v-4A1.5 1.5 0 0 0 14 8.5z"
                    clipRule="evenodd">
                  </path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* 登录弹窗 */}
      <LoginModal open={loginModalOpen} onClose={() => setLoginModalOpen(false)}/>
      {/* 左侧抽屉 */}
      <ChatDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        currentConversationId={conversationIdRef.current}
        onLogout={() => {
          resetChatList()
          conversationIdRef.current = undefined
        }}
        onSelectHistory={handleSelectHistory}
        onNewChat={clickNewChat}
      />
    </div>
  )
}
'use client'

import '../index.css'
import hljs from 'highlight.js'
import {marked} from 'marked'
import {useEffect, useLayoutEffect, useRef, use, useSyncExternalStore, useState} from 'react'
import 'highlight.js/styles/default.css'
import xss from 'xss'
import {userStore} from '@/store/user'
import {historyStore} from '@/store/history'
import {Button} from 'antd'
import LoginModal from '@/components/LoginModal'
import ChatDrawer from '@/components/ChatDrawer'
import CopyButton from '@/components/CopyButton'
import {useAsyncEffect} from '@/util/hooks/useEffectUtil'
import {useResetState} from '@/util/hooks/useResetState'
import {baseFetch} from '@/util/api'

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
  const connectRef = useRef<HTMLDivElement | null>(null)
  const [isFetching, setIsFetching, _resetIsFetching] = useResetState((): boolean => false)
  const [chatList, setChatList, resetChatList] = useResetState((): IChat[] => [])
  // 自动滚动控制
  const [autoScroll, setAutoScroll] = useState(true)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  // 当前激活的复制按钮（点击或悬浮时显示）: 'q-0' 表示第0个问题, 'a-0' 表示第0个回答
  const [activeCopyIndex, setActiveCopyIndex] = useState<string | null>(null)

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
  // 滚动到底部（可选平滑效果）
  const scrollToBottom = (smooth = false) => {
    if (!connectRef.current) return
    if (smooth) {
      connectRef.current.scrollTo({
        top: connectRef.current.scrollHeight,
        behavior: 'smooth',
      })
    } else {
      connectRef.current.scrollTop = connectRef.current.scrollHeight
    }
  }

  // 用户滚动事件监听
  useEffect(() => {
    const container = connectRef.current
    if (!container) return

    let lastScrollTop = container.scrollTop
    const handleScroll = () => {
      const {scrollTop, scrollHeight, clientHeight} = container
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
      const currentScrollTop = scrollTop

      // 用户向上滚动时，停止自动滚动
      if (currentScrollTop < lastScrollTop) {
        setAutoScroll(false)
      }

      // 用户手动滚动到底部时，重新激活自动滚动
      if (isAtBottom && isFetching) {
        setAutoScroll(true)
      }

      // 根据是否在底部显示/隐藏按钮
      setShowScrollBtn(!isAtBottom)

      lastScrollTop = currentScrollTop
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
     
  }, [isFetching])

  // 自动滚动到底部
  useLayoutEffect(() => {
    if (!connectRef.current || !autoScroll) return
    scrollToBottom()
  }, [chatList, autoScroll])

  // 回答完成后滚动到底部（让用户看到复制图标）
  useEffect(() => {
    if (!isFetching && autoScroll && chatList.length > 0) {
      // 延迟一下等待 DOM 更新
      setTimeout(() => scrollToBottom(), 50)
    }
  }, [isFetching, autoScroll, chatList.length])

  // 点击滚动到底部按钮
  const handleScrollToBottom = () => {
    scrollToBottom(true) // 平滑滚动
    // 如果正在输出，恢复自动滚动
    if (isFetching) {
      setAutoScroll(true)
    }
    setShowScrollBtn(false)
  }

  // 发送新消息时重置自动滚动
  useEffect(() => {
    if (chatList.length > 0) {
      setAutoScroll(true)
    }
  }, [chatList.length])
  const fetchQuestionAbortController = useRef<AbortController>(undefined)
  // 关闭SSE连接（统一管理，避免内存泄漏）
  const closeSSEConnection = () => {
    setIsFetching(false)
    fetchQuestionAbortController.current?.abort?.()
  }

  const clickNewChat = () => {
    closeSSEConnection()
    resetChatList()
    // 重置会话ID并更新URL（仅更新URL，不触发导航）
    conversationIdRef.current = undefined
    window.history.pushState(null, '', '/next/chat')
  }

  // 选择历史会话
  const handleSelectHistory = async (conversationId: string) => {
    closeSSEConnection()
    resetChatList()
    // 更新会话ID和URL
    conversationIdRef.current = conversationId
    window.history.pushState(null, '', `/next/chat/${conversationId}`)
    // 获取历史数据
    await fetchHistory()
  }
  const fetchQuestionWithSSE = async () => {
    if (!chatList.length) return
    if (!chatList.at(-1)!.question) return
    // 查询id获取的,不是用户触发的
    if (chatList.at(-1)!.streamingAnswer) return

    closeSSEConnection()

    setIsFetching(true)
    fetchQuestionAbortController.current = new AbortController()

    try {
      const api = '/api/ai/chat'
      const response = await fetch(api, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          conversationId: conversationIdRef.current,
          question: chatList.at(-1)?.question,
        }),
        signal: fetchQuestionAbortController.current.signal,
      })

      if (!response.ok || !response.body) throw new Error('请求失败')

      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''

      // 循环读取流式数据
      while (true) {
        const {done, value} = await reader.read()
        if (done) break

        buffer += decoder.decode(value, {stream: true})
        const messages = buffer.split('\n\n')
        buffer = messages.pop() || ''

        for (const msg of messages) {
          if (!msg) continue
          if (msg === 'data: [DONE]') {
            closeSSEConnection()
            return
          }
          const dataStr = msg.replace(/^data: /, '')
          const streamData: IStreamData = JSON.parse(dataStr)
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
            setChatList(prevState => [
              ...prevState.slice(0, prevState.length - 1),
              {
                ...prevState.at(-1)!,
                streamingAnswer: (prevState.at(-1)?.streamingAnswer || '') + streamData.data.partialAnswer,
              },
            ])
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        console.log('手动停止的错误')
        return
      }

      console.error('POST 流式请求失败：', (e as Error).name)
      setChatList(prevState => [
        ...prevState.slice(0, prevState.length - 1),
        {
          ...prevState.at(-1)!,
          streamingAnswer: '请求异常，请稍后重试',
        },
      ])

      closeSSEConnection()
    }
  }

  // 停止请求
  const clickStopFetch = () => {
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
    // 先解析 Markdown，再过滤危险 HTML 标签/属性
    const htmlContent = marked.parse(content) as string
    return xss(htmlContent) // 防止 XSS 攻击
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
    <div className={'w-full h-full flex flex-col overflow-auto'}>
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
        <div className={'grow h-full py-5 flex flex-col justify-center items-center gap-y-6'}>
          {/* 内容区 */}
          <div ref={connectRef}
               className={`w-4/5 max-w-200 relative flex flex-col overflow-auto ${chatList.length ? 'grow' : ''}`}>
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
                    chatList.map((item, index) => {
                      const isLastItem = index === chatList.length - 1
                      const isAnswerComplete = !isFetching || !isLastItem
                      const showQuestionCopy = activeCopyIndex === `q-${index}`
                      const showAnswerCopy = isAnswerComplete && (activeCopyIndex === `a-${index}` || isLastItem)

                      return (
                        <div
                          key={index}
                          className={'flex flex-col gap-y-13'}
                        >
                          {/* 问题 */}
                          <div
                            className={'flex flex-col items-end group'}
                            onMouseEnter={() => setActiveCopyIndex(`q-${index}`)}
                            onMouseLeave={() => setActiveCopyIndex(null)}
                            onClick={() => setActiveCopyIndex(activeCopyIndex === `q-${index}` ? null : `q-${index}`)}
                          >
                            <div className={'relative max-w-112.5 bg-[#f5f5f5] px-4 py-2.5 rounded-xl'}>
                              <span className="w-full break-all">{item.question}</span>
                              {/* 复制按钮 */}
                              {showQuestionCopy && (
                                <CopyButton text={item.question} className="absolute right-0 -bottom-6" />
                              )}
                            </div>
                          </div>
                          {/* 回答 */}
                          <div
                            className={'relative group'}
                            onMouseEnter={() => setActiveCopyIndex(`a-${index}`)}
                            onMouseLeave={() => !isLastItem && setActiveCopyIndex(null)}
                            onClick={() => setActiveCopyIndex(activeCopyIndex === `a-${index}` ? null : `a-${index}`)}
                          >
                            <div
                              className={'ai-answer-markdown'}
                              dangerouslySetInnerHTML={{__html: renderMarkdown(item.streamingAnswer)}}
                            />
                            {/* 复制按钮 */}
                            {showAnswerCopy && item.streamingAnswer && (
                              <CopyButton text={item.streamingAnswer} className="absolute left-0 -bottom-6" />
                            )}
                          </div>
                        </div>
                      )
                    })
                  }
                </div>
              )
            }
          </div>
          {/* 用户交互区 */}
          <div className={'relative w-4/5 max-w-200 rounded-2xl border border-[#e0e0e0] flex flex-col p-3'}>
            {/* 滚动到底部按钮 */}
            {(showScrollBtn) && (
              <button
                className="absolute -top-20 left-1/2 -translate-x-1/2 w-10 h-10 bg-white border border-gray-200 rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors z-10"
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
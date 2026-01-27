'use client';

import '../index.css'
import {useResetState} from "@/composables/useResetState";
import hljs from "highlight.js";
import { marked } from "marked";
import {useEffect, useLayoutEffect, useRef, use} from "react";
import 'highlight.js/styles/default.css';
import xss from "xss";
import Logo from "../icon/logo";
import EllipsisHorSvg from "@/app/chat/icon/ellipsis-hor";
import Write from "@/app/chat/icon/write";
import {useAsyncEffect} from "@/composables/useEffectUtil";

interface IChat {
  question: string;
  // 流式分片拼接的临时存储，实现实时打字机效果
  streamingAnswer?: string;
}
interface IProps {
  params: Promise<{ conversationId?: string[] }>,
}
interface IResponseData {
  // 正常情况下为200
  code: number
  // 描述信息
  msg?: string
  message?: string
  // 真正的数据
  data: Record<string, any>
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
// 历史会话响应结构
interface IHistoryResponse {
  code: number;
  msg: string;
  data: {
    conversationId: string;
    list: Array<{ question: string; answer: string }>;
  };
}

const historyChatList = [
  'Nuxt4引入SVG方式',
  'Vue React UI库推荐',
  '微前端2025现状分析',
  '多个子网站运行方式多个子网站运行方式',
  'Nuxt4引入SVG方式',
]

export default function Page(props: IProps) {
  const { conversationId: conversationIdArr } = use(props.params)
  // 可选捕获路由：/chat -> undefined, /chat/xxx -> ['xxx']
  // 保存当前会话ID（可能由后端返回更新）
  const conversationIdRef = useRef<string | undefined>(conversationIdArr?.[0])

  const fullHelpContent = '有什么我能帮你的吗？'
  const [helpContent, setHelpContent, resetHelpContent] = useResetState((): string => '')
  const timer = useRef<NodeJS.Timeout>(undefined)
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
  const [isFetching, setIsFetching, resetIsFetching] = useResetState((): boolean => false)
  const [chatList, setChatList, resetChatList] = useResetState((): IChat[] => [])

  const fetchHistory = async () => {
    try {
      const api = process.env.NODE_ENV === 'development'
        ? 'http://10.204.252.189:8080/ai/getHistoryById'
        : '/api/ai/getHistoryById'
      const response = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: conversationIdRef.current }),
      })

      if (!response.ok) return

      const result: IHistoryResponse = await response.json()
      if (result.code === 200 && result.data.list?.length) {
        // 将历史记录转换为 IChat 格式
        setChatList(result.data.list.map(item => ({
          question: item.question,
          streamingAnswer: item.answer,
        })))
      }
    } catch (e) {
      console.error('获取历史会话失败：', e)
    }
  }

  // 页面加载时获取历史会话
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
    }
  )
  useLayoutEffect(() => {
    // dom未渲染
    if (!connectRef.current) {
      return
    }

    // 计算是否处于底部（10px 容差，避免微小滚动偏差）
    // if (Math.abs(connectRef.current.scrollHeight - connectRef.current.clientHeight) >= 10) {
    //   return
    // }

    connectRef.current.scrollTop = connectRef.current.scrollHeight
  }, [chatList]);
  const fetchQuestionAbortController = useRef<AbortController>(undefined)
  // 关闭SSE连接（统一管理，避免内存泄漏）
  const closeSSEConnection = () => {
    setIsFetching(false)
    fetchQuestionAbortController.current?.abort?.()
  };

  const clickHint = (newQuestion: string) => {
    setChatList(prevState => [...prevState, {
      question: newQuestion,
      streamingAnswer: '', // 初始化流式回答
    }])
  }
  const clickNewChat = () => {
    closeSSEConnection();
    resetChatList();
    // 重置会话ID并更新URL（仅更新URL，不触发导航）
    conversationIdRef.current = undefined
    window.history.replaceState(null, '', '/next/chat')
  }
  const fetchQuestionWithSSE = async () => {
    console.log(chatList)
    if (!chatList.length) return;
    if (!chatList.at(-1)!.question) return;
    // 查询id获取的,不是用户触发的
    if (chatList.at(-1)!.streamingAnswer) return;

    closeSSEConnection();

    setIsFetching(true)
    fetchQuestionAbortController.current = new AbortController()

    try {
      const api = process.env.NODE_ENV === 'development'
        ? 'http://10.204.252.189:8080/ai/chat'
        : '/api/ai/chat'
      const response = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversationIdRef.current,
          question: chatList.at(-1)?.question,
        }),
        signal: fetchQuestionAbortController.current.signal,
      });

      if (!response.ok || !response.body) throw new Error('请求失败');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      // 循环读取流式数据
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const messages = buffer.split('\n\n');
        buffer = messages.pop() || '';

        for (const msg of messages) {
          if (!msg) continue;
          if (msg === 'data: [DONE]') {
            closeSSEConnection();
            return;
          }
          const dataStr = msg.replace(/^data: /, '');
          const streamData: IStreamData = JSON.parse(dataStr);
          // 后端返回新的 conversationId，更新 URL 和 ref
          if (streamData.code === 200 && streamData.data.conversationId && streamData.data.conversationId !== conversationIdRef.current) {
            conversationIdRef.current = streamData.data.conversationId
            // 仅更新 URL 供用户复制，不触发导航
            window.history.replaceState(null, '', `/next/chat/${streamData.data.conversationId}`)
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

      console.error('POST 流式请求失败：', (e as Error).name);
      setChatList(prevState => [
        ...prevState.slice(0, prevState.length - 1),
        {
          ...prevState.at(-1)!,
          streamingAnswer: '请求异常，请稍后重试',
        },
      ])

      closeSSEConnection();
    }
  };

  // 停止请求
  const clickStopFetch = () => {
    closeSSEConnection();
  };
  useEffect(() => {
    // 配置 marked：启用代码高亮
    marked.setOptions({
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      highlight: (code, lang) => {
        // 如果指定了语言，且 highlight.js 支持该语言，则高亮
        if (lang && hljs.getLanguage(lang)) {
          try {
            return hljs.highlight(code, { language: lang }).value;
          } catch (err) {
            console.error('代码高亮失败：', err);
          }
        }
        // 不支持的语言，默认高亮
        return hljs.highlightAuto(code).value;
      },
      breaks: true, // 自动将 \n 转为 <br>
      gfm: true, // 支持 GitHub Flavored Markdown
    });
  }, [])
  // 辅助函数：将 Markdown 字符串转为 HTML
  // 优化 renderMarkdown 函数，增加 XSS 过滤
  const renderMarkdown = (content: string | undefined): string => {
    if (!content) return '';
    // 先解析 Markdown，再过滤危险 HTML 标签/属性
    const htmlContent = marked.parse(content) as string;
    return xss(htmlContent); // 防止 XSS 攻击
  };

  const textareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 1. 区分 Shift+Enter（换行） 和 纯Enter（发送）
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // 阻止纯Enter的默认换行行为
      clickSend(); // 触发发送消息逻辑
    }
    // 当按住Shift+Enter时，不做特殊处理，保留默认换行行为
  };

  return (
    <div className={'w-full h-full flex'}>
      {/* 左侧 */}
      <div className={'hidden w-65 h-full flex-col overflow-auto bg-[#f9f9f9] border-r border-[#ededed]'}>
        <div className={'w-full px-2 flex flex-col gap-y-2'}>
          {/* 头部 */}
          <div className="h-13 flex justify-between items-center">
            {/*左侧logo*/}
            <button className="w-9 h-9 flex justify-center items-center hover:bg-[#00000012] rounded-xl">
              <div className={'w-6 h-6'}>
                <Logo/>
              </div>
            </button>
          </div>
          {/* 按钮区 */}
          <div
            className={'px-3 h-9 flex items-center gap-x-2 hover:bg-[#00000012] rounded-xl'}
            onClick={clickNewChat}
          >
            <div className={'w-5 h-5'}>
              <Write/>
            </div>
            <span>新聊天</span>
          </div>
          <span className="text-[#8f8f8f]">你的聊天</span>
          {
            historyChatList.map((item, index) => (
              <div
                key={index}
                className={'px-2 h-9 flex items-center hover:bg-[#00000012] rounded-xl group relative'}
              >
                <span className="w-full group-hover:w-48 text-sm line-clamp-1">{item}</span>
                <div className="absolute right-2 hidden group-hover:flex">
                  <div className={'w-5 h-5 cursor-pointer'}>
                    <EllipsisHorSvg/>
                  </div>
                </div>
              </div>
            ))
          }
        </div>
      </div>
      {/* 右侧 */}
      <div className={'grow h-full py-5 flex flex-col justify-center items-center gap-y-6'}>
        {/* 内容区 */}
        <div ref={connectRef}
             className={`
             w-4/5 max-w-200 flex flex-col overflow-auto
             ${chatList.length ? 'grow' : ''}
             `}
        >
          {
            !chatList.length && (
              <div className="w-full h-full flex flex-col justify-center items-center gap-y-2">
                <span className="mb-5 h-9 text-black font-bold text-2xl">{helpContent}</span>
                {/*<HintList click={clickHint}/>*/}
              </div>
            )
          }
          {
            !!chatList.length && (
              <div className={'w-full h-full flex flex-col gap-y-13'}>
                {
                  chatList.map((item, index) => (
                    <div
                      key={index}
                      className={'flex flex-col gap-y-13'}
                    >
                      {/* 问题 */}
                      <div className={'flex justify-end items-center relative'}>
                        <div className={'max-w-112.5 bg-[#f5f5f5] px-4 py-2.5 rounded-xl'}>
                          <span className="w-full break-all">{item.question}</span>
                        </div>
                      </div>
                      {/* 回答 */}
                      <div
                        className={'ai-answer-markdown'}
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(item.streamingAnswer) }}
                      />
                    </div>
                  ))
                }
              </div>
            )
          }
        </div>
        {/* 用户交互区 */}
        <div className={'w-4/5 max-w-200 rounded-2xl border border-[#e0e0e0] flex flex-col p-3'}>
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
  )
}
'use client'

import CopyButton from '@/components/CopyButton.tsx'

interface ChatMessageProps {
  /** 问题内容 */
  question: string
  /** 回答内容（Markdown 渲染后的 HTML） */
  answerHtml: string
  /** 回答原始内容（用于复制） */
  answerRaw?: string
  /** 消息索引 */
  index: number
  /** 回答是否完成 */
  isAnswerComplete: boolean
  /** 是否是最后一条消息 */
  isLastItem: boolean
  /** 当前激活的复制按钮索引 */
  activeCopyIndex: string | null
  /** 设置激活的复制按钮索引 */
  onActiveCopyIndexChange: (index: string | null) => void
}

export default function ChatMessage({
  question,
  answerHtml,
  answerRaw,
  index,
  isAnswerComplete,
  isLastItem,
  activeCopyIndex,
  onActiveCopyIndexChange,
}: ChatMessageProps) {
  const showQuestionCopy = activeCopyIndex === `q-${index}`
  const showAnswerCopy = isAnswerComplete && (activeCopyIndex === `a-${index}` || isLastItem)

  return (
    <div className={'flex flex-col gap-y-13'}>
      {/* 问题 */}
      <div
        className={'flex flex-col items-end group'}
        onMouseEnter={() => onActiveCopyIndexChange(`q-${index}`)}
        onMouseLeave={() => onActiveCopyIndexChange(null)}
        onClick={() => onActiveCopyIndexChange(activeCopyIndex === `q-${index}` ? null : `q-${index}`)}
      >
        <div className={'relative max-w-112.5 bg-[#f5f5f5] px-4 py-2.5 rounded-xl'}>
          <span className="w-full break-all">{question}</span>
          {/* 复制按钮 */}
          {showQuestionCopy && (
            <CopyButton text={question} className="absolute right-0 -bottom-6" />
          )}
        </div>
      </div>
      {/* 回答 */}
      <div
        className={'relative group'}
        onMouseEnter={() => onActiveCopyIndexChange(`a-${index}`)}
        onMouseLeave={() => !isLastItem && onActiveCopyIndexChange(null)}
        onClick={() => onActiveCopyIndexChange(activeCopyIndex === `a-${index}` ? null : `a-${index}`)}
      >
        <div
          className={'ai-answer-markdown'}
          dangerouslySetInnerHTML={{__html: answerHtml}}
        />
        {/* 复制按钮 */}
        {showAnswerCopy && answerRaw && (
          <CopyButton text={answerRaw} className="absolute left-0 -bottom-6" />
        )}
      </div>
    </div>
  )
}

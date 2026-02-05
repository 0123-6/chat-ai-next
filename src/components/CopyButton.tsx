'use client'

import {useState, useRef, useEffect} from 'react'
import {errorMessage} from '@/util/message.ts'

interface IProps {
  text: string
  className?: string
}

export default function CopyButton({text, className = ''}: IProps) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      // 清除之前的定时器
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      // 5秒后恢复
      timerRef.current = setTimeout(() => {
        setCopied(false)
      }, 5000)
    } catch (_err) {
      errorMessage('复制失败')
    }
  }

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  return (
    <button
      className={`w-6 h-6 flex items-center justify-center text-[#999] hover:text-[#666] rounded cursor-pointer ${className}`}
      onClick={handleCopy}
    >
      {copied ? (
        // 成功图标 ✓
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3AC295" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      ) : (
        // 复制图标（两个正方形重叠）
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      )}
    </button>
  )
}

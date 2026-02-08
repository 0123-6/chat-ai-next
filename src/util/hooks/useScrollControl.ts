import {useEffect, useLayoutEffect, useRef, useState} from 'react'

interface UseScrollControlOptions {
  /** 判定为"在底部"的阈值（像素） */
  threshold?: number
}

interface UseScrollControlReturn {
  /** 绑定到滚动容器的 ref */
  containerRef: React.RefObject<HTMLDivElement | null>
  /** 是否自动滚动 */
  autoScroll: boolean
  /** 设置自动滚动 */
  setAutoScroll: (value: boolean) => void
  /** 是否显示滚动到底部按钮 */
  showScrollBtn: boolean
  /** 滚动到底部 */
  scrollToBottom: (smooth?: boolean) => void
  /** 点击滚动到底部按钮的处理函数 */
  handleScrollToBottom: () => void
}

/**
 * 滚动控制 Hook
 * 用于管理聊天列表等需要自动滚动到底部的场景
 */
export function useScrollControl(
  /** 是否正在加载/获取数据 */
  isFetching: boolean,
  /** 触发自动滚动的依赖数组 */
  deps: unknown[],
  options: UseScrollControlOptions = {},
): UseScrollControlReturn {
  const {threshold = 50} = options
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const smoothScrollingRef = useRef(false)

  // 滚动到底部
  const scrollToBottom = (smooth = false) => {
    if (!containerRef.current) return
    if (smooth) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth',
      })
    } else {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }

  // 用户滚动事件监听
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let lastScrollTop = container.scrollTop
    const handleScroll = () => {
      const {scrollTop, scrollHeight, clientHeight} = container
      const isAtBottom = scrollHeight - scrollTop - clientHeight < threshold
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
  }, [isFetching, threshold])

  // 移动端触摸事件：轻触/轻滑即可禁止自动滚动
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let touchStartY = 0

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY
    }

    const handleTouchMove = (e: TouchEvent) => {
      const touchY = e.touches[0].clientY
      // 用户向上滑动（手指上移）- 2px阈值避免误触
      if (touchStartY - touchY > 2) {
        setAutoScroll(false)
      }
    }

    container.addEventListener('touchstart', handleTouchStart, {passive: true})
    container.addEventListener('touchmove', handleTouchMove, {passive: true})
    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
    }
  }, [])

  // 监听窗口大小变化（处理移动端输入面板弹起/收起）
  useEffect(() => {
    const checkScrollPosition = () => {
      requestAnimationFrame(() => {
        const container = containerRef.current
        if (!container) return
        const {scrollTop, scrollHeight, clientHeight} = container
        const isAtBottom = scrollHeight - scrollTop - clientHeight < threshold
        setShowScrollBtn(!isAtBottom)
      })
    }
    const viewport = window.visualViewport
    if (viewport) {
      viewport.addEventListener('resize', checkScrollPosition)
      return () => viewport.removeEventListener('resize', checkScrollPosition)
    }
    window.addEventListener('resize', checkScrollPosition)
    return () => window.removeEventListener('resize', checkScrollPosition)
  }, [threshold])

  // 内容变化时，检查容器是否还需要滚动，不需要则隐藏按钮
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    if (container.scrollHeight <= container.clientHeight + threshold) {
      setShowScrollBtn(false)
      setAutoScroll(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps])

  // 自动滚动到底部
  useLayoutEffect(() => {
    if (!containerRef.current || !autoScroll || smoothScrollingRef.current) return
    scrollToBottom()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, autoScroll])

  // 回答完成后滚动到底部
  useEffect(() => {
    if (!isFetching && autoScroll && deps.length > 0) {
      setTimeout(() => scrollToBottom(), 50)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFetching, autoScroll, ...deps])

  // 点击滚动到底部按钮
  const handleScrollToBottom = () => {
    scrollToBottom(true)
    setShowScrollBtn(false)
    if (isFetching) {
      // 短暂抑制即时自动滚动，让smooth动画播放
      smoothScrollingRef.current = true
      setAutoScroll(true)
      setTimeout(() => {
        smoothScrollingRef.current = false
        scrollToBottom()
      }, 400)
    }
  }

  return {
    containerRef,
    autoScroll,
    setAutoScroll,
    showScrollBtn,
    scrollToBottom,
    handleScrollToBottom,
  }
}

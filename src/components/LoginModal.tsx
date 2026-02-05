'use client'

import {Modal, Input, Button, Checkbox, Space} from 'antd'
import {useState, useEffect, useRef, useSyncExternalStore} from 'react'
import {userStore} from '@/store/user'
import {successMessage} from '@/util/message'
import {historyStore} from '@/store/history'
import {deviceStore} from '@/store/device'
import {baseFetch} from '@/util/api'

interface IProps {
  open: boolean;
  onClose: () => void;
}

type Step = 'phone' | 'code'

// 手机号验证
const isValidPhone = (phone: string) => /^1[3-9]\d{9}$/.test(phone)
// 验证码验证
const isValidCode = (code: string) => /^\d{4}$/.test(code)

export default function LoginModal({open, onClose}: IProps) {
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [codeArr, setCodeArr] = useState<string[]>(['', '', '', ''])
  const [focusIndex, setFocusIndex] = useState(0)
  const [countdown, setCountdown] = useState(60)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null])

  // 响应式：判断是否为移动端
  const isMobile = useSyncExternalStore(deviceStore.subscribe, deviceStore.getSnapshot, deviceStore.getSnapshot)

  const canSubmit = isValidPhone(phone) && agreed

  // 倒计时逻辑
  useEffect(() => {
    if (step === 'code' && countdown > 0) {
      timerRef.current = setTimeout(() => {
        setCountdown(prev => prev - 1)
      }, 1000)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [step, countdown])

  // 进入验证码步骤时自动聚焦第一个输入框
  useEffect(() => {
    if (step === 'code') {
      setTimeout(() => {
        setFocusIndex(0)
        inputRefs.current[0]?.focus()
      }, 100)
    }
  }, [step])

  // 获取验证码
  const fetchCode = async () => {
    setLoading(true)
    const result = await baseFetch({
      url: 'auth/getCode',
      method: 'post',
      data: {phone},
    })
    setLoading(false)
    if (result.isOk) {
      successMessage(result.responseData?.msg || '验证码发送成功')
      return true
    }
    return false
  }

  // 绑定会话到用户
  const bindConversationToUser = async () => {
    // 从 URL 提取 conversationId（格式：/next/chat/xxx）
    const pathMatch = window.location.pathname.match(/\/next\/chat\/([^/]+)/)
    if (!pathMatch?.[1]) return

    const conversationId = pathMatch[1]
    await baseFetch({
      url: 'ai/conversationIdToUser',
      method: 'post',
      data: {conversationId},
      showErrorMessage: false,
    })
    historyStore.fetch()
  }

  // 登录
  const login = async (loginCode: string) => {
    if (!isValidCode(loginCode)) return

    setLoading(true)
    const result = await baseFetch({
      url: 'loginByPhone',
      method: 'post',
      data: {phone, code: loginCode},
    })
    setLoading(false)

    if (result.isOk) {
      successMessage(result.responseData?.msg || '登录成功')
      await userStore.fetch()
      // 登录成功后尝试绑定当前会话
      await bindConversationToUser()
      handleClose()
    }
  }

  const handleNext = async () => {
    if (!canSubmit) return
    const success = await fetchCode()
    if (success) {
      setStep('code')
      setCountdown(60)
    }
  }

  const handleBack = () => {
    setStep('phone')
    setCodeArr(['', '', '', ''])
    setFocusIndex(0)
  }

  const handleResend = async () => {
    if (countdown > 0) return
    const success = await fetchCode()
    if (success) {
      setCountdown(60)
    }
  }

  // 处理单个验证码输入框的变化
  const handleSingleCodeChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1) // 只取最后一个数字
    const newCodeArr = [...codeArr]
    newCodeArr[index] = digit
    setCodeArr(newCodeArr)

    // 如果输入了数字，跳转到下一个框
    if (digit && index < 3) {
      setFocusIndex(index + 1)
      inputRefs.current[index + 1]?.focus()
    }

    // 检查是否完成 4 位输入
    const fullCode = newCodeArr.join('')
    if (fullCode.length === 4 && isValidCode(fullCode)) {
      login(fullCode)
    }
  }

  // 处理键盘事件
  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!codeArr[index] && index > 0) {
        // 当前框为空时，删除上一个框的内容并聚焦
        const newCodeArr = [...codeArr]
        newCodeArr[index - 1] = ''
        setCodeArr(newCodeArr)
        setFocusIndex(index - 1)
        inputRefs.current[index - 1]?.focus()
        e.preventDefault()
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      setFocusIndex(index - 1)
      inputRefs.current[index - 1]?.focus()
      e.preventDefault()
    } else if (e.key === 'ArrowRight' && index < 3) {
      setFocusIndex(index + 1)
      inputRefs.current[index + 1]?.focus()
      e.preventDefault()
    }
  }

  // 点击验证码框聚焦
  const handleCodeBoxClick = (index: number) => {
    setFocusIndex(index)
    inputRefs.current[index]?.focus()
  }

  const handleClose = () => {
    setStep('phone')
    setCodeArr(['', '', '', ''])
    setFocusIndex(0)
    setCountdown(60)
    onClose()
  }

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      footer={null}
      width={isMobile ? 300 : 400}
      centered
      destroyOnHidden
      transitionName={isMobile ? '' : undefined}
      maskTransitionName={isMobile ? '' : undefined}
    >
      {/* 手机号输入步骤 */}
      {step === 'phone' && (
        <div className="flex flex-col items-center pt-4">
          <p className="text-lg font-medium mb-6">登录后免费使用完整功能</p>

          <Space.Compact className="w-full mb-4">
            <Button size="large">+86</Button>
            <Input
              size="large"
              placeholder="请输入手机号"
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
            />
          </Space.Compact>

          <Button
            type="primary"
            size="large"
            block
            disabled={!canSubmit}
            loading={loading}
            onClick={handleNext}
          >
            下一步
          </Button>

          <div className="w-full mt-4">
            <Checkbox
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
            >
              <span className="text-sm text-gray-600">
                已阅读并同意{' '}
                <a className="text-blue-500">用户协议</a>、
                <a className="text-blue-500">隐私政策</a>
              </span>
            </Checkbox>
          </div>
        </div>
      )}

      {/* 验证码输入步骤 */}
      {step === 'code' && (
        <div className="flex flex-col items-center pt-4">
          {/* 返回按钮和标题 */}
          <div className="w-full flex items-center gap-2 mb-6">
            <Button
              type="text"
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="none" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M16.293 2.293a1 1 0 0 1 0 1.414L8 12l8.293 8.293a1 1 0 0 1-1.414 1.414l-8.293-8.293a2 2 0 0 1 0-2.828l8.293-8.293a1 1 0 0 1 1.414 0"></path>
                </svg>
              }
              onClick={handleBack}
            />
            <span className="text-lg font-medium">输入 4 位验证码</span>
          </div>

          {/* 提示信息 */}
          <p className="text-gray-500 mb-6">验证码已发送至 +86 {phone}</p>

          {/* 验证码输入框 */}
          <div className="w-full flex justify-center gap-2 mb-4">
            {[0, 1, 2, 3].map(index => (
              <div
                key={index}
                className={`
                  w-12 h-14 border rounded flex items-center justify-center text-2xl font-medium cursor-text
                  ${focusIndex === index ? 'border-blue-500' : 'border-gray-300'}
                `}
                onClick={() => handleCodeBoxClick(index)}
              >
                <input
                  ref={el => { inputRefs.current[index] = el }}
                  type="text"
                  inputMode="numeric"
                  value={codeArr[index]}
                  onChange={e => handleSingleCodeChange(index, e.target.value)}
                  onKeyDown={e => handleCodeKeyDown(index, e)}
                  onFocus={() => setFocusIndex(index)}
                  className="w-full h-full text-center text-2xl font-medium outline-none bg-transparent"
                  maxLength={1}
                />
              </div>
            ))}
          </div>

          {/* 重新发送 */}
          <p className="text-sm text-gray-500">
            {countdown > 0 ? (
              <span>重新发送 {countdown}s</span>
            ) : (
              <a className="text-blue-500 cursor-pointer" onClick={handleResend}>重新发送</a>
            )}
          </p>
        </div>
      )}
    </Modal>
  )
}

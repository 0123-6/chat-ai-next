'use client';

import {Modal, Input, Button, Checkbox, Space} from 'antd';
import {useState, useEffect, useRef} from 'react';
import {userStore} from '@/store/user';
import {errorMessage, successMessage} from '@/util/message';

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
  const [code, setCode] = useState('')
  const [countdown, setCountdown] = useState(60)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<NodeJS.Timeout>(undefined)
  const inputRef = useRef<HTMLInputElement>(null)

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

  // 进入验证码步骤时自动聚焦
  useEffect(() => {
    if (step === 'code') {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [step])

  // 获取验证码
  const fetchCode = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/auth/getCode', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({phone}),
      })
      const result = await response.json()
      if (result.code === 200) {
        successMessage(result.msg || '验证码发送成功')
        return true
      } else {
        errorMessage(result.msg || '验证码发送失败')
        return false
      }
    } catch (e) {
      errorMessage('网络错误')
      return false
    } finally {
      setLoading(false)
    }
  }

  // 登录
  const login = async (loginCode: string) => {
    if (!isValidCode(loginCode)) return

    try {
      setLoading(true)
      const response = await fetch('/api/loginByPhone', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({phone, code: loginCode}),
      })
      const result = await response.json()
      if (result.code === 200) {
        successMessage(result.msg || '登录成功')
        await userStore.fetch()
        handleClose()
      } else {
        errorMessage(result.msg || '登录失败')
      }
    } catch (e) {
      errorMessage('网络错误')
    } finally {
      setLoading(false)
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
    setCode('')
  }

  const handleResend = async () => {
    if (countdown > 0) return
    const success = await fetchCode()
    if (success) {
      setCountdown(60)
    }
  }

  const handleCodeChange = (value: string) => {
    const newCode = value.replace(/\D/g, '').slice(0, 4)
    setCode(newCode)
    // 输入完成 4 位自动提交
    if (newCode.length === 4) {
      login(newCode)
    }
  }

  const handleClose = () => {
    setStep('phone')
    setCode('')
    setCountdown(60)
    onClose()
  }

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      footer={null}
      width={400}
      centered
      destroyOnHidden
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
          <div
            className="w-full flex justify-center gap-2 mb-4 cursor-text"
            onClick={() => inputRef.current?.focus()}
          >
            {[0, 1, 2, 3].map(index => (
              <div
                key={index}
                className={`
                  w-12 h-14 border rounded flex items-center justify-center text-2xl font-medium
                  ${index === code.length ? 'border-blue-500' : 'border-gray-300'}
                `}
              >
                {code[index] || ''}
              </div>
            ))}
          </div>

          {/* 隐藏的输入框 */}
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={code}
            onChange={e => handleCodeChange(e.target.value)}
            className="opacity-0 h-0 w-0 absolute"
          />

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

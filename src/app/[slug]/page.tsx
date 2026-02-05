'use client'

import {useRouter} from 'next/navigation'

export default function Page() {
  const router = useRouter()

  return (
    <div className={'w-dvw h-dvh flex flex-col gap-y-2 items-start'}>
      <span className="text-4xl">404页面</span>
      <button onClick={() => router.replace('/')}>跳转到首页</button>
    </div>
  )
}

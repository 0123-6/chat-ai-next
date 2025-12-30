'use client';

import { useRouter } from "next/navigation";

 // 关键：放在文件最顶部，标记为客户端组件

export default function Page() {
  const router = useRouter()

  const goIndexPage = () => {
    router.replace('/')
  }

  return (
    <div className={'w-screen h-screen flex flex-col gap-y-2 items-start'}>
      <span className="text-4xl">404页面</span>
      <button onClick={() => goIndexPage()}>跳转到首页</button>
    </div>
  )
}
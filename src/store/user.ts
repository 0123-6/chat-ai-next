import type {IUseSyncExternalStoreProps} from '@/util/hooks/IUseSyncExternalStoreProps'
import {baseFetch} from '@/util/api.ts'

// 用户信息类型
export interface IUserInfo {
  // 账号，唯一标识
  account: string;
  // 昵称
  nickname?: string;
  // 手机号，唯一
  phone?: string;
  // 状态
  status: 'normal' | 'disabled';
}

type IProps = IUseSyncExternalStoreProps<IUserInfo | null> & {
  fetch: () => Promise<void>,
  isInitialized: () => boolean,
}

let userObject: IUserInfo | null = null
let initialized = false
const subSet = new Set<() => void>()

export const userStore: IProps = {
  subscribe: sub => {
    subSet.add(sub)

    return () => {
      subSet.delete(sub)
    }
  },
  getSnapshot: () => userObject,
  set: (newUser: IUserInfo | null) => {
    if (userObject === newUser) {
      return
    }

    userObject = newUser
    for (const sub of subSet) {
      sub()
    }
    if (userObject) {
      initialized = true
    }
  },
  isInitialized: () => initialized,
  // 获取用户信息
  fetch: async () => {
    const baseFetchObject = await baseFetch({
      url: 'user/getUserInfo',
    })
    if (!baseFetchObject.isOk) {
      return
    }

    userStore.set(baseFetchObject.responseData.data as IUserInfo)
  },
}
// 仅在客户端执行
if (typeof window !== 'undefined') {
  userStore.fetch()
}
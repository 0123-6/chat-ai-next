import type {IUseSyncExternalStoreProps} from '@/util/hooks/IUseSyncExternalStoreProps.ts'
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
interface IUserStore {
  userInfo: IUserInfo,
  initialized: boolean,
}

type IProps = IUseSyncExternalStoreProps<IUserStore> & {
  fetch: () => Promise<void>,
  set: (value: IUserStore | null) => void,
}

let storeObject: IUserStore = {
  userInfo: null,
  initialized: false,
}
const subSet = new Set<() => void>()

export const userStore: IProps = {
  subscribe: sub => {
    subSet.add(sub)
    return () => {
      subSet.delete(sub)
    }
  },
  getSnapshot: () => storeObject,
  set: (newUserStore: IUserStore | null) => {
    // 支持传入 null 来清除用户信息（退出登录场景）
    if (newUserStore === null) {
      storeObject = {
        userInfo: null,
        initialized: true,
      }
    } else {
      storeObject = {
        userInfo: newUserStore.userInfo,
        initialized: newUserStore.initialized,
      }
    }
    for (const sub of subSet) {
      sub()
    }
  },
  // 获取用户信息
  fetch: async () => {
    const baseFetchObject = await baseFetch({
      url: 'user/getUserInfo',
      showErrorMessage: false,
    })
    userStore.set({
      userInfo: baseFetchObject.responseData?.data as IUserInfo,
      initialized: true,
    })
  },
}
// 仅在客户端执行
if (typeof window !== 'undefined') {
  userStore.fetch()
}
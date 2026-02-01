import {IUseSyncExternalStoreProps} from "@/util/hooks/IUseSyncExternalStoreProps";

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
}

let userObject: IUserInfo | null = null
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
    userObject = newUser
    for (const sub of subSet) {
      sub()
    }
  },
  // 获取用户信息
  fetch: async () => {
    // 用户信息已经存在
    if (userStore.getSnapshot()) {
      return
    }

    // 获取用户信息
    const api = process.env.NODE_ENV === 'development'
      ? 'http://localhost:8080/user/getUserInfo'
      : '/api/user/getUserInfo';

    const response = await fetch(api, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (!response.ok) return
    const result = await response.json()

    userStore.set(result.responseData.data as IUserInfo)
  },
}
userStore.fetch()
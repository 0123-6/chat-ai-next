import type {IUseSyncExternalStoreProps} from '@/util/hooks/IUseSyncExternalStoreProps'
import {baseFetch} from '@/util/api'
import {errorMessage, successMessage} from '@/util/message'

// 历史会话类型
export interface IHistory {
  conversationId: string;
  title: string;
}

type IProps = IUseSyncExternalStoreProps<IHistory[]> & {
  fetch: () => Promise<void>,
  delete: (conversationId: string) => void,
  rename: (conversationId: string, title: string) => Promise<boolean>,
}

let historyList: IHistory[] = []
const subSet = new Set<() => void>()

export const historyStore: IProps = {
  subscribe: sub => {
    subSet.add(sub)
    return () => {
      subSet.delete(sub)
    }
  },
  getSnapshot: () => historyList,
  set: (newList: IHistory[]) => {
    if (historyList === newList) {
      return
    }

    historyList = newList
    for (const sub of subSet) {
      sub()
    }
  },
  // 获取历史会话列表
  fetch: async () => {
    const baseFetchObject = await baseFetch({
      url: 'ai/getHistoryByUser',
    })
    if (!baseFetchObject.isOk) {
      return
    }

    historyStore.set(baseFetchObject.responseData.data as IHistory[])
  },
  // 删除会话
  delete: async (conversationId: string) => {
    const baseFetchObject = await baseFetch({
      url: 'ai/deleteConversationId',
      data: {
        conversationId,
      },
    })
    if (!baseFetchObject.isOk) {
      errorMessage(baseFetchObject.reason ?? '删除失败')
    }

    // 原地更新数据
    historyStore.set(historyList.filter(item => item.conversationId !== conversationId))
    successMessage('删除成功')
  },
  // 重命名会话
  rename: async (conversationId: string, title: string) => {
    const baseFetchObject = await baseFetch({
      url: 'ai/renameConversationId',
      data: {
        conversationId,
        newTitle: title,
      },
    })
    if (!baseFetchObject.isOk) {
      errorMessage('重命名失败')
      return false
    }

    successMessage('重命名成功')
    // 原地更新数据
    historyStore.set(historyList.map(item =>
      item.conversationId === conversationId ? { ...item, title } : item,
    ))
    return true
  },
}

'use client'

import {useEffect, useState, useSyncExternalStore} from 'react'
import {useRouter} from 'next/navigation'
import {Button, Drawer, Dropdown, Input, Modal} from 'antd'
import type {MenuProps} from 'antd'
import {userStore} from '@/store/user.ts'
import {historyStore, type IHistory} from '@/store/history.ts'
import {deviceStore} from '@/store/device.ts'
import EllipsisHorSvg from '@/app/chat/icon/ellipsis-hor.tsx'
import Write from '@/app/chat/icon/write.tsx'
import {errorMessage, successMessage} from '@/util/message.ts'
import {baseFetch} from '@/util/api.ts'

interface IProps {
  open: boolean;
  onClose: () => void;
  currentConversationId?: string;
  onLogout?: () => void;
  onSelectHistory?: (conversationId: string) => void;
  onNewChat?: () => void;
}

export default function ChatDrawer({open, onClose, currentConversationId, onLogout, onSelectHistory, onNewChat}: IProps) {
  const router = useRouter()
  const {
    userInfo,
  } = useSyncExternalStore(userStore.subscribe, userStore.getSnapshot, userStore.getSnapshot)
  const historyList = useSyncExternalStore(historyStore.subscribe, historyStore.getSnapshot, historyStore.getSnapshot)
  const isMobile = useSyncExternalStore(deviceStore.subscribe, deviceStore.getSnapshot, deviceStore.getSnapshot)

  // 登录后获取历史会话
  useEffect(() => {
    if (userInfo) {
      historyStore.fetch()
    }
  }, [userInfo])

  // 重命名弹窗状态
  const [renameModalOpen, setRenameModalOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<IHistory | null>(null)
  const [newTitle, setNewTitle] = useState('')

  // 点击历史记录
  const handleClickHistory = (item: IHistory) => {
    onClose()
    onSelectHistory?.(item.conversationId)
  }

  // 新建聊天
  const handleNewChat = () => {
    onClose()
    onNewChat?.()
  }

  // 删除会话
  const handleDelete = (item: IHistory) => {
    // 不能删除当前正在查看的会话
    if (item.conversationId === currentConversationId) {
      errorMessage('不能删除当前会话')
      return
    }
    Modal.confirm({
      title: '删除会话',
      content: `确定要删除「${item.title}」吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      centered: true,
      width: isMobile ? 280 : 400,
      transitionName: isMobile ? '' : undefined,
      maskTransitionName: isMobile ? '' : undefined,
      okButtonProps: {size: 'large'},
      cancelButtonProps: {size: 'large'},
      onOk: () => {
        historyStore.delete(item.conversationId)
      },
    })
  }

  // 打开重命名弹窗
  const handleOpenRename = (item: IHistory) => {
    setRenameTarget(item)
    setNewTitle(item.title)
    setRenameModalOpen(true)
  }

  // 确认重命名
  const handleRename = async () => {
    if (!renameTarget || !newTitle.trim()) return
    const success = await historyStore.rename(renameTarget.conversationId, newTitle.trim())
    if (success) {
      setRenameModalOpen(false)
      setRenameTarget(null)
      setNewTitle('')
    }
  }

  // 操作菜单
  const getMenuItems = (item: IHistory): MenuProps['items'] => [
    {
      key: 'rename',
      label: '重命名',
      onClick: () => handleOpenRename(item),
    },
    {
      key: 'delete',
      label: '删除',
      danger: true,
      onClick: () => handleDelete(item),
    },
  ]

  // 退出登录
  const handleLogout = () => {
    Modal.confirm({
      title: '退出登录',
      content: '确定要退出登录吗？',
      okText: '退出',
      okType: 'danger',
      cancelText: '取消',
      centered: true,
      width: isMobile ? 280 : 400,
      transitionName: isMobile ? '' : undefined,
      maskTransitionName: isMobile ? '' : undefined,
      okButtonProps: {size: 'large'},
      cancelButtonProps: {size: 'large'},
      onOk: async () => {
        const result = await baseFetch({
          url: 'logout',
          method: 'post',
        })
        if (result.isOk) {
          successMessage('已退出登录')
          userStore.set(null)
          historyStore.set([])
          onLogout?.()
          onClose()
          router.push('/chat')
        }
      },
    })
  }

  return (
    <>
      <Drawer
        title={null}
        placement="left"
        closable={false}
        onClose={onClose}
        open={open}
        styles={{
          wrapper: {width: isMobile ? 280 : 320},
          body: {padding: 0},
        }}
      >
        <div className="h-full flex flex-col bg-[#f9f9f9]">
          {/* 新建聊天按钮 */}
          <div className="px-2 py-2">
            <div
              className="px-3 h-10 flex items-center gap-x-2 hover:bg-[#00000012] rounded-xl cursor-pointer"
              onClick={handleNewChat}
            >
              <div className="w-5 h-5">
                <Write />
              </div>
              <span>新对话</span>
            </div>
          </div>

          {/* 历史会话列表 */}
          <div className="flex-1 overflow-auto px-2">
            {userInfo && (
              <>
                <span className="px-2 text-sm text-[#8f8f8f]">历史会话</span>
                <div className="mt-2 flex flex-col gap-y-1">
                  {historyList.map(item => (
                    <div
                      key={item.conversationId}
                      className={`
                        px-3 h-10 flex items-center gap-x-2 hover:bg-[#00000012] rounded-xl group relative cursor-pointer
                        ${item.conversationId === currentConversationId ? 'bg-[#00000012]' : ''}
                      `}
                      onClick={() => handleClickHistory(item)}
                    >
                      <span className="flex-1 text-sm line-clamp-1 break-all">{item.title}</span>
                      <div
                        onClick={e => e.stopPropagation()}
                      >
                        <Dropdown
                          menu={{items: getMenuItems(item)}}
                          trigger={['click']}
                          placement="bottomRight"
                        >
                          <div className="w-6 h-6 flex items-center justify-center hover:bg-[#00000012] rounded cursor-pointer">
                            <EllipsisHorSvg />
                          </div>
                        </Dropdown>
                      </div>
                    </div>
                  ))}
                  {historyList.length === 0 && (
                    <div className="px-3 py-4 text-sm text-gray-400">暂无历史会话</div>
                  )}
                </div>
              </>
            )}
            {!userInfo && (
              <div className="px-3 py-4 text-sm text-gray-400">登录后查看历史会话</div>
            )}
          </div>

          {/* 底部用户信息（仅登录后显示） */}
          {userInfo && (
            <div className="w-full flex justify-between items-center px-4 py-4 border-t border-[#ededed]">
              <div className="flex items-center gap-3">
                {/* 头像 */}
                <div className="w-10 h-10 rounded-full bg-[#0057ff] flex items-center justify-center text-white font-medium">
                  {userInfo?.nickname?.[0] || userInfo?.phone?.[0] || 'U'}
                </div>
                <div className="flex flex-col">
                  <span className="font-medium">{userInfo?.nickname || '用户'}</span>
                  <span className="text-sm text-gray-500">{userInfo?.phone}</span>
                </div>
              </div>
              <Button type="text" danger onClick={handleLogout}>
                退出登录
              </Button>
            </div>
          )}
        </div>
      </Drawer>

      {/* 重命名弹窗 */}
      <Modal
        title="重命名会话"
        open={renameModalOpen}
        onOk={handleRename}
        onCancel={() => {
          setRenameModalOpen(false)
          setRenameTarget(null)
          setNewTitle('')
        }}
        okText="确定"
        cancelText="取消"
        centered
        width={isMobile ? 280 : 400}
        transitionName={isMobile ? '' : undefined}
        maskTransitionName={isMobile ? '' : undefined}
        okButtonProps={{size: 'large'}}
        cancelButtonProps={{size: 'large'}}
      >
        <Input
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          placeholder="请输入新标题"
          maxLength={50}
          size="large"
        />
      </Modal>
    </>
  )
}

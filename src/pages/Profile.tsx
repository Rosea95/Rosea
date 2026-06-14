import { List, Button, Toast, Input } from 'antd-mobile'
import { Dialog } from 'antd-mobile'
import { UserOutline, SetOutline, BellOutline, QuestionCircleOutline, EyeOutline, CouponOutline, HandPayCircleOutline, KeyOutline, CloseOutline } from 'antd-mobile-icons'
import { getDB } from '../utils/db'
import { STORAGE_KEYS } from '../config/deepseek'
import { backupToLocalStorage, restoreFromLocalStorage, exportDataToFile, importDataFromFile, getBackupTime, getDataStats } from '../utils/backup'
import { useState, useEffect, useRef } from 'react'
import './Profile.css'

interface MenuItem {
  id: string
  icon: React.ComponentType<{ style?: React.CSSProperties; fontSize?: string | number }>
  title: string
  desc: string
}

function Profile() {
  const [apiKey, setApiKey] = useState('')
  const [backupTime, setBackupTime] = useState<string | null>(null)
  const [dataStats, setDataStats] = useState<{ todos: number; financeRecords: number; diary: number; health: number; messages: number }>({ todos: 0, financeRecords: 0, diary: 0, health: 0, messages: 0 })
  const [showFeatureGuide, setShowFeatureGuide] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 示例语句
  const exampleSentences = [
    '明天下午3点开会',
    '每周一三五早上7点跑步，坚持2周',
    '午餐花了30元',
    '今天心情不错',
    '跑步30分钟',
  ]

  // 页面加载时，从LocalStorage读取API Key和备份信息
  useEffect(() => {
    const savedKey = localStorage.getItem(STORAGE_KEYS.DEEPSEEK_API_KEY) || ''
    setApiKey(savedKey)
    setBackupTime(getBackupTime())
    loadDataStats()
    // 检查是否首次打开或从未看过功能引导
    const dismissed = localStorage.getItem(STORAGE_KEYS.FEATURE_GUIDE_DISMISSED)
    if (!dismissed) {
      setShowFeatureGuide(true)
    }
  }, [])

  // 关闭功能引导
  const handleDismissFeatureGuide = () => {
    localStorage.setItem(STORAGE_KEYS.FEATURE_GUIDE_DISMISSED, 'true')
    setShowFeatureGuide(false)
  }

  // 重新显示功能引导
  const handleShowFeatureGuide = () => {
    setShowFeatureGuide(true)
  }

  // 加载数据统计
  const loadDataStats = async () => {
    const stats = await getDataStats()
    setDataStats(stats)
  }

  // 保存API Key到LocalStorage
  const handleSaveApiKey = () => {
    if (!apiKey.trim()) {
      Toast.show({
        content: '请输入API Key',
        duration: 2000,
      })
      return
    }

    localStorage.setItem(STORAGE_KEYS.DEEPSEEK_API_KEY, apiKey.trim())
    Toast.show({
      content: 'API Key已保存',
      duration: 2000,
    })
  }

  const menuItems: MenuItem[] = [
    { id: '0', icon: KeyOutline, title: 'DeepSeek API Key', desc: '配置AI智能解析' },
    { id: '1', icon: BellOutline, title: '通知设置', desc: '管理消息通知' },
    { id: '2', icon: CouponOutline, title: '深色模式', desc: '切换外观' },
    { id: '3', icon: HandPayCircleOutline, title: '主题设置', desc: '自定义颜色' },
    { id: '4', icon: EyeOutline, title: '隐私安全', desc: '保护你的数据' },
    { id: '5', icon: QuestionCircleOutline, title: '帮助与反馈', desc: '获取帮助' },
    { id: '6', icon: SetOutline, title: '系统设置', desc: '更多选项' },
    { id: '7', icon: SetOutline, title: '功能速览', desc: '查看聊天示例' },
  ]

  // 清空所有数据
  const handleClearAllData = async () => {
    // 第一次确认
    const firstConfirm = await Dialog.confirm({
      content: '确定要清空所有数据吗？\n这将删除所有聊天记录和待办事项。',
      confirmText: '确定清空',
      cancelText: '取消',
    })

    if (!firstConfirm) {
      return
    }

    // 第二次确认（更明显的警告）
    const secondConfirm = await Dialog.confirm({
      content: '⚠️ 此操作不可逆！\n\n请再次确认：\n• 将删除所有聊天记录\n• 将删除所有待办事项\n\n是否继续？',
      confirmText: '确认删除',
      cancelText: '取消',
      style: { '--color': '#d4a5a5' } as React.CSSProperties,
    })

    if (!secondConfirm) {
      return
    }

    // 执行删除
    try {
      const db = await getDB()
      
      // 清空所有表
      await db.clear('messages')  // 清空聊天记录
      await db.clear('todos')     // 清空待办事项
      
      // 显示成功提示
      await Dialog.alert({
        content: '✅ 所有数据已清空！\n\n• 聊天记录：已删除\n• 待办事项：已删除',
        confirmText: '知道了',
      })

      // 提示用户刷新页面
      setTimeout(() => {
        window.location.reload()
      }, 1000)
      
    } catch (error) {
      console.error('清空数据失败:', error)
      await Dialog.alert({
        content: '❌ 清空数据失败，请稍后重试。',
        confirmText: '确定',
      })
    }
  }

  // 重置测试数据（只用于开发测试）
  const handleResetTestData = async () => {
    // 使用浏览器原生确认框
    const confirmed = window.confirm('确定要清空所有数据吗？')
    
    if (!confirmed) {
      return
    }

    try {
      const db = await getDB()
      
      // 清空所有表
      await db.clear('messages')  // 清空聊天记录
      await db.clear('todos')     // 清空待办事项
      
      // 使用轻提示显示成功信息
      Toast.show({
        content: '数据已清空',
        duration: 2000,
      })

      // 刷新当前页面
      setTimeout(() => {
        window.location.reload()
      }, 500)
      
    } catch (error) {
      // 只在控制台打印错误，不影响页面
      console.error('重置测试数据失败:', error)
    }
  }

  // 从备份恢复数据
  const handleRestoreBackup = async () => {
    const confirmed = await Dialog.confirm({
      content: '确定要从备份恢复数据吗？\n这将覆盖当前所有数据。',
      confirmText: '确定恢复',
      cancelText: '取消',
    })

    if (!confirmed) return

    const success = await restoreFromLocalStorage()
    if (success) {
      Toast.show({ content: '数据已恢复', duration: 2000 })
      setTimeout(() => window.location.reload(), 500)
    } else {
      Toast.show({ content: '恢复失败，没有找到备份', duration: 2000 })
    }
  }

  // 导出数据
  const handleExportData = async () => {
    await exportDataToFile()
    Toast.show({ content: '数据已导出', duration: 2000 })
  }

  // 导入数据
  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const confirmed = await Dialog.confirm({
      content: '确定要导入数据吗？\n这将覆盖当前所有数据。',
      confirmText: '确定导入',
      cancelText: '取消',
    })

    if (!confirmed) return

    const success = await importDataFromFile(file)
    if (success) {
      Toast.show({ content: '数据已导入', duration: 2000 })
      setTimeout(() => window.location.reload(), 500)
    } else {
      Toast.show({ content: '导入失败，文件格式无效', duration: 2000 })
    }
    
    // 清空文件输入
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // 手动备份
  const handleManualBackup = async () => {
    await backupToLocalStorage()
    setBackupTime(getBackupTime())
    Toast.show({ content: '备份成功', duration: 2000 })
  }

  return (
    <div className="page-container">
      <div className="page-header" style={{ backgroundColor: '#c9a997', padding: '32px 20px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ 
            width: '80px', 
            height: '80px', 
            borderRadius: '50%', 
            backgroundColor: '#dcc8b8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '16px'
          }}>
            <UserOutline style={{ color: '#ffffff', fontSize: '40px' }} />
          </div>
          <div>
            <h1 className="page-title" style={{ color: '#ffffff' }}>Rosea</h1>
            <p className="page-subtitle" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>欢迎回来</p>
          </div>
        </div>
      </div>

      {/* 功能速览卡片 */}
      {showFeatureGuide && (
        <div className="card" style={{ backgroundColor: '#fff9f0', border: '1px solid #e8d4c4' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#4a4a4a' }}>
              💡 功能速览
            </div>
            <CloseOutline style={{ color: '#b5b5b5', fontSize: '18px', cursor: 'pointer' }} onClick={handleDismissFeatureGuide} />
          </div>
          <p style={{ fontSize: '12px', color: '#8b8b8b', margin: '0 0 12px 0' }}>
            你可以对聊天框说：
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {exampleSentences.map((sentence, index) => (
              <div
                key={index}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  fontSize: '13px',
                  color: '#5a5a5a',
                  border: '1px solid #e8e4dd',
                }}
              >
                "{sentence}"
              </div>
            ))}
          </div>
          <div style={{ fontSize: '11px', color: '#b5b5b5', marginTop: '12px', textAlign: 'center' }}>
            关闭后可在"我的"页面重新打开
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 600, color: '#4a4a4a' }}>128</div>
            <div style={{ fontSize: '12px', color: '#8b8b8b', marginTop: '4px' }}>完成任务</div>
          </div>
          <div style={{ width: '1px', backgroundColor: '#e8e4dd' }} />
          <div>
            <div style={{ fontSize: '20px', fontWeight: 600, color: '#4a4a4a' }}>32</div>
            <div style={{ fontSize: '12px', color: '#8b8b8b', marginTop: '4px' }}>好友</div>
          </div>
          <div style={{ width: '1px', backgroundColor: '#e8e4dd' }} />
          <div>
            <div style={{ fontSize: '20px', fontWeight: 600, color: '#4a4a4a' }}>156</div>
            <div style={{ fontSize: '12px', color: '#8b8b8b', marginTop: '4px' }}>积分</div>
          </div>
        </div>
      </div>

      {/* DeepSeek API Key 设置 */}
      <div className="card">
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <KeyOutline style={{ color: '#c9a997', fontSize: '18px', marginRight: '8px' }} />
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#4a4a4a' }}>DeepSeek API Key</span>
          </div>
          <p style={{ fontSize: '12px', color: '#8b8b8b', margin: '0 0 12px 0' }}>
            用于AI智能解析功能，请从 DeepSeek 平台获取
          </p>
          <Input
            placeholder="sk-xxxxxxxxxxxxxxxx"
            value={apiKey}
            onChange={setApiKey}
            type="password"
            style={{ 
              backgroundColor: '#f8f6f1',
              borderRadius: '8px',
              fontSize: '13px'
            }}
          />
          <Button
            color="primary"
            size="small"
            onClick={handleSaveApiKey}
            style={{ 
              marginTop: '12px',
              backgroundColor: '#c9a997',
              borderColor: '#c9a997',
              borderRadius: '8px',
              width: '100%'
            }}
          >
            保存 API Key
          </Button>
          {apiKey && (
            <p style={{ fontSize: '11px', color: '#4CAF50', margin: '8px 0 0 0' }}>
              ✓ API Key 已配置
            </p>
          )}
        </div>
      </div>

      <div className="card">
        <List>
          {menuItems.map((item) => (
            <List.Item
              key={item.id}
              prefix={<item.icon style={{ color: '#c9a997', fontSize: '20px' }} />}
              description={item.desc}
              arrowIcon
              onClick={() => {
                if (item.id === '7') {
                  handleShowFeatureGuide()
                }
              }}
            >
              {item.title}
            </List.Item>
          ))}
        </List>
      </div>

      {/* 数据管理区域 */}
      <div className="card">
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#4a4a4a', marginBottom: '8px' }}>
            📦 数据管理
          </div>
          <p style={{ fontSize: '12px', color: '#8b8b8b', margin: '0 0 8px 0' }}>
            待办: {dataStats.todos} | 记账: {dataStats.financeRecords} | 日记: {dataStats.diary} | 健康: {dataStats.health}
          </p>
          {backupTime && (
            <p style={{ fontSize: '11px', color: '#4CAF50', margin: '0 0 12px 0' }}>
              ✓ 上次备份: {backupTime}
            </p>
          )}
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <Button
            size="small"
            style={{ backgroundColor: '#c9a997', color: '#fff', borderRadius: '8px', border: 'none' }}
            onClick={handleManualBackup}
          >
            手动备份
          </Button>
          <Button
            size="small"
            style={{ backgroundColor: '#dcc8b8', color: '#fff', borderRadius: '8px', border: 'none' }}
            onClick={handleRestoreBackup}
          >
            从备份恢复
          </Button>
          <Button
            size="small"
            style={{ backgroundColor: '#e8e4dd', color: '#4a4a4a', borderRadius: '8px', border: 'none' }}
            onClick={handleExportData}
          >
            导出数据
          </Button>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImportData}
            />
            <Button
              size="small"
              style={{ backgroundColor: '#e8e4dd', color: '#4a4a4a', borderRadius: '8px', border: 'none', width: '100%' }}
              onClick={() => fileInputRef.current?.click()}
            >
              导入数据
            </Button>
          </div>
        </div>
      </div>

      <div style={{ padding: '12px' }}>
        <Button 
          color="danger"
          style={{ 
            borderColor: '#d4a5a5',
            color: '#d4a5a5',
            width: '100%',
            borderRadius: '12px',
            marginBottom: '12px'
          }}
          onClick={handleClearAllData}
        >
          清空所有数据
        </Button>
        
        <Button 
          color="default"
          style={{ 
            borderColor: '#e8e4dd',
            color: '#8b8b8b',
            width: '100%',
            borderRadius: '12px'
          }}
          onClick={() => {}}
        >
          退出登录
        </Button>
      </div>

      <div style={{ textAlign: 'center', padding: '20px', color: '#b5b5b5', fontSize: '12px' }}>
        Rosea v1.0.0
      </div>

      {/* API用量参考链接 */}
      <div style={{ textAlign: 'center', padding: '0 20px 10px' }}>
        <a 
          href="https://api-docs.deepseek.com/" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{
            color: '#c9a997',
            fontSize: '12px',
            textDecoration: 'none',
          }}
        >
          API 用量参考
        </a>
      </div>

      {/* 重置测试数据按钮（用灰色小字，不显眼） */}
      <div style={{ textAlign: 'center', padding: '0 20px 20px' }}>
        <button
          onClick={handleResetTestData}
          style={{
            background: 'none',
            border: 'none',
            color: '#c0c0c0',
            fontSize: '12px',
            cursor: 'pointer',
            padding: '8px',
          }}
        >
          重置测试数据
        </button>
      </div>
    </div>
  )
}

export default Profile
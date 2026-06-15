import { useState, useEffect } from 'react'
import { List, Modal, Input, Button, Toast } from 'antd-mobile'
import { getDB, generateId } from '../utils/db'
import { getGreetingTitle } from '../utils/greeting'
import type { BeautyItem, Todo } from '../types'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import './Beauty.css'

function Beauty() {
  const [items, setItems] = useState<BeautyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showOriginalModal, setShowOriginalModal] = useState(false)
  const [currentOriginalText, setCurrentOriginalText] = useState('')
  const [showInputError, setShowInputError] = useState(false)
  const [inputText, setInputText] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    loadItems()
  }, [])

  const loadItems = async () => {
    try {
      const db = await getDB()
      const allItems = await db.getAll('beautyItems')
      // 按到期日期排序（最近的在前面）
      const sortedItems = allItems.sort((a, b) => a.expiryDate - b.expiryDate)
      setItems(sortedItems)
    } catch (error) {
      console.error('加载美丽物品失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 专属解析函数，只用于美丽物品
  const parseBeautyItem = (text: string) => {
    let name = ''
    let openDate = dayjs().startOf('day').valueOf()
    let expiryMonths = 0

    // 1. 先提取保质期月数（优先级最高）
    const expiryMatch = text.match(/保质期[^\d]*(\d+)[^\d]*月?/)
    if (expiryMatch) {
      expiryMonths = parseInt(expiryMatch[1], 10)
    }

    // 2. 提取开封日期
    const dateMatch = text.match(/(?:今天|今日|(\d+)月(\d+)日)/)
    if (dateMatch && dateMatch[1] && dateMatch[2]) {
      const month = parseInt(dateMatch[1], 10)
      const day = parseInt(dateMatch[2], 10)
      openDate = dayjs().month(month - 1).date(day).startOf('day').valueOf()
    }

    // 3. 提取物品名称
    // 移除日期和保质期关键词，剩下的就是物品名
    let cleanText = text
      .replace(/保质期[^\d]*\d+[^\d]*月?/g, '')
      .replace(/(?:今天|今日|\d+月\d+日)[^\d]*(?:开封|开箱|启用)/g, '')
      .replace(/(?:开封|开箱|启用)/g, '')
      .trim()

    // 简单提取（取第一个词）
    const nameMatch = cleanText.split(/[\s，。、,；;]+/)[0]
    if (nameMatch) {
      name = nameMatch.trim()
    }

    return { name, openDate, expiryMonths, originalText: text }
  }

  const handleAddItem = async () => {
    if (!inputText.trim()) {
      setShowInputError(true)
      setTimeout(() => setShowInputError(false), 2000)
      return
    }

    const parsed = parseBeautyItem(inputText.trim())
    
    // 验证必要信息
    if (!parsed.name || parsed.expiryMonths <= 0) {
      Toast.show({
        content: '请包含物品名称和保质期，格式如：“防晒霜 今天开封 保质期12个月”',
        duration: 3000,
      })
      return
    }

    try {
      const db = await getDB()
      const now = Date.now()
      
      // 计算到期日期
      const expiryDate = dayjs(parsed.openDate).add(parsed.expiryMonths, 'month').valueOf()
      
      // 推断分类
      let category: '护肤' | '彩妆' = '护肤'
      const makeupKeywords = ['口红', '粉底', '腮红', '睫毛膏', '彩妆', '眉笔', '眼线', '眼影', '气垫', '散粉', '遮瑕', '粉饼', '修容', '高光', '睫毛膏', '假睫毛', '美甲', '指甲油', '眼影盘']
      if (makeupKeywords.some(k => parsed.name.includes(k))) {
        category = '彩妆'
      }

      // 创建美丽物品记录
      const beautyItem: BeautyItem = {
        id: generateId(),
        name: parsed.name,
        category: category,
        openDate: parsed.openDate,
        expiryMonths: parsed.expiryMonths,
        expiryDate: expiryDate,
        createdAt: now,
        originalText: inputText.trim(),
      }

      await db.add('beautyItems', beautyItem)
      
      // 创建到期提醒待办（到期日前7天）
      const reminderDate = dayjs(expiryDate).subtract(7, 'day').valueOf()
      const reminderTodo: Todo = {
        id: generateId(),
        title: `⚠️ ${parsed.name} 到期，请更换`,
        description: `物品：${parsed.name}，实际到期日：${dayjs(expiryDate).format('YYYY-MM-DD')}`,
        completed: false,
        priority: 'medium',
        dueDate: reminderDate,
        createdAt: now,
        originalText: `提醒：${parsed.name} 到期`,
      }
      
      await db.add('todos', reminderTodo)

      // 刷新列表
      await loadItems()
      
      Toast.show({
        icon: 'success',
        content: '记录成功，已设置到期提醒',
      })

      // 清空输入框
      setInputText('')
      
    } catch (error) {
      console.error('添加物品失败:', error)
      Toast.show({
        content: '添加失败，请重试',
        duration: 2000,
      })
    }
  }

  const viewOriginalText = (text?: string) => {
    if (navigator.vibrate) {
      navigator.vibrate(10)
    }
    setCurrentOriginalText(text || '无原始聊天记录')
    setShowOriginalModal(true)
  }

  const getItemIcon = (category: string): string => {
    return category === '彩妆' ? '💄' : '🌸'
  }

  const getExpiryStatus = (item: BeautyItem): { 
    status: 'expired' | 'warning' | 'safe'
    text: string
    borderColor: string
    bgColor: string
  } => {
    const now = Date.now()
    const oneMonthInMs = 30 * 24 * 60 * 60 * 1000
    const timeUntilExpiry = item.expiryDate - now
    
    if (timeUntilExpiry <= 0) {
      return {
        status: 'expired',
        text: '已过期，请丢弃',
        borderColor: '#e53935',
        bgColor: '#ffebee'
      }
    } else if (timeUntilExpiry <= oneMonthInMs) {
      const daysLeft = Math.ceil(timeUntilExpiry / (24 * 60 * 60 * 1000))
      return {
        status: 'warning',
        text: `即将过期（还有 ${daysLeft} 天）`,
        borderColor: '#fb8c00',
        bgColor: '#fff3e0'
      }
    } else {
      return {
        status: 'safe',
        text: '状态良好',
        borderColor: '#e0e0e0',
        bgColor: '#f5f5f5'
      }
    }
  }

  // 计算到期提醒日期（提前7天）
  const getReminderDate = (item: BeautyItem) => {
    return dayjs(item.expiryDate).subtract(7, 'day').format('M月D日')
  }

  const stats = {
    total: items.length,
    expiring: items.filter(item => {
      const timeUntilExpiry = item.expiryDate - Date.now()
      return timeUntilExpiry > 0 && timeUntilExpiry <= 30 * 24 * 60 * 60 * 1000
    }).length,
    expired: items.filter(item => item.expiryDate - Date.now() <= 0).length
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">美丽日志</h1>
        <p className="page-subtitle">{getGreetingTitle()}</p>
      </div>

      {/* 快速添加区域 */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <Input
            placeholder="记录新物品，如‘防晒霜 今天开封 保质期12个月’"
            value={inputText}
            onChange={setInputText}
            style={{ flex: 1, height: '40px' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleAddItem()
              }
            }}
          />
          <Button
            color="primary"
            onClick={handleAddItem}
            style={{ 
              backgroundColor: '#c9a997',
              height: '40px',
              flexShrink: 0
            }}
          >
            添加
          </Button>
        </div>
        {showInputError && (
          <div style={{ 
            color: '#e53935', 
            fontSize: '12px', 
            marginTop: '8px' 
          }}>
            请输入内容
          </div>
        )}
      </div>

      <div className="card beauty-stats-card">
        <div className="stats-item">
          <div className="stats-icon">📦</div>
          <div className="stats-content">
            <div className="stats-value">{stats.total}</div>
            <div className="stats-label">物品总数</div>
          </div>
        </div>
        <div className="stats-divider" />
        <div className="stats-item">
          <div className="stats-icon">⚠️</div>
          <div className="stats-content">
            <div className="stats-value" style={{ color: '#fb8c00' }}>{stats.expiring}</div>
            <div className="stats-label">即将过期</div>
          </div>
        </div>
        <div className="stats-divider" />
        <div className="stats-item">
          <div className="stats-icon">❌</div>
          <div className="stats-content">
            <div className="stats-value" style={{ color: '#e53935' }}>{stats.expired}</div>
            <div className="stats-label">已过期</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#4a4a4a', marginBottom: '16px' }}>我的物品</h3>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#b5b5b5' }}>
            加载中...
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🌸</div>
            <p style={{ fontSize: '14px', color: '#8b8b8b', marginBottom: '8px' }}>
              还没有记录任何物品
            </p>
            <p style={{ fontSize: '12px', color: '#b5b5b5' }}>
              试试上方输入框记录新物品吧~
            </p>
          </div>
        ) : (
          <List>
            {items.map((item) => {
              const status = getExpiryStatus(item)
              return (
                <List.Item
                  key={item.id}
                  onClick={() => viewOriginalText(item.originalText)}
                  style={{ 
                    cursor: 'pointer',
                    border: `1px solid ${status.borderColor}`,
                    borderRadius: '12px',
                    marginBottom: '12px',
                    backgroundColor: status.bgColor
                  }}
                  prefix={
                    <div style={{ 
                      width: '44px', 
                      height: '44px', 
                      borderRadius: '12px',
                      backgroundColor: status.status === 'expired' ? '#ffebee' : '#fce4ec',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '22px'
                    }}>
                      {getItemIcon(item.category)}
                    </div>
                  }
                  description={
                    <div style={{ marginTop: '4px' }}>
                      <div style={{ fontSize: '12px', color: '#b5b5b5', marginBottom: '4px' }}>
                        开封：{dayjs(item.openDate).format('YYYY-MM-DD')} · 保质期：{item.expiryMonths}个月
                      </div>
                      <div style={{ fontSize: '12px', color: status.status === 'expired' ? '#e53935' : status.status === 'warning' ? '#fb8c00' : '#8b8b8b' }}>
                        到期：{dayjs(item.expiryDate).format('YYYY-MM-DD')}
                      </div>
                      <div 
                        style={{ 
                          fontSize: '11px', 
                          color: '#c9a997', 
                          marginTop: '4px',
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate('/schedule')
                        }}
                      >
                        📅 到期提醒已设置：{getReminderDate(item)}
                      </div>
                      <span style={{ 
                        fontSize: '11px', 
                        color: status.status === 'expired' ? '#e53935' : status.status === 'warning' ? '#fb8c00' : '#c9a997',
                        backgroundColor: status.status === 'expired' ? '#ffebee' : status.status === 'warning' ? '#fff3e0' : '#f8f6f1',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        marginTop: '4px',
                        display: 'inline-block'
                      }}>
                        {status.text}
                      </span>
                    </div>
                  }
                >
                  <div style={{ fontSize: '15px', fontWeight: 500, color: '#4a4a4a' }}>{item.name}</div>
                </List.Item>
              )
            })}
          </List>
        )}
      </div>

      <Modal
        visible={showOriginalModal}
        content={
          <div style={{ padding: '12px 0' }}>
            <div style={{ 
              backgroundColor: '#f8f6f1', 
              padding: '16px', 
              borderRadius: '12px',
              color: '#5a5a5a',
              fontSize: '15px',
              lineHeight: '1.6',
              border: '1px solid #e8e4dd'
            }}>
              {currentOriginalText}
            </div>
          </div>
        }
        closeOnAction
        onClose={() => setShowOriginalModal(false)}
        title="原文详情"
        actions={[
          {
            key: 'close',
            text: '关闭',
            style: { color: '#c9a997' }
          },
        ]}
      />
    </div>
  )
}

export default Beauty

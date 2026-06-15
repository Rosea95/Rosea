import { useState, useEffect } from 'react'
import { List, Modal } from 'antd-mobile'
import { getDB } from '../utils/db'
import { getGreetingTitle } from '../utils/greeting'
import type { BeautyItem } from '../types'
import dayjs from 'dayjs'
import './Beauty.css'

function Beauty() {
  const [items, setItems] = useState<BeautyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showOriginalModal, setShowOriginalModal] = useState(false)
  const [currentOriginalText, setCurrentOriginalText] = useState('')

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
              去聊天页对我说"新买了防晒霜，今天开封，保质期12个月"吧~
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

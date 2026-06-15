import { useState, useEffect } from 'react'
import { List, Button, Space, Modal } from 'antd-mobile'
import { AddCircleOutline, DownOutline, UpOutline } from 'antd-mobile-icons'
import { getDB } from '../utils/db'
import { getGreetingTitle } from '../utils/greeting'
import type { FinanceRecord } from '../types'
import dayjs from 'dayjs'

function Finance() {
  const [records, setRecords] = useState<FinanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showOriginalModal, setShowOriginalModal] = useState(false)
  const [currentOriginalText, setCurrentOriginalText] = useState('')

  // 页面加载时，从 IndexedDB 读取记账记录
  useEffect(() => {
    loadRecords()
  }, [])

  const loadRecords = async () => {
    try {
      const db = await getDB()
      const allRecords = await db.getAll('financeRecords')
      // 按时间倒序排序（最新的在前面）
      const sortedRecords = allRecords.sort((a, b) => b.date - a.date)
      setRecords(sortedRecords)
    } catch (error) {
      console.error('加载记账记录失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 查看原文
  const viewOriginalText = (text?: string) => {
    // 震动反馈
    if (navigator.vibrate) {
      navigator.vibrate(10)
    }
    setCurrentOriginalText(text || '无原始聊天记录')
    setShowOriginalModal(true)
  }

  // 计算本月统计
  const currentMonth = dayjs().month()
  const currentYear = dayjs().year()
  
  const thisMonthRecords = records.filter(record => {
    const recordMonth = dayjs(record.date).month()
    const recordYear = dayjs(record.date).year()
    return recordMonth === currentMonth && recordYear === currentYear
  })
  
  const totalIncome = thisMonthRecords
    .filter((r: FinanceRecord) => r.type === 'income')
    .reduce((sum: number, r: FinanceRecord) => sum + r.amount, 0)
  
  const totalExpense = thisMonthRecords
    .filter((r: FinanceRecord) => r.type === 'expense')
    .reduce((sum: number, r: FinanceRecord) => sum + r.amount, 0)
  
  const balance = totalIncome - totalExpense

  // 获取分类图标
  const getCategoryIcon = (category: string): string => {
    const icons: Record<string, string> = {
      '餐饮': '🍜',
      '交通': '🚌',
      '购物': '🛒',
      '娱乐': '🎮',
      '服装': '👕',
      '工资': '💰',
      '其他': '📦',
    }
    return icons[category] || '📦'
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">记账</h1>
        <p className="page-subtitle">{getGreetingTitle()}</p>
      </div>

      {/* 本月统计卡片 */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' }}>
            <DownOutline style={{ color: '#d4a5a5', marginRight: '4px' }} />
            <span style={{ fontSize: '12px', color: '#8b8b8b' }}>支出</span>
          </div>
          <p style={{ fontSize: '18px', fontWeight: 600, color: '#d4a5a5' }}>-¥{totalExpense.toFixed(2)}</p>
        </div>
        <div style={{ width: '1px', backgroundColor: '#e8e4dd' }} />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' }}>
            <UpOutline style={{ color: '#a8c5a0', marginRight: '4px' }} />
            <span style={{ fontSize: '12px', color: '#8b8b8b' }}>收入</span>
          </div>
          <p style={{ fontSize: '18px', fontWeight: 600, color: '#a8c5a0' }}>+¥{totalIncome.toFixed(2)}</p>
        </div>
        <div style={{ width: '1px', backgroundColor: '#e8e4dd' }} />
        <div>
          <div style={{ fontSize: '12px', color: '#8b8b8b', marginBottom: '4px' }}>余额</div>
          <p style={{ fontSize: '18px', fontWeight: 600, color: balance >= 0 ? '#4a4a4a' : '#d4a5a5' }}>
            ¥{balance.toFixed(2)}
          </p>
        </div>
      </div>

      {/* 记录列表 */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#4a4a4a' }}>最近记录</h3>
          <span style={{ fontSize: '12px', color: '#8b8b8b' }}>
            {dayjs().format('YYYY年MM月')}
          </span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#b5b5b5' }}>
            加载中...
          </div>
        ) : records.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>💰</div>
            <p style={{ fontSize: '14px', color: '#8b8b8b', marginBottom: '8px' }}>
              还没有记账记录
            </p>
            <p style={{ fontSize: '12px', color: '#b5b5b5' }}>
              去聊天页对我说"午餐花了30元"吧~
            </p>
          </div>
        ) : (
          <List>
            {records.map((record) => (
              <List.Item
                key={record.id}
                onClick={() => viewOriginalText(record.originalText)}
                style={{ cursor: 'pointer' }}
                description={
                  <div>
                    <div style={{ fontSize: '12px', color: '#b5b5b5' }}>
                      {dayjs(record.date).format('MM月DD日 HH:mm')}
                    </div>
                    {record.note && (
                      <div style={{ fontSize: '12px', color: '#8b8b8b', marginTop: '2px' }}>
                        {record.note}
                      </div>
                    )}
                  </div>
                }
                extra={
                  <span style={{ 
                    color: record.type === 'income' ? '#a8c5a0' : '#d4a5a5',
                    fontWeight: 600
                  }}>
                    {record.type === 'income' ? '+' : '-'}¥{record.amount.toFixed(2)}
                  </span>
                }
              >
                <Space>
                  <div style={{ 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '8px',
                    backgroundColor: record.type === 'income' ? '#e8f0e6' : '#f5ebeb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px'
                  }}>
                    {getCategoryIcon(record.category)}
                  </div>
                  <span style={{ fontSize: '14px', color: '#4a4a4a' }}>{record.category}</span>
                </Space>
              </List.Item>
            ))}
          </List>
        )}
      </div>

      {/* 原文详情弹窗 */}
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

export default Finance

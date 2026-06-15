import { useState, useEffect } from 'react'
import { List, Space, Modal } from 'antd-mobile'
import { getDB } from '../utils/db'
import { getGreetingTitle } from '../utils/greeting'
import type { DiaryRecord } from '../types'
import dayjs from 'dayjs'
import './Diary.css'

function Diary() {
  const [records, setRecords] = useState<DiaryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showOriginalModal, setShowOriginalModal] = useState(false)
  const [currentOriginalText, setCurrentOriginalText] = useState('')

  // 页面加载时，从 IndexedDB 读取日记记录
  useEffect(() => {
    loadRecords()
  }, [])

  const loadRecords = async () => {
    try {
      const db = await getDB()
      const allRecords = await db.getAll('diary')
      // 按时间倒序排序（最新的在前面）
      const sortedRecords = allRecords.sort((a, b) => b.createdAt - a.createdAt)
      setRecords(sortedRecords)
    } catch (error) {
      console.error('加载日记记录失败:', error)
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

  // 获取情绪颜色
  const getEmotionColor = (emotion?: string): string => {
    switch (emotion) {
      case 'positive':
        return '#a8c5a0' // 绿色 - 正面
      case 'negative':
        return '#d4a5a5' // 红色 - 负面
      default:
        return '#c9a997' // 莫兰迪色 - 中性
    }
  }

  // 获取情绪图标
  const getEmotionIcon = (emotion?: string): string => {
    switch (emotion) {
      case 'positive':
        return '😊'
      case 'negative':
        return '😔'
      default:
        return '😐'
    }
  }

  // 按日期分组
  const groupedRecords = records.reduce((groups: Record<string, DiaryRecord[]>, record) => {
    const dateKey = dayjs(record.createdAt).format('YYYY-MM-DD')
    if (!groups[dateKey]) {
      groups[dateKey] = []
    }
    groups[dateKey].push(record)
    return groups
  }, {})

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">日记</h1>
        <p className="page-subtitle">{getGreetingTitle()}</p>
      </div>

      <div className="card">
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#4a4a4a', marginBottom: '16px' }}>心情时间线</h3>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#b5b5b5' }}>
            加载中...
          </div>
        ) : records.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📔</div>
            <p style={{ fontSize: '14px', color: '#8b8b8b', marginBottom: '8px' }}>
              还没有日记记录
            </p>
            <p style={{ fontSize: '12px', color: '#b5b5b5' }}>
              去聊天页对我说"今天心情不错"吧~
            </p>
          </div>
        ) : (
          <div className="timeline-container">
            {Object.entries(groupedRecords).map(([date, dayRecords]) => (
              <div key={date} className="timeline-date-group">
                <div className="timeline-date">
                  {dayjs(date).format('MM月DD日')}
                  <span style={{ fontSize: '12px', color: '#b5b5b5', marginLeft: '8px' }}>
                    {dayjs(date).format('dddd')}
                  </span>
                </div>
                {dayRecords.map((record) => (
                  <div 
                    key={record.id} 
                    className="timeline-item"
                    onClick={() => viewOriginalText(record.originalText)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div 
                      className="timeline-dot"
                      style={{ backgroundColor: getEmotionColor(record.emotion) }}
                    />
                    <div className="timeline-content">
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '16px', marginRight: '8px' }}>
                          {getEmotionIcon(record.emotion)}
                        </span>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#4a4a4a' }}>
                          {record.title}
                        </span>
                      </div>
                      {record.content && (
                        <p style={{ fontSize: '13px', color: '#8b8b8b', margin: '0' }}>
                          {record.content}
                        </p>
                      )}
                      <span style={{ fontSize: '12px', color: '#b5b5b5' }}>
                        {dayjs(record.createdAt).format('HH:mm')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
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

export default Diary

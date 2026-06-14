import { useState, useEffect } from 'react'
import { List } from 'antd-mobile'
import { getDB } from '../utils/db'
import { getGreetingTitle } from '../utils/greeting'
import type { HealthRecord } from '../types'
import dayjs from 'dayjs'
import './Health.css'

function Health() {
  const [records, setRecords] = useState<HealthRecord[]>([])
  const [loading, setLoading] = useState(true)

  // 页面加载时，从 IndexedDB 读取健康记录
  useEffect(() => {
    loadRecords()
  }, [])

  const loadRecords = async () => {
    try {
      const db = await getDB()
      const allRecords = await db.getAll('health')
      // 按时间倒序排序（最新的在前面）
      const sortedRecords = allRecords.sort((a, b) => b.createdAt - a.createdAt)
      setRecords(sortedRecords)
    } catch (error) {
      console.error('加载健康记录失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 计算本周运动次数
  const getWeekSportCount = () => {
    const startOfWeek = dayjs().startOf('week')
    const endOfWeek = dayjs().endOf('week')
    
    return records.filter(record => {
      const recordDate = dayjs(record.createdAt)
      return recordDate.isAfter(startOfWeek) && recordDate.isBefore(endOfWeek)
    }).length
  }

  // 获取活动图标
  const getActivityIcon = (title: string): string => {
    const titleLower = title.toLowerCase()
    if (titleLower.includes('跑步') || titleLower.includes('跑')) return '🏃'
    if (titleLower.includes('游泳') || titleLower.includes('游')) return '🏊'
    if (titleLower.includes('瑜伽')) return '🧘'
    if (titleLower.includes('健身') || titleLower.includes('运动')) return '💪'
    if (titleLower.includes('护肤') || titleLower.includes('面膜') || titleLower.includes('敷')) return '✨'
    if (titleLower.includes('泡脚')) return '🦶'
    if (titleLower.includes('冥想')) return '🧠'
    if (titleLower.includes('跳绳')) return '🪢'
    if (titleLower.includes('打球') || titleLower.includes('球')) return '🏀'
    if (titleLower.includes('深蹲')) return '🦵'
    return '❤️'
  }

  // 获取分类标签颜色
  const getCategoryColor = (category?: string): string => {
    switch (category) {
      case '运动':
        return '#e8f5e9'
      case '护肤':
        return '#fce4ec'
      case '养生':
        return '#fff3e0'
      default:
        return '#f5f5f5'
    }
  }

  const weekSportCount = getWeekSportCount()

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">健康记录</h1>
        <p className="page-subtitle">{getGreetingTitle()}</p>
      </div>

      {/* 本周统计卡片 */}
      <div className="card health-stats-card">
        <div className="stats-item">
          <div className="stats-icon">📊</div>
          <div className="stats-content">
            <div className="stats-value">{weekSportCount}</div>
            <div className="stats-label">本周运动次数</div>
          </div>
        </div>
        <div className="stats-divider" />
        <div className="stats-item">
          <div className="stats-icon">📈</div>
          <div className="stats-content">
            <div className="stats-value">{records.length}</div>
            <div className="stats-label">总记录数</div>
          </div>
        </div>
      </div>

      {/* 记录列表 */}
      <div className="card">
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#4a4a4a', marginBottom: '16px' }}>运动记录</h3>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#b5b5b5' }}>
            加载中...
          </div>
        ) : records.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>💪</div>
            <p style={{ fontSize: '14px', color: '#8b8b8b', marginBottom: '8px' }}>
              还没有健康记录
            </p>
            <p style={{ fontSize: '12px', color: '#b5b5b5' }}>
              去聊天页对我说"跑步30分钟"或"敷面膜"吧~
            </p>
          </div>
        ) : (
          <List>
            {records.map((record) => (
              <List.Item
                key={record.id}
                prefix={
                  <div style={{ 
                    width: '44px', 
                    height: '44px', 
                    borderRadius: '12px',
                    backgroundColor: getCategoryColor(record.category),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '22px'
                  }}>
                    {getActivityIcon(record.title)}
                  </div>
                }
                description={
                  <div style={{ marginTop: '4px' }}>
                    <div style={{ fontSize: '12px', color: '#b5b5b5' }}>
                      {dayjs(record.createdAt).format('YYYY-MM-DD HH:mm')}
                    </div>
                    {record.category && (
                      <span style={{ 
                        fontSize: '11px', 
                        color: '#c9a997',
                        backgroundColor: '#f8f6f1',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        marginTop: '4px',
                        display: 'inline-block'
                      }}>
                        {record.category}
                      </span>
                    )}
                  </div>
                }
              >
                <div className="health-record-title">{record.title}</div>
              </List.Item>
            ))}
          </List>
        )}
      </div>
    </div>
  )
}

export default Health

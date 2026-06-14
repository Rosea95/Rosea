import { useState, useEffect } from 'react'
import { Button, ProgressBar } from 'antd-mobile'
import { getDB } from '../utils/db'
import { getGreetingTitle } from '../utils/greeting'
import type { Todo, FinanceRecord, DiaryRecord, HealthRecord } from '../types'
import dayjs from 'dayjs'
import './Review.css'

type TimeRange = 'week' | 'month' | 'halfYear'

function Review() {
  const [timeRange, setTimeRange] = useState<TimeRange>('week')
  const [todos, setTodos] = useState<Todo[]>([])
  const [finances, setFinances] = useState<FinanceRecord[]>([])
  const [diaries, setDiaries] = useState<DiaryRecord[]>([])
  const [healths, setHealths] = useState<HealthRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [timeRange])

  const loadData = async () => {
    setLoading(true)
    try {
      const db = await getDB()
      
      // 获取时间范围
      const now = dayjs()
      let startDate: dayjs.Dayjs
      switch (timeRange) {
        case 'week':
          startDate = now.startOf('week')
          break
        case 'month':
          startDate = now.startOf('month')
          break
        case 'halfYear':
          startDate = now.subtract(6, 'month')
          break
      }
      const startTimestamp = startDate.valueOf()
      
      // 读取所有数据
      const allTodos = await db.getAll('todos')
      const allFinances = await db.getAll('financeRecords')
      const allDiaries = await db.getAll('diary')
      const allHealths = await db.getAll('health')
      
      // 过滤时间范围内的数据
      setTodos(allTodos.filter(t => t.createdAt >= startTimestamp || (t.dueDate && t.dueDate >= startTimestamp)))
      setFinances(allFinances.filter(f => f.date >= startTimestamp))
      setDiaries(allDiaries.filter(d => d.createdAt >= startTimestamp))
      setHealths(allHealths.filter(h => h.createdAt >= startTimestamp))
      
    } catch (error) {
      console.error('加载复盘数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // ===== 待办统计 =====
  const todoStats = () => {
    const total = todos.length
    const completed = todos.filter(t => t.completed).length
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0
    const overdue = todos.filter(t => !t.completed && t.dueDate && t.dueDate < Date.now()).length
    return { total, completed, rate, overdue }
  }

  // ===== 运动统计 =====
  const healthStats = () => {
    const count = healths.length
    const totalDuration = healths.reduce((sum, h) => sum + (h.duration || 0), 0)
    
    // 高频运动排行
    const activityCount: Record<string, number> = {}
    healths.forEach(h => {
      const title = h.title || '运动'
      activityCount[title] = (activityCount[title] || 0) + 1
    })
    const topActivities = Object.entries(activityCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }))
    
    return { count, totalDuration, topActivities }
  }

  // ===== 记账统计 =====
  const financeStats = () => {
    const expense = finances.filter(f => f.type === 'expense').reduce((sum, f) => sum + f.amount, 0)
    const income = finances.filter(f => f.type === 'income').reduce((sum, f) => sum + f.amount, 0)
    const balance = income - expense
    
    // 分类支出
    const categoryExpense: Record<string, number> = {}
    finances.filter(f => f.type === 'expense').forEach(f => {
      const cat = f.category || '其他'
      categoryExpense[cat] = (categoryExpense[cat] || 0) + f.amount
    })
    const categories = Object.entries(categoryExpense)
      .sort((a, b) => b[1] - a[1])
      .map(([name, amount]) => ({ name, amount }))
    
    return { expense, income, balance, categories }
  }

  // ===== 心情统计 =====
  const diaryStats = () => {
    const positive = diaries.filter(d => d.emotion === 'positive').length
    const negative = diaries.filter(d => d.emotion === 'negative').length
    const neutral = diaries.filter(d => d.emotion === 'neutral' || !d.emotion).length
    const total = diaries.length
    return { positive, negative, neutral, total }
  }

  // ===== 生成总结寄语 =====
  const generateSummary = () => {
    const todo = todoStats()
    const health = healthStats()
    const finance = financeStats()
    
    let summary = ''
    
    // 待办总结
    if (todo.total > 0) {
      if (todo.rate >= 80) {
        summary += `完成了${todo.rate}%的待办，效率真棒！`
      } else if (todo.rate >= 50) {
        summary += `完成了${todo.rate}%的待办，继续加油！`
      } else {
        summary += `待办完成率${todo.rate}%，可以试着分解任务哦~`
      }
    }
    
    // 运动总结
    if (health.count > 0) {
      if (health.count >= 5) {
        summary += `坚持运动了${health.count}次，太自律了！`
      } else if (health.count >= 3) {
        summary += `运动了${health.count}次，保持节奏！`
      } else {
        summary += `运动了${health.count}次，可以多动动哦~`
      }
    }
    
    // 记账总结
    if (finance.categories.length > 0 && finance.expense > 0) {
      const topCategory = finance.categories[0]
      const topPercent = Math.round((topCategory.amount / finance.expense) * 100)
      if (topPercent >= 40) {
        summary += `${topCategory.name}支出占了${topPercent}%，可以留意预算~`
      }
    }
    
    if (!summary) {
      summary = '记录还不够多，多用用Rosea吧~'
    }
    
    return summary
  }

  const todoData = todoStats()
  const healthData = healthStats()
  const financeData = financeStats()
  const diaryData = diaryStats()
  const summary = generateSummary()

  const timeRangeLabels = {
    week: '本周',
    month: '本月',
    halfYear: '近半年'
  }

  return (
    <div className="review-container">
      <div className="page-header">
        <h1 className="page-title">复盘</h1>
        <p className="page-subtitle">{getGreetingTitle()}</p>
      </div>

      {/* 时间范围切换 */}
      <div className="time-range-tabs">
        {(['week', 'month', 'halfYear'] as TimeRange[]).map(range => (
          <Button
            key={range}
            size="small"
            color={timeRange === range ? 'primary' : 'default'}
            onClick={() => setTimeRange(range)}
            style={{
              borderRadius: '20px',
              backgroundColor: timeRange === range ? '#c9a997' : '#f5f5f5',
              color: timeRange === range ? '#fff' : '#666',
              border: 'none',
              marginRight: '8px'
            }}
          >
            {timeRangeLabels[range]}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="loading-state">加载中...</div>
      ) : (
        <>
          {/* 待办统计 */}
          <div className="stat-card">
            <h3 className="stat-title">📋 待办统计</h3>
            <div className="stat-content">
              <div className="stat-main">
                <div className="stat-number">{todoData.rate}%</div>
                <div className="stat-label">完成率</div>
                <ProgressBar 
                  percent={todoData.rate} 
                  style={{ marginTop: '12px', '--track-color': '#e8e4dd', '--fill-color': '#c9a997' } as React.CSSProperties}
                />
              </div>
              <div className="stat-detail">
                <div className="detail-item">
                  <span className="detail-label">已完成</span>
                  <span className="detail-value">{todoData.completed}/{todoData.total}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">逾期</span>
                  <span className="detail-value overdue">{todoData.overdue}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 运动统计 */}
          <div className="stat-card">
            <h3 className="stat-title">🏃 运动统计</h3>
            <div className="stat-content">
              <div className="stat-row">
                <div className="stat-item">
                  <div className="stat-number">{healthData.count}</div>
                  <div className="stat-label">运动次数</div>
                </div>
                <div className="stat-item">
                  <div className="stat-number">{healthData.totalDuration}</div>
                  <div className="stat-label">总时长(分钟)</div>
                </div>
              </div>
              {healthData.topActivities.length > 0 && (
                <div className="activity-ranking">
                  <div className="ranking-title">高频运动</div>
                  {healthData.topActivities.map((act, idx) => (
                    <div key={idx} className="ranking-item">
                      <span className="ranking-badge">{idx + 1}</span>
                      <span className="ranking-name">{act.name}</span>
                      <span className="ranking-count">{act.count}次</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 记账统计 */}
          <div className="stat-card">
            <h3 className="stat-title">💰 记账统计</h3>
            <div className="stat-content">
              <div className="stat-row">
                <div className="stat-item expense">
                  <div className="stat-number">-{financeData.expense}</div>
                  <div className="stat-label">支出</div>
                </div>
                <div className="stat-item income">
                  <div className="stat-number">+{financeData.income}</div>
                  <div className="stat-label">收入</div>
                </div>
                <div className="stat-item balance">
                  <div className="stat-number">{financeData.balance}</div>
                  <div className="stat-label">结余</div>
                </div>
              </div>
              {financeData.categories.length > 0 && (
                <div className="category-chart">
                  <div className="chart-title">分类支出</div>
                  {financeData.categories.map((cat, idx) => {
                    const percent = financeData.expense > 0 
                      ? Math.round((cat.amount / financeData.expense) * 100) 
                      : 0
                    return (
                      <div key={idx} className="chart-bar">
                        <div className="bar-label">{cat.name}</div>
                        <div className="bar-track">
                          <div 
                            className="bar-fill" 
                            style={{ width: `${percent}%`, backgroundColor: '#c9a997' }}
                          />
                        </div>
                        <div className="bar-value">{cat.amount}元 ({percent}%)</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 心情统计 */}
          <div className="stat-card">
            <h3 className="stat-title">😊 心情统计</h3>
            <div className="stat-content">
              <div className="emotion-row">
                <div className="emotion-item">
                  <span className="emotion-icon">😊</span>
                  <span className="emotion-count">{diaryData.positive}</span>
                </div>
                <div className="emotion-item">
                  <span className="emotion-icon">😔</span>
                  <span className="emotion-count">{diaryData.negative}</span>
                </div>
                <div className="emotion-item">
                  <span className="emotion-icon">😐</span>
                  <span className="emotion-count">{diaryData.neutral}</span>
                </div>
              </div>
              <div className="emotion-total">
                共记录 {diaryData.total} 条心情
              </div>
            </div>
          </div>

          {/* 总结寄语 */}
          <div className="summary-card">
            <div className="summary-icon">💡</div>
            <div className="summary-text">{summary}</div>
          </div>
        </>
      )}
    </div>
  )
}

export default Review
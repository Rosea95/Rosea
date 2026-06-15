import { useState, useEffect } from 'react'
import { Calendar, List, Checkbox, Badge, Button, Space, Modal } from 'antd-mobile'
import { UnorderedListOutline, CalendarOutline, MessageOutline } from 'antd-mobile-icons'
import { getDB } from '../utils/db'
import { getGreetingTitle } from '../utils/greeting'
import type { Todo } from '../types'
import './Schedule.css'

function Schedule() {
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [todos, setTodos] = useState<Todo[]>([])
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedDateTodos, setSelectedDateTodos] = useState<Todo[]>([])
  const [showOriginalModal, setShowOriginalModal] = useState(false)
  const [currentOriginalText, setCurrentOriginalText] = useState('')

  // 页面加载时，从 IndexedDB 读取所有待办
  useEffect(() => {
    loadTodos()
  }, [])

  // 自动加载待办数据
  const loadTodos = async () => {
    try {
      const db = await getDB()
      const allTodos = await db.getAll('todos')
      // 按时间从近到远排序（有截止时间的优先）
      const sortedTodos = allTodos.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return a.createdAt - b.createdAt
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return a.dueDate - b.dueDate
      })
      setTodos(sortedTodos)
    } catch (error) {
      console.error('加载待办失败:', error)
    }
  }

  // 切换待办完成状态
  const toggleTodo = async (id: string) => {
    try {
      const db = await getDB()
      const todo = await db.get('todos', id)
      if (todo) {
        const updatedTodo = { ...todo, completed: !todo.completed }
        await db.put('todos', updatedTodo)
        
        // 更新本地状态 - 同时更新 todos 和 selectedDateTodos
        setTodos(prev => {
          const newTodos = prev.map(t => t.id === id ? updatedTodo : t)
          // 同时更新 selectedDateTodos，确保日历视图实时渲染
          setSelectedDateTodos(prevSelected => 
            prevSelected.map(t => t.id === id ? updatedTodo : t)
          )
          return newTodos
        })
      }
    } catch (error) {
      console.error('更新待办失败:', error)
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

  // 格式化时间显示
  const formatDueDate = (dueDate?: number) => {
    if (!dueDate) return '无截止时间'
    const date = new Date(dueDate)
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}（${weekdays[date.getDay()]}）${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  // 日历视图：获取某一天的待办
  const getTodosForDate = (date: Date) => {
    const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    const dateEnd = dateStart + 24 * 60 * 60 * 1000
    return todos.filter(todo => {
      if (!todo.dueDate) return false
      return todo.dueDate >= dateStart && todo.dueDate < dateEnd
    })
  }

  // 日历视图：点击日期
  const handleDateClick = (date: Date) => {
    setSelectedDate(date)
    const dayTodos = getTodosForDate(date)
    setSelectedDateTodos(dayTodos)
  }

  // 日历视图：判断某天是否有待办
  const hasTodosOnDate = (date: Date) => {
    return getTodosForDate(date).length > 0
  }

  return (
    <div className="schedule-container">
      {/* 页面标题 */}
      <div className="page-header">
        <h1 className="page-title">日程</h1>
        <p className="page-subtitle">{getGreetingTitle()}</p>
      </div>

      {/* 视图切换按钮 */}
      <div className="view-switcher">
        <Space>
          <Button
            color={viewMode === 'list' ? 'primary' : 'default'}
            onClick={() => setViewMode('list')}
            style={{
              backgroundColor: viewMode === 'list' ? '#c9a997' : '#f8f6f1',
              borderColor: viewMode === 'list' ? '#c9a997' : '#e8e4dd',
              color: viewMode === 'list' ? '#ffffff' : '#4a4a4a'
            }}
          >
            <UnorderedListOutline /> 列表
          </Button>
          <Button
            color={viewMode === 'calendar' ? 'primary' : 'default'}
            onClick={() => setViewMode('calendar')}
            style={{
              backgroundColor: viewMode === 'calendar' ? '#c9a997' : '#f8f6f1',
              borderColor: viewMode === 'calendar' ? '#c9a997' : '#e8e4dd',
              color: viewMode === 'calendar' ? '#ffffff' : '#4a4a4a'
            }}
          >
            <CalendarOutline /> 日历
          </Button>
        </Space>
      </div>

      {/* 列表视图 */}
      {viewMode === 'list' && (
        <div className="todos-list">
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#4a4a4a' }}>待办事项</h3>
              <Badge content={todos.filter(t => !t.completed).length} style={{ backgroundColor: '#c9a997' }} />
            </div>
            
            {todos.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📝</div>
                <p className="empty-text">还没有待办</p>
                <p className="empty-hint">去聊天页对我说"明天下午开会"吧~</p>
              </div>
            ) : (
              <List>
                {todos.map((todo) => (
                  <List.Item
                    key={todo.id}
                    onClick={() => viewOriginalText(todo.originalText)}
                    prefix={
                      <div 
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleTodo(todo.id)
                        }}
                        style={{ 
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <Checkbox 
                          checked={todo.completed}
                          style={{ 
                            '--checked-color': '#c9a997',
                            '--checkmark-color': '#ffffff'
                          } as React.CSSProperties}
                        />
                      </div>
                    }
                    extra={
                      <MessageOutline 
                        style={{ color: '#c9a997', fontSize: '18px', opacity: todo.originalText ? 1 : 0.3 }} 
                        onClick={(e) => {
                          e.stopPropagation()
                          viewOriginalText(todo.originalText)
                        }}
                      />
                    }
                    style={{ 
                      textDecoration: todo.completed ? 'line-through' : 'none',
                      color: todo.completed ? '#b5b5b5' : '#4a4a4a',
                      opacity: todo.completed ? 0.6 : 1,
                      cursor: 'pointer'
                    }}
                  >
                    <div className="todo-content">
                      <div className="todo-title">{todo.title}</div>
                      <div className="todo-time">{formatDueDate(todo.dueDate)}</div>
                    </div>
                  </List.Item>
                ))}
              </List>
            )}
          </div>
        </div>
      )}

      {/* 日历视图 */}
      {viewMode === 'calendar' && (
        <div className="calendar-view">
          <div className="card">
            <Calendar
              selectionMode="single"
              value={selectedDate}
              onChange={(val: Date | null) => { if (val) handleDateClick(val) }}
              style={{ '--calendar-active-color': '#c9a997' } as React.CSSProperties}
              renderDate={(date: Date) => {
                const hasTodo = hasTodosOnDate(date)
                return (
                  <div className="calendar-date-cell">
                    <div>{date.getDate()}</div>
                    {hasTodo && (
                      <div className="todo-dot" style={{ backgroundColor: '#c9a997' }} />
                    )}
                  </div>
                )
              }}
            />
          </div>

          {/* 选中日期的待办列表 */}
          <div className="card">
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#4a4a4a', marginBottom: '16px' }}>
              {selectedDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })} 的待办
            </h3>
            
            {selectedDateTodos.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📅</div>
                <p className="empty-text">这一天没有待办</p>
              </div>
            ) : (
              <List>
                {selectedDateTodos.map((todo) => (
                  <List.Item
                    key={todo.id}
                    onClick={() => viewOriginalText(todo.originalText)}
                    prefix={
                      <div 
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleTodo(todo.id)
                        }}
                        style={{ 
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <Checkbox 
                          checked={todo.completed}
                          style={{ 
                            '--checked-color': '#c9a997',
                            '--checkmark-color': '#ffffff'
                          } as React.CSSProperties}
                        />
                      </div>
                    }
                    extra={
                      <MessageOutline 
                        style={{ color: '#c9a997', fontSize: '18px', opacity: todo.originalText ? 1 : 0.3 }} 
                        onClick={(e) => {
                          e.stopPropagation()
                          viewOriginalText(todo.originalText)
                        }}
                      />
                    }
                    style={{ 
                      textDecoration: todo.completed ? 'line-through' : 'none',
                      color: todo.completed ? '#b5b5b5' : '#4a4a4a',
                      opacity: todo.completed ? 0.6 : 1,
                      cursor: 'pointer'
                    }}
                  >
                    <div className="todo-content">
                      <div className="todo-title">{todo.title}</div>
                      <div className="todo-time">
                        {todo.dueDate ? new Date(todo.dueDate).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '无时间'}
                      </div>
                    </div>
                  </List.Item>
                ))}
              </List>
            )}
          </div>
        </div>
      )}

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

export default Schedule
import { useState, useEffect } from 'react'
import { Calendar, List, Checkbox, Badge, Button, Space, Modal, Form, Input, Picker, Toast } from 'antd-mobile'
import { UnorderedListOutline, CalendarOutline, MessageOutline, AppOutline } from 'antd-mobile-icons'
import { getDB, generateId } from '../utils/db'
import { getGreetingTitle } from '../utils/greeting'
import type { Todo } from '../types'
import dayjs from 'dayjs'
import './Schedule.css'

// 预定义颜色选项
const COLOR_OPTIONS = [
  { label: '蓝色（工作）', value: '#4A90E2' },
  { label: '粉色（个人）', value: '#E85E9F' },
  { label: '绿色（学习）', value: '#50C878' },
  { label: '橙色（生活）', value: '#F5A623' },
  { label: '紫色（创意）', value: '#9B59B6' },
  { label: '红色（重要）', value: '#E74C3C' }
]

// 周几选择项
const WEEKDAY_OPTIONS = [
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 },
  { label: '周日', value: 0 }
]

// 时间选项（00:00-23:50，每10分钟一个）
const generateTimeOptions = () => {
  const times = []
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 10) {
      times.push({
        label: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
        value: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      })
    }
  }
  return times
}

const TIME_OPTIONS = generateTimeOptions()

// 筛选选项
const FILTER_OPTIONS = [
  { label: '全部', value: 'all' },
  { label: '仅课程', value: 'course' },
  { label: '仅待办', value: 'normal' }
]

function Schedule() {
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [todos, setTodos] = useState<Todo[]>([])
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedDateTodos, setSelectedDateTodos] = useState<Todo[]>([])
  const [showOriginalModal, setShowOriginalModal] = useState(false)
  const [currentOriginalText, setCurrentOriginalText] = useState('')
  
  // 新增状态
  const [showCourseModal, setShowCourseModal] = useState(false)
  const [filterMode, setFilterMode] = useState<'all' | 'course' | 'normal'>('all')
  const [form] = Form.useForm()

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

  // 批量生成课程待办
  const handleAddCourse = async (values: any) => {
    try {
      const db = await getDB()
      const batchId = generateId()
      const now = Date.now()
      
      // 解析参数
      const { courseName, location, weekdays, startTime, endTime, startDate, weeks, color } = values
      
      // 解析时间（HH:MM）
      const [startHour, startMinute] = startTime.split(':').map(Number)
      const [endHour, endMinute] = endTime.split(':').map(Number)
      
      // 开始日期（使用 startDate，默认今天）
      let startDateTime = new Date(startDate || new Date())
      startDateTime.setHours(0, 0, 0, 0)
      
      // 结束日期
      let endDateTime = new Date(startDateTime)
      endDateTime.setDate(startDateTime.getDate() + weeks * 7)
      
      // 生成所有符合条件的待办
      const courseTodos: Todo[] = []
      
      for (let date = new Date(startDateTime); date <= endDateTime; date.setDate(date.getDate() + 1)) {
        const dayOfWeek = date.getDay()
        
        // 检查是否在选择的周几中
        if (weekdays && weekdays.length > 0 && weekdays.includes(dayOfWeek)) {
          // 创建待办的开始时间
          const courseStart = new Date(date)
          courseStart.setHours(startHour, startMinute, 0, 0)
          
          // 创建待办的结束时间
          const courseEnd = new Date(date)
          courseEnd.setHours(endHour, endMinute, 0, 0)
          
          courseTodos.push({
            id: generateId(),
            title: courseName,
            description: location ? `地点：${location}` : '',
            completed: false,
            priority: 'medium',
            dueDate: courseStart.getTime(),
            createdAt: now,
            batchId: batchId,
            type: 'course',
            location: location,
            courseColor: color,
            courseEndTime: courseEnd.getTime()
          })
        }
      }
      
      // 批量存储到 IndexedDB
      for (const todo of courseTodos) {
        await db.add('todos', todo)
      }
      
      // 刷新数据
      await loadTodos()
      
      Toast.show({
        icon: 'success',
        content: `成功添加 ${courseTodos.length} 节课程`
      })
      
      // 关闭弹窗并重置表单
      setShowCourseModal(false)
      form.resetFields()
      
    } catch (error) {
      console.error('添加课程失败:', error)
      Toast.show({
        content: '添加失败，请重试'
      })
    }
  }

  // 获取筛选后的待办列表
  const getFilteredTodos = (items: Todo[]) => {
    if (filterMode === 'all') return items
    return items.filter(t => t.type === filterMode)
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#4a4a4a', margin: 0 }}>待办事项</h3>
                <Badge 
                  content={getFilteredTodos(todos).filter(t => !t.completed).length} 
                  style={{ backgroundColor: '#c9a997' }} 
                />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {/* 添加课程按钮 */}
                <Button
                  color="primary"
                  onClick={() => setShowCourseModal(true)}
                  style={{
                    backgroundColor: '#4A90E2',
                    borderColor: '#4A90E2',
                    color: '#fff',
                    fontSize: '14px'
                  }}
                >
                  <AppOutline /> 排课
                </Button>
                {/* 筛选按钮 */}
                <Picker
                  columns={[
                    FILTER_OPTIONS
                  ]}
                  value={[filterMode]}
                  onConfirm={(val) => {
                    setFilterMode(val[0] as any)
                  }}
                >
                  {(items) => (
                    <Button
                      color="default"
                      style={{
                        backgroundColor: '#f8f6f1',
                        borderColor: '#e8e4dd',
                        color: '#4a4a4a',
                        fontSize: '14px'
                      }}
                    >
                      {items[0]?.label || '筛选'}
                    </Button>
                  )}
                </Picker>
              </div>
            </div>
            
            {getFilteredTodos(todos).length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📝</div>
                <p className="empty-text">还没有{filterMode === 'course' ? '课程' : filterMode === 'normal' ? '待办' : ''}</p>
                <p className="empty-hint">去聊天页对我说"明天下午开会"吧~</p>
              </div>
            ) : (
              <List>
                {getFilteredTodos(todos).map((todo) => (
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
                      cursor: 'pointer',
                      backgroundColor: todo.type === 'course' && todo.courseColor 
                        ? `${todo.courseColor}10` 
                        : 'transparent',
                      borderLeft: todo.type === 'course' && todo.courseColor 
                        ? `4px solid ${todo.courseColor}` 
                        : 'none'
                    }}
                  >
                    <div className="todo-content">
                      <div className="todo-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {todo.type === 'course' && <span style={{ fontSize: '14px' }}>📚</span>}
                        {todo.title}
                      </div>
                      <div className="todo-time">
                        {todo.type === 'course' && todo.courseEndTime 
                          ? `${new Date(todo.dueDate!).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} - ${new Date(todo.courseEndTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` 
                          : formatDueDate(todo.dueDate)}
                        {todo.location && <span style={{ marginLeft: '8px', opacity: 0.7 }}>📍 {todo.location}</span>}
                      </div>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#4a4a4a', margin: 0 }}>日历</h3>
              {/* 添加课程按钮 */}
              <Button
                color="primary"
                onClick={() => setShowCourseModal(true)}
                style={{
                  backgroundColor: '#4A90E2',
                  borderColor: '#4A90E2',
                  color: '#fff',
                  fontSize: '14px'
                }}
              >
                <AppOutline /> 排课
              </Button>
            </div>
            <Calendar
              selectionMode="single"
              value={selectedDate}
              onChange={(val: Date | null) => { if (val) handleDateClick(val) }}
              style={{ '--calendar-active-color': '#c9a997' } as React.CSSProperties}
              renderDate={(date: Date) => {
                const dayTodos = getTodosForDate(date)
                const hasTodo = dayTodos.length > 0
                const hasCourse = dayTodos.some(t => t.type === 'course')
                
                return (
                  <div className="calendar-date-cell">
                    <div>{date.getDate()}</div>
                    {hasTodo && hasCourse && (
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'center', 
                        gap: '4px' 
                      }}>
                        <div className="todo-dot" style={{ backgroundColor: '#c9a997' }} />
                        <div className="todo-dot" style={{ backgroundColor: dayTodos.find(t => t.type === 'course')?.courseColor || '#4A90E2' }} />
                      </div>
                    )}
                    {hasTodo && !hasCourse && (
                      <div className="todo-dot" style={{ backgroundColor: '#c9a997' }} />
                    )}
                    {!hasTodo && hasCourse && (
                      <div className="todo-dot" style={{ backgroundColor: dayTodos.find(t => t.type === 'course')?.courseColor || '#4A90E2' }} />
                    )}
                  </div>
                )
              }}
            />
          </div>

          {/* 选中日期的待办列表 */}
          <div className="card">
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#4a4a4a', marginBottom: '16px' }}>
              {selectedDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })} 的日程
            </h3>
            
            {selectedDateTodos.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📅</div>
                <p className="empty-text">这一天没有待办</p>
              </div>
            ) : (
              <List>
                {selectedDateTodos.sort((a, b) => (a.dueDate || 0) - (b.dueDate || 0)).map((todo) => (
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
                      cursor: 'pointer',
                      backgroundColor: todo.type === 'course' && todo.courseColor 
                        ? `${todo.courseColor}15` 
                        : 'transparent',
                      borderLeft: todo.type === 'course' && todo.courseColor 
                        ? `4px solid ${todo.courseColor}` 
                        : 'none',
                      borderRadius: '8px'
                    }}
                  >
                    <div className="todo-content">
                      <div className="todo-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {todo.type === 'course' && <span style={{ fontSize: '14px' }}>📚</span>}
                        {todo.title}
                      </div>
                      <div className="todo-time">
                        {todo.type === 'course' && todo.courseEndTime 
                          ? `${new Date(todo.dueDate!).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} - ${new Date(todo.courseEndTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` 
                          : formatDueDate(todo.dueDate)}
                        {todo.location && <span style={{ marginLeft: '8px', opacity: 0.7 }}>📍 {todo.location}</span>}
                      </div>
                    </div>
                  </List.Item>
                ))}
              </List>
            )}
          </div>
        </div>
      )}

      {/* 添加课程表单弹窗 */}
      <Modal
        visible={showCourseModal}
        onClose={() => setShowCourseModal(false)}
        title="添加课程/工作安排"
        content={
          <div style={{ padding: '8px 0' }}>
            <Form
              form={form}
              layout="vertical"
              initialValues={{
                weeks: 16,
                color: '#4A90E2'
              }}
              onFinish={handleAddCourse}
            >
              <Form.Item
                label="事项名称"
                name="courseName"
                rules={[{ required: true, message: '请输入事项名称' }]}
              >
                <Input placeholder="如：初三化学课" />
              </Form.Item>

              <Form.Item
                label="地点"
                name="location"
              >
                <Input placeholder="如：2教301（可选）" />
              </Form.Item>

              <Form.Item
                label="周几"
                name="weekdays"
                rules={[{ required: true, message: '请选择周几' }]}
              >
                <Picker
                  columns={[
                    WEEKDAY_OPTIONS.map(day => ({ ...day, key: day.value }))
                  ]}
                  multiple
                >
                  {(items) => (
                    <div style={{ 
                      border: '1px solid #e8e4dd', 
                      borderRadius: '8px', 
                      padding: '10px 12px', 
                      color: items.length ? '#4a4a4a' : '#999' 
                    }}>
                      {items.length > 0 
                        ? items.map(item => item.label).join('、') 
                        : '请选择周几'}
                    </div>
                  )}
                </Picker>
              </Form.Item>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Form.Item
                  label="开始时间"
                  name="startTime"
                  rules={[{ required: true, message: '请选择开始时间' }]}
                >
                  <Picker
                    columns={[
                      TIME_OPTIONS.map(time => ({ ...time, key: time.value }))
                    ]}
                  >
                    {(items) => (
                      <div style={{ 
                        border: '1px solid #e8e4dd', 
                        borderRadius: '8px', 
                        padding: '10px 12px', 
                        color: items[0] ? '#4a4a4a' : '#999' 
                      }}>
                        {items[0]?.label || '请选择'}
                      </div>
                    )}
                  </Picker>
                </Form.Item>

                <Form.Item
                  label="结束时间"
                  name="endTime"
                  rules={[{ required: true, message: '请选择结束时间' }]}
                >
                  <Picker
                    columns={[
                      TIME_OPTIONS.map(time => ({ ...time, key: time.value }))
                    ]}
                  >
                    {(items) => (
                      <div style={{ 
                        border: '1px solid #e8e4dd', 
                        borderRadius: '8px', 
                        padding: '10px 12px', 
                        color: items[0] ? '#4a4a4a' : '#999' 
                      }}>
                        {items[0]?.label || '请选择'}
                      </div>
                    )}
                  </Picker>
                </Form.Item>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Form.Item
                  label="开始日期"
                  name="startDate"
                  rules={[{ required: true, message: '请选择开始日期' }]}
                >
                  <Picker
                    columns={[
                      Array.from({ length: 365 }, (_, i) => {
                        const date = dayjs().add(i, 'day').toDate()
                        return {
                          label: dayjs(date).format('YYYY-MM-DD'),
                          value: dayjs(date).valueOf(),
                          key: dayjs(date).valueOf()
                        }
                      })
                    ]}
                  >
                    {(items) => (
                      <div style={{ 
                        border: '1px solid #e8e4dd', 
                        borderRadius: '8px', 
                        padding: '10px 12px', 
                        color: items[0] ? '#4a4a4a' : '#999' 
                      }}>
                        {items[0]?.label || '请选择'}
                      </div>
                    )}
                  </Picker>
                </Form.Item>

                <Form.Item
                  label="持续周数"
                  name="weeks"
                  rules={[{ required: true, message: '请输入持续周数' }]}
                >
                  <Input type="number" placeholder="如：16" min="1" />
                </Form.Item>
              </div>

              <Form.Item
                label="颜色标签"
                name="color"
              >
                <Picker
                  columns={[
                    COLOR_OPTIONS.map(color => ({ ...color, key: color.value }))
                  ]}
                >
                  {(items) => (
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      border: '1px solid #e8e4dd', 
                      borderRadius: '8px', 
                      padding: '10px 12px',
                      color: '#4a4a4a'
                    }}>
                      <div style={{ 
                        width: '20px', 
                        height: '20px', 
                        borderRadius: '4px', 
                        backgroundColor: items[0]?.value || '#4A90E2' 
                      }} />
                      <span>{items[0]?.label || '蓝色（工作）'}</span>
                    </div>
                  )}
                </Picker>
              </Form.Item>

              <div style={{ marginTop: '24px' }}>
                <Button
                  type="submit"
                  color="primary"
                  block
                  style={{ backgroundColor: '#c9a997', borderColor: '#c9a997' }}
                >
                  添加课程
                </Button>
              </div>
            </Form>
          </div>
        }
      />

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

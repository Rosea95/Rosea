// 日程页交互修复 - 2026-06-16
import { useState, useEffect } from 'react'
import { Calendar, List, Checkbox, Badge, Button, Space, Modal, Form, Input, Picker, Toast, Selector } from 'antd-mobile'
import { UnorderedListOutline, CalendarOutline, MessageOutline, AppOutline } from 'antd-mobile-icons'
import { getDB, generateId } from '../utils/db'
import { getGreetingTitle } from '../utils/greeting'
import type { Todo } from '../types'
import dayjs from 'dayjs'
import './Schedule.css'

// 预定义颜色选项
const COLOR_OPTIONS = [
  { label: '蓝色（工作）', value: '#4A90E2' },
  { label: '粉色（个人）', value: '#E8A0BF' },
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
  { label: '课程', value: 'course' },
  { label: '个人待办', value: 'normal' }
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
  const [showTodoModal, setShowTodoModal] = useState(false)
  const [filterMode, setFilterMode] = useState<'all' | 'course' | 'normal'>('all')
  const [form] = Form.useForm()
  const [todoForm] = Form.useForm()
  const [courseForm] = Form.useForm()

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
      
      // 更新当前选中日期的待办
      const dayTodos = getTodosForDate(selectedDate, sortedTodos)
      setSelectedDateTodos(dayTodos)
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
        
        // 重新加载数据以确保视图同步
        await loadTodos()
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
  const getTodosForDate = (date: Date, allTodos: Todo[] = todos) => {
    const dateStart = dayjs(date).startOf('day').valueOf()
    const dateEnd = dayjs(date).endOf('day').valueOf()
    return allTodos.filter(todo => {
      if (!todo.dueDate) return false
      return todo.dueDate >= dateStart && todo.dueDate <= dateEnd
    })
  }

  // 日历视图：点击日期
  const handleDateClick = (date: Date) => {
    setSelectedDate(date)
    const dayTodos = getTodosForDate(date)
    setSelectedDateTodos(dayTodos)
    
    // 点击日期自动弹出添加待办，并预填日期
    todoForm.setFieldsValue({
      date: [dayjs(date).startOf('day').valueOf()],
      time: ['09:00']
    })
    setShowTodoModal(true)
  }

  // 添加普通待办
  const handleAddTodo = async (values: any) => {
    try {
      const db = await getDB()
      const now = Date.now()
      const { title, date, time, note } = values
      
      const dateVal = Array.isArray(date) ? date[0] : date
      const timeVal = Array.isArray(time) ? time[0] : time

      let dueDate = dayjs(dateVal)
      if (timeVal) {
        const [hour, minute] = timeVal.split(':').map(Number)
        dueDate = dueDate.hour(hour).minute(minute).second(0).millisecond(0)
      } else {
        dueDate = dueDate.hour(0).minute(0).second(0).millisecond(0)
      }

      const newTodo: Todo = {
        id: generateId(),
        title,
        description: note || '',
        completed: false,
        priority: 'medium',
        dueDate: dueDate.valueOf(),
        createdAt: now,
        type: 'normal'
      }

      await db.add('todos', newTodo)
      await loadTodos()
      
      Toast.show({
        icon: 'success',
        content: '添加成功'
      })
      
      setShowTodoModal(false)
      todoForm.resetFields()
    } catch (error) {
      console.error('添加待办失败:', error)
      Toast.show({ content: '添加失败' })
    }
  }

  // 批量生成课程待办
  const handleAddCourse = async (values: any) => {
    try {
      const db = await getDB()
      const batchId = generateId()
      const now = Date.now()
      
      // 解析参数
      const { courseName, location, weekdays, startTime, endTime, startDate, weeks, color } = values
      const totalWeeks = parseInt(weeks) || 1
      const startDay = Array.isArray(startDate) ? startDate[0] : startDate
      const startTimeVal = Array.isArray(startTime) ? startTime[0] : startTime
      const endTimeVal = Array.isArray(endTime) ? endTime[0] : endTime
      const colorVal = Array.isArray(color) ? color[0] : color

      // 解析时间（HH:MM）
      const [startHour, startMinute] = startTimeVal.split(':').map(Number)
      const [endHour, endMinute] = endTimeVal.split(':').map(Number)
      
      // 开始日期
      let startDateTime = dayjs(startDay || dayjs().startOf('day'))
      
      // 批量生成所有符合条件的待办
      const courseTodos: Todo[] = []
      const weekdayList = Array.isArray(weekdays) ? weekdays : [weekdays]
      
      for (let w = 0; w < totalWeeks; w++) {
        for (const dw of weekdayList) {
          // 计算该周对应周几的日期
          let targetDate = startDateTime.add(w, 'week').day(dw)
          
          // 如果计算出的日期早于开始日期，则跳到下一周的该天
          if (targetDate.isBefore(startDateTime, 'day')) {
            targetDate = targetDate.add(1, 'week')
          }
          
          // 确保不超过总周数范围
          if (targetDate.isAfter(startDateTime.add(totalWeeks, 'week'))) continue

          const courseStart = targetDate.hour(startHour).minute(startMinute).second(0).millisecond(0)
          const courseEnd = targetDate.hour(endHour).minute(endMinute).second(0).millisecond(0)
          
          courseTodos.push({
            id: generateId(),
            title: courseName,
            description: location ? `地点：${location}` : '',
            completed: false,
            priority: 'medium',
            dueDate: courseStart.valueOf(),
            createdAt: now,
            batchId: batchId,
            type: 'course',
            location: location,
            courseColor: colorVal,
            courseEndTime: courseEnd.valueOf()
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
      courseForm.resetFields()
      
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

      {/* 页面顶部添加两个并排按钮 */}
      <div className="action-buttons">
        <Button 
          onClick={() => {
            courseForm.setFieldsValue({
              weeks: '16',
              color: ['#4A90E2'],
              startDate: [dayjs().startOf('day').valueOf()]
            })
            setShowCourseModal(true)
          }} 
          className="btn-add-course"
          block
        >
          + 添加课程/工作
        </Button>
        <Button 
          onClick={() => {
            todoForm.setFieldsValue({
              date: [dayjs().startOf('day').valueOf()],
              time: ['09:00']
            })
            setShowTodoModal(true)
          }} 
          className="btn-add-todo"
          block
        >
          + 添加待办
        </Button>
      </div>

      {/* 列表视图 */}
      {viewMode === 'list' && (
        <div className="todos-list">
          <div className="card">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#4a4a4a', margin: 0 }}>待办事项</h3>
                  <Badge 
                    content={getFilteredTodos(todos).filter(t => !t.completed).length} 
                    style={{ backgroundColor: '#c9a997' }} 
                  />
                </div>
              </div>
              
              {/* 筛选标签 */}
              <div className="filter-tags">
                {FILTER_OPTIONS.map(opt => (
                  <div 
                    key={opt.value}
                    className={`filter-tag ${filterMode === opt.value ? 'active' : ''}`}
                    onClick={() => setFilterMode(opt.value as any)}
                  >
                    {opt.label}
                  </div>
                ))}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#4a4a4a', margin: 0 }}>日历</h3>
              </div>
            </div>
            <Calendar
              selectionMode="single"
              value={selectedDate}
              onChange={(val: Date | null) => { if (val) handleDateClick(val) }}
              style={{ '--calendar-active-color': '#c9a997' } as React.CSSProperties}
              renderDate={(date: Date) => {
                const dayTodos = getTodosForDate(date)
                const hasTodo = dayTodos.length > 0
                const courseTodo = dayTodos.find(t => t.type === 'course')
                
                return (
                  <div 
                    className="calendar-date-cell"
                    style={courseTodo ? {
                      backgroundColor: `${courseTodo.courseColor}20`,
                      borderRadius: '4px',
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center'
                    } : {}}
                  >
                    <div>{date.getDate()}</div>
                    {hasTodo && (
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'center', 
                        gap: '2px',
                        marginTop: '2px'
                      }}>
                        {dayTodos.some(t => t.type !== 'course') && (
                          <div className="todo-dot" style={{ backgroundColor: '#c9a997' }} />
                        )}
                        {courseTodo && (
                          <div className="todo-dot" style={{ backgroundColor: courseTodo.courseColor || '#4A90E2' }} />
                        )}
                      </div>
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

      {/* 添加待办弹窗 */}
      <Modal
        visible={showTodoModal}
        onClose={() => setShowTodoModal(false)}
        title="添加待办"
        content={
          <div style={{ padding: '8px 0' }}>
            <Form
              form={todoForm}
              layout="vertical"
              onFinish={handleAddTodo}
              initialValues={{
                date: [dayjs().startOf('day').valueOf()],
                time: ['09:00']
              }}
            >
              <Form.Item
                label="标题"
                name="title"
                rules={[{ required: true, message: '请输入标题' }]}
              >
                <Input placeholder="想做什么？" />
              </Form.Item>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Form.Item
                  label="日期"
                  name="date"
                  rules={[{ required: true, message: '请选择日期' }]}
                >
                  <Picker
                    columns={[
                      Array.from({ length: 365 }, (_, i) => {
                        const date = dayjs().add(i - 30, 'day').toDate()
                        return {
                          label: dayjs(date).format('YYYY-MM-DD'),
                          value: dayjs(date).startOf('day').valueOf(),
                          key: dayjs(date).startOf('day').valueOf()
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
                  label="时间（可选）"
                  name="time"
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
                        {items[0]?.label || '不设时间'}
                      </div>
                    )}
                  </Picker>
                </Form.Item>
              </div>

              <Form.Item
                label="备注（可选）"
                name="note"
              >
                <Input placeholder="添加备注..." />
              </Form.Item>

              <div style={{ marginTop: '24px' }}>
                <Button
                  type="submit"
                  color="primary"
                  block
                  style={{ backgroundColor: '#E8A0BF', borderColor: '#E8A0BF' }}
                >
                  确定添加
                </Button>
              </div>
            </Form>
          </div>
        }
      />

      {/* 添加课程表单弹窗 */}
      <Modal
        visible={showCourseModal}
        onClose={() => setShowCourseModal(false)}
        title="添加课程/工作安排"
        content={
          <div style={{ padding: '8px 0' }}>
            <Form
              form={courseForm}
              layout="vertical"
              initialValues={{
                weeks: '16',
                color: ['#4A90E2'],
                startDate: [dayjs().startOf('day').valueOf()]
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
                <Selector
                  options={WEEKDAY_OPTIONS}
                  multiple
                  style={{
                    '--border-radius': '8px',
                    '--checked-color': '#c9a997',
                  }}
                />
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
                        const date = dayjs().add(i - 30, 'day').toDate()
                        return {
                          label: dayjs(date).format('YYYY-MM-DD'),
                          value: dayjs(date).startOf('day').valueOf(),
                          key: dayjs(date).startOf('day').valueOf()
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
                  <Input 
                    type="number" 
                    placeholder="如：16" 
                    min={1} 
                  />
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
                        backgroundColor: (items[0]?.value as string) || '#4A90E2' 
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
                  style={{ backgroundColor: '#4A90D9', borderColor: '#4A90D9' }}
                >
                  批量添加课程
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

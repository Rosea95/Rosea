import { useState, useRef, useEffect } from 'react'
import { Input, Button } from 'antd-mobile'
import type { InputRef } from 'antd-mobile/es/components/input'
import { SendOutline, UserOutline } from 'antd-mobile-icons'
import { getDB, generateId } from '../utils/db'
import { backupToLocalStorage } from '../utils/backup'
import { triggerVibrate } from '../utils/greeting'
import type { ChatMessage, Todo, FinanceRecord, DiaryRecord, HealthRecord } from '../types'
import { parseWithAI, ParseResult } from '../services/deepseekService'
import { parseTodoFromMessage, parseRecurringTask } from '../utils/todoParser'
import dayjs from 'dayjs'
import './Chat.css'

const DEFAULT_CONVERSATION_ID = 'default-chat'

function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<InputRef>(null)

  useEffect(() => {
    loadMessages()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadMessages = async () => {
    try {
      const db = await getDB()
      const allMessages = await db.getAllFromIndex('messages', 'by-conversationId', DEFAULT_CONVERSATION_ID)
      const sortedMessages = allMessages.sort((a, b) => a.timestamp - b.timestamp)
      setMessages(sortedMessages)
    } catch (error) {
      console.error('加载历史消息失败:', error)
    }
  }

  // 本地关键词解析（作为 AI 失败后的兜底）
  const parseLocalMessage = (message: string) => {
    const msg = message.trim()

    // 1. 优先检查是否为循环任务
    const recurring = parseRecurringTask(msg)
    if (recurring.isRecurring && recurring.dates.length > 0) {
      console.log('[本地解析] 识别为循环任务:', recurring)
      return { type: 'recurring', ...recurring }
    }

    // 2. 记账关键词（金额相关）
    const moneyMatch = msg.match(/(?:花了?|支出|消费|买了?)\s*(\d+(?:\.\d+)?)\s*(元|块|块钱)?|(\d+(?:\.\d+)?)\s*(元|块|块钱)/)
    if (moneyMatch) {
      const amount = parseFloat(moneyMatch[1] || moneyMatch[3])
      let category = '其他'
      if (msg.includes('午餐') || msg.includes('晚餐') || msg.includes('早餐') || msg.includes('吃饭') || msg.includes('饭') || msg.includes('食堂')) category = '餐饮'
      if (msg.includes('打车') || msg.includes('地铁') || msg.includes('公交') || msg.includes('油费')) category = '交通'
      if (msg.includes('购物') || msg.includes('买') || msg.includes('淘宝') || msg.includes('超市')) category = '购物'
      if (msg.includes('零食') || msg.includes('水果') || msg.includes('饮料') || msg.includes('奶茶')) category = '零食'

      const title = msg.replace(/(?:花了?|支出|消费|买了?)\s*\d+(?:\.\d+)?\s*(元|块|块钱)?|\d+(?:\.\d+)?\s*(元|块|块钱)/, '').trim() || '支出'
      console.log('[本地解析] 识别为记账:', title, amount, category)
      return { type: 'finance', title, amount, category }
    }

    // 3. 打卡/运动完成（打卡 跑步 30分钟）
    const isCheckIn = msg.startsWith('打卡') || msg.includes('完成了') || msg.includes('已完成')
    if (isCheckIn) {
      const sportKeywords = ['跑步', '游泳', '健身', '瑜伽', '深蹲', '跳绳', '打球', '骑行', '走路', '冥想', '运动']
      const matchedSport = sportKeywords.find(k => msg.includes(k))
      if (matchedSport) {
        const durationMatch = msg.match(/(\d+)\s*(分钟|小时|min|h)/)
        let duration = durationMatch ? parseInt(durationMatch[1]) : undefined
        if (duration && durationMatch && (durationMatch[2].includes('小时') || durationMatch[2] === 'h')) {
          duration *= 60
        }
        return { type: 'health', title: matchedSport, duration }
      }
    }

    // 4. 待办关键词
    const todoResult = parseTodoFromMessage(msg)
    if (todoResult.hasTime) {
      console.log('[本地解析] 识别为待办:', todoResult.task, todoResult.dueDate)
      return { type: 'todo', title: todoResult.task, dueDate: todoResult.dueDate?.getTime() }
    }

    // 5. 日记/心情关键词
    const diaryKeywords = ['心情', '开心', '难过', '高兴', '累', '郁闷', '焦虑', '放松', '舒服', '感觉', '今天我', '日记']
    if (diaryKeywords.some(k => msg.includes(k))) {
      console.log('[本地解析] 识别为日记:', msg)
      return { type: 'diary', title: msg }
    }

    // ===== 无法识别 =====
    console.log('[本地解析] 无法识别:', message)
    return { type: 'unknow' }
  }

  // 处理 AI 返回的解析结果
  const handleAIResult = async (aiResult: ParseResult, db: Awaited<ReturnType<typeof getDB>>, originalText: string): Promise<string> => {
    const now = Date.now()
    
    switch (aiResult.action) {
      case 'addTodo': {
        const dueDate = aiResult.data.time ? dayjs(aiResult.data.time).valueOf() : undefined
        const todo: Todo = {
          id: generateId(),
          title: aiResult.data.title || '待办事项',
          completed: false,
          priority: 'medium',
          dueDate: dueDate,
          createdAt: now,
          originalText,
        }
        await db.add('todos', todo)
        console.log('数据已保存，原文:', originalText)
        await backupToLocalStorage()
        triggerVibrate(15)
        
        let reply = `✓ 已记录待办：${todo.title}`
        if (dueDate) {
          reply += `，时间：${dayjs(dueDate).format('YYYY-MM-DD HH:mm')}`
        }
        return reply
      }
      
      case 'addCycle': {
        // 对于循环任务，使用本地解析器处理
        const localResult = parseLocalMessage(originalText)
        if (localResult.type === 'recurring') {
          return await handleLocalResult(localResult, db, originalText)
        }
        // 如果本地解析没成功，回退到普通待办
        const todo: Todo = {
          id: generateId(),
          title: aiResult.data.title || '待办事项',
          completed: false,
          priority: 'medium',
          dueDate: aiResult.data.time ? dayjs(aiResult.data.time).valueOf() : undefined,
          createdAt: now,
          originalText,
        }
        await db.add('todos', todo)
        console.log('数据已保存，原文:', originalText)
        await backupToLocalStorage()
        triggerVibrate(15)
        return `✓ 已记录待办：${todo.title}`
      }
      
      case 'addFin': {
        const finance: FinanceRecord = {
          id: generateId(),
          type: 'expense',
          category: aiResult.data.category || '其他',
          amount: aiResult.data.amount || 0,
          date: now,
          note: aiResult.data.title || aiResult.data.note || '支出',
          originalText,
        }
        await db.add('financeRecords', finance)
        console.log('数据已保存，原文:', originalText)
        await backupToLocalStorage()
        triggerVibrate(15)
        return `✓ 已记录记账：${finance.note}，${finance.amount}元，分类：${finance.category}`
      }
      
      case 'addDiary': {
        const diary: DiaryRecord = {
          id: generateId(),
          title: aiResult.data.title || '日记',
          createdAt: now,
          originalText,
        }
        await db.add('diary', diary)
        console.log('数据已保存，原文:', originalText)
        await backupToLocalStorage()
        triggerVibrate(15)
        return `✓ 已记录日记：${diary.title}`
      }
      
      case 'addHealth': {
        // 尝试从原始消息中提取时长
        const durationMatch = originalText.match(/(\d+)\s*(分钟|小时|min|h)/)
        let duration = durationMatch ? parseInt(durationMatch[1]) : undefined
        if (duration && durationMatch && (durationMatch[2].includes('小时') || durationMatch[2] === 'h')) {
          duration *= 60
        }

        const health: HealthRecord = {
          id: generateId(),
          title: aiResult.data.title || '健康活动',
          duration: duration,
          createdAt: now,
          originalText,
        }
        await db.add('health', health)
        console.log('数据已保存，原文:', originalText)
        await backupToLocalStorage()
        triggerVibrate(15)
        return `✓ 已记录健康活动：${health.title}${duration ? ` ${duration}分钟` : ''}`
      }
      
      case 'unknown':
      default:
        // AI 无法识别，走本地兜底
        return ''
    }
  }

  // 处理本地解析结果并写入数据库
  const handleLocalResult = async (parsed: any, db: Awaited<ReturnType<typeof getDB>>, originalText: string): Promise<string> => {
    const now = Date.now()
    
    switch (parsed.type) {
      case 'recurring': {
        const todos: Todo[] = parsed.dates.map((date: Date) => ({
          id: generateId(),
          title: parsed.task,
          completed: false,
          priority: 'medium',
          dueDate: date.getTime(),
          createdAt: now,
          batchId: parsed.batchId,
          originalText,
        }))
        for (const todo of todos) {
          await db.add('todos', todo)
          console.log('数据已保存，原文:', originalText)
        }
        await backupToLocalStorage()
        triggerVibrate(20)
        return `已生成循环任务：${parsed.task}，共 ${parsed.dates.length} 个。`
      }

      case 'todo': {
        const todo: Todo = {
          id: generateId(),
          title: parsed.title,
          completed: false,
          priority: 'medium',
          dueDate: parsed.dueDate,
          createdAt: now,
          originalText,
        }
        await db.add('todos', todo)
        console.log('数据已保存，原文:', originalText)
        await backupToLocalStorage()
        triggerVibrate(15)
        
        let reply = `待办：${parsed.title}`
        if (parsed.dueDate) {
          reply += `，时间：${dayjs(parsed.dueDate).format('YYYY-MM-DD HH:mm')}`
        }
        return reply
      }
      
      case 'finance': {
        const finance: FinanceRecord = {
          id: generateId(),
          type: 'expense',
          category: parsed.category || '其他',
          amount: parsed.amount,
          date: now,
          note: parsed.title,
          originalText,
        }
        await db.add('financeRecords', finance)
        console.log('数据已保存，原文:', originalText)
        await backupToLocalStorage()
        triggerVibrate(15)
        return `记账：${parsed.title || '支出'}，${parsed.amount}元，分类：${parsed.category || '其他'}`
      }
      
      case 'diary': {
        const diary: DiaryRecord = {
          id: generateId(),
          title: parsed.title,
          createdAt: now,
          originalText,
        }
        await db.add('diary', diary)
        console.log('数据已保存，原文:', originalText)
        await backupToLocalStorage()
        triggerVibrate(15)
        return `日记：${parsed.title}`
      }
      
      case 'health': {
        const health: HealthRecord = {
          id: generateId(),
          title: parsed.title,
          duration: parsed.duration,
          createdAt: now,
          originalText,
        }
        await db.add('health', health)
        console.log('数据已保存，原文:', originalText)
        await backupToLocalStorage()
        triggerVibrate(15)
        return `健康活动：${parsed.title}${parsed.duration ? ` ${parsed.duration}分钟` : ''}`
      }
      
      default:
        return ''
    }
  }

  const sendMessage = async () => {
    const currentInput = inputValue.trim()
    if (!currentInput) return

    setInputValue('')
    setIsLoading(true)

    try {
      const db = await getDB()
      const now = Date.now()

      // 保存用户消息
      const userMessage: ChatMessage = {
        id: generateId(),
        conversationId: DEFAULT_CONVERSATION_ID,
        senderId: 'user',
        content: currentInput,
        timestamp: now,
        type: 'text'
      }
      await db.add('messages', userMessage)
      setMessages(prev => [...prev, userMessage])

      let replyContent = ''
      let usedLocalParser = false

      try {
        // 1. 优先使用 AI 解析
        console.log('[消息处理] 尝试使用 AI 解析...')
        const aiResult = await parseWithAI(currentInput)
        
        if (aiResult.action !== 'unknown') {
          console.log('[消息处理] AI 解析成功:', aiResult)
          replyContent = await handleAIResult(aiResult, db, currentInput)
        } else {
          // AI 返回 unknown，尝试本地解析
          console.log('[消息处理] AI 返回 unknown，尝试本地解析...')
          usedLocalParser = true
          const localResult = parseLocalMessage(currentInput)
          if (localResult.type !== 'unknow') {
            replyContent = await handleLocalResult(localResult, db, currentInput)
            replyContent = `✓ ${replyContent}`
          }
        }
      } catch (aiError) {
        // 2. AI 调用失败，静默切换到本地解析
        console.log('[消息处理] AI 解析失败，切换到本地解析:', aiError)
        usedLocalParser = true
        const localResult = parseLocalMessage(currentInput)
        
        if (localResult.type !== 'unknow') {
          replyContent = await handleLocalResult(localResult, db, currentInput)
          replyContent = `✓ ${replyContent}`
        }
      }

      // 如果 AI 和本地都无法识别，显示默认提示
      if (!replyContent) {
        replyContent = '我是你的生活管家，可以帮你记待办、记账、记运动和心情。试试说"明天下午3点开会"、"午餐花了30元"、"跑步30分钟"、"今天心情不错"哦~'
      } else if (usedLocalParser) {
        // 如果使用了本地解析，在末尾添加提示图标
        replyContent = `${replyContent} 🤖`
      }

      // 保存系统回复
      const systemMessage: ChatMessage = {
        id: generateId(),
        conversationId: DEFAULT_CONVERSATION_ID,
        senderId: 'system',
        content: replyContent,
        timestamp: now,
        type: 'text'
      }
      await db.add('messages', systemMessage)
      setMessages(prev => [...prev, systemMessage])

    } catch (error) {
      console.error('发送消息失败:', error)
    } finally {
      setIsLoading(false)
      inputRef.current?.nativeElement?.focus()  // 保持输入框聚焦
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="chat-container">
      <div className="page-header">
        <h1 className="page-title">聊天</h1>
        <p className="page-subtitle">与 Rosea 助手对话</p>
      </div>

      <div className="messages-area">
        {messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💬</div>
            <p className="empty-text">开始和 Rosea 聊天吧！</p>
            <p className="empty-hint">试试说："明天下午3点开会"</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`message-bubble ${msg.senderId === 'user' ? 'user-message' : 'system-message'}`}
            >
              {msg.senderId === 'system' && (
                <div className="avatar system-avatar">
                  <UserOutline style={{ color: '#ffffff', fontSize: '16px' }} />
                </div>
              )}
              <div className="message-content">
                <div className="message-text">{msg.content}</div>
                <div className="message-time">{formatTime(msg.timestamp)}</div>
              </div>
              {msg.senderId === 'user' && (
                <div className="avatar user-avatar">
                  <UserOutline style={{ color: '#ffffff', fontSize: '16px' }} />
                </div>
              )}
            </div>
          ))
        )}
        {isLoading && (
          <div className="message-bubble system-message">
            <div className="avatar system-avatar">
              <UserOutline style={{ color: '#ffffff', fontSize: '16px' }} />
            </div>
            <div className="message-content">
              <div className="message-text ai-loading">思考中...</div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <div style={{ display: 'flex', gap: '8px' }}>
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={setInputValue}
            onKeyDown={handleKeyDown}
            placeholder="说点什么..."
            style={{ flex: 1 }}
          />
          <Button
            color="primary"
            onClick={sendMessage}
            disabled={!inputValue.trim() || isLoading}
            style={{ backgroundColor: '#c9a997' }}
          >
            <SendOutline />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default Chat

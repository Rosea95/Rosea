import { useState, useRef, useEffect } from 'react'
import { Input, Button } from 'antd-mobile'
import type { InputRef } from 'antd-mobile/es/components/input'
import { SendOutline, UserOutline } from 'antd-mobile-icons'
import { getDB, generateId } from '../utils/db'
import { backupToLocalStorage } from '../utils/backup'
import { triggerVibrate } from '../utils/greeting'
import type { ChatMessage, Todo, FinanceRecord, DiaryRecord, HealthRecord } from '../types'
import { callDeepSeekSportIntent } from '../services/deepseekService'
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

  // 本地关键词解析（处理非运动相关输入：记账、待办、日记）
  const parseLocalMessage = (message: string) => {
    const msg = message

    // ===== 记账关键词（金额相关）=====
    const moneyMatch = message.match(/花了?\s*(\d+)\s*(元|块|块钱)|(\d+)\s*(元|块|块钱)/)
    if (moneyMatch) {
      const amount = parseInt(moneyMatch[1] || moneyMatch[3])
      let category = '其他'
      if (msg.includes('午餐') || msg.includes('晚餐') || msg.includes('早餐') || msg.includes('吃饭') || msg.includes('饭')) category = '餐饮'
      if (msg.includes('打车') || msg.includes('地铁') || msg.includes('公交')) category = '交通'
      if (msg.includes('购物') || msg.includes('买')) category = '购物'

      const title = message.replace(/花了?\s*\d+\s*(元|块|块钱)|\d+\s*(元|块|块钱)/, '').trim() || '支出'
      console.log('[本地解析] 识别为记账:', title, amount, category)
      return { type: 'finance', title, amount, category }
    }

    // ===== 待办关键词（时间相关）=====
    const hasTimeWord = /明天|后天|大后天|下周|周[一二三四五六日]|下午|上午|晚上|早上|傍晚|\d+点/.test(msg)
    if (hasTimeWord) {
      const title = message.replace(/明天|后天|大后天|下周|周[一二三四五六日]|下午|上午|晚上|早上|傍晚|\d+点/g, '').trim() || '待办事项'
      const dueDate = parseTimeFromMessage(message)
      console.log('[本地解析] 识别为待办:', title, dueDate)
      return { type: 'todo', title, dueDate }
    }

    // ===== 日记/心情关键词 =====
    const diaryKeywords = ['心情', '开心', '难过', '高兴', '累', '郁闷', '焦虑', '放松', '舒服', '感觉']
    if (diaryKeywords.some(k => msg.includes(k))) {
      console.log('[本地解析] 识别为日记:', message)
      return { type: 'diary', title: message }
    }

    // ===== 无法识别 =====
    console.log('[本地解析] 无法识别:', message)
    return { type: 'unknow' }
  }

  // 时间解析
  const parseTimeFromMessage = (message: string): number | undefined => {
    const now = dayjs()
    let baseDate = now
    
    // 日期关键词
    if (message.includes('大后天')) baseDate = now.add(3, 'day')
    else if (message.includes('后天')) baseDate = now.add(2, 'day')
    else if (message.includes('明天')) baseDate = now.add(1, 'day')
    else if (message.includes('今天')) baseDate = now
    
    // 时间关键词
    let hour = 9, minute = 0
    const timeMatch = message.match(/(\d+)\s*点\s*(\d+)?\s*分?/)
    if (timeMatch) {
      hour = parseInt(timeMatch[1])
      minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0
    }
    
    // 修正下午时间
    if (message.includes('下午') || message.includes('晚上') || message.includes('傍晚')) {
      if (hour < 12) hour += 12
    }
    
    // 傍晚默认18点
    if (message.includes('傍晚') && !timeMatch) {
      hour = 18
    }
    
    const resultDate = baseDate.hour(hour).minute(minute).second(0)
    
    // 如果时间已过，加一天
    if (resultDate.isBefore(now)) {
      return resultDate.add(1, 'day').valueOf()
    }
    
    return resultDate.valueOf()
  }

  // 处理解析结果并写入数据库
  const handleParsedResult = async (parsed: any, db: Awaited<ReturnType<typeof getDB>>): Promise<string> => {
    const now = Date.now()
    
    switch (parsed.type) {
      case 'todo': {
        const todo: Todo = {
          id: generateId(),
          title: parsed.title,
          completed: false,
          priority: 'medium',
          dueDate: parsed.dueDate,
          createdAt: now,
        }
        await db.add('todos', todo)
        await backupToLocalStorage()  // 自动备份
        triggerVibrate(15)  // 震动反馈
        
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
        }
        await db.add('financeRecords', finance)
        await backupToLocalStorage()  // 自动备份
        triggerVibrate(15)  // 震动反馈
        return `记账：${parsed.title || '支出'}，${parsed.amount}元，分类：${parsed.category || '其他'}`
      }
      
      case 'diary': {
        const diary: DiaryRecord = {
          id: generateId(),
          title: parsed.title,
          createdAt: now,
        }
        await db.add('diary', diary)
        await backupToLocalStorage()  // 自动备份
        triggerVibrate(15)  // 震动反馈
        return `日记：${parsed.title}`
      }
      
      case 'health': {
        const health: HealthRecord = {
          id: generateId(),
          title: parsed.title,
          duration: parsed.duration ? parseInt(parsed.duration) : undefined,
          createdAt: now,
        }
        await db.add('health', health)
        await backupToLocalStorage()  // 自动备份
        triggerVibrate(15)  // 震动反馈
        console.log('[数据库] 健康记录已写入:', health)
        return `健康活动：${parsed.title}${parsed.duration ? ` ${parsed.duration}` : ''}`
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

      // ===== 运动关键词检测（优先调用API）=====
      const sportKeywords = ['跑步', '游泳', '健身', '瑜伽', '深蹲', '跳绳', '打球', '骑行', '走路', '冥想']
      const matchedSportKeyword = sportKeywords.find(k => currentInput.includes(k))

      if (matchedSportKeyword) {
        console.log('[运动检测] 检测到运动关键词:', matchedSportKeyword)
        
        // 提取运动时长
        const durationMatch = currentInput.match(/(\d+)\s*(分钟|小时|卡|公里|米|次)/)
        const duration = durationMatch ? durationMatch[0] : ''

        // 调用 DeepSeek API 判断意图
        const sportIntent = await callDeepSeekSportIntent(currentInput)
        
        if (sportIntent) {
          console.log('[运动API] 返回结果:', sportIntent)
          
          if (sportIntent.intent === 'log') {
            // 记录健康活动
            const health: HealthRecord = {
              id: generateId(),
              title: sportIntent.title,
              duration: duration ? parseInt(duration) : undefined,
              createdAt: now,
            }
            await db.add('health', health)
            await backupToLocalStorage()
            triggerVibrate(15)
            replyContent = `✓ 已记录健康活动：${sportIntent.title}${duration ? ` ${duration}` : ''}`
          } else {
            // 创建待办
            const todo: Todo = {
              id: generateId(),
              title: sportIntent.title,
              completed: false,
              priority: 'medium',
              createdAt: now,
            }
            await db.add('todos', todo)
            await backupToLocalStorage()
            triggerVibrate(15)
            replyContent = `好的，已将${sportIntent.title}加入待办。完成后对我说"打卡 ${sportIntent.title}"就可以啦！`
          }
        } else {
          // API 调用失败，降级处理：创建待办
          console.log('[运动API] 调用失败，降级为待办')
          const todo: Todo = {
            id: generateId(),
            title: matchedSportKeyword,
            completed: false,
            priority: 'medium',
            createdAt: now,
          }
          await db.add('todos', todo)
          await backupToLocalStorage()
          triggerVibrate(15)
          replyContent = `好的，已将${matchedSportKeyword}加入待办。如果已完成，对我说"打卡 ${matchedSportKeyword}"。`
        }
        
        // 添加引导语
        replyContent += ' 💡 提示：说"打卡 [活动]"记录完成，说"计划 [活动]"添加待办。'
      } else {
        // 非运动输入，使用本地解析
        const parsed = parseLocalMessage(currentInput)

        if (parsed.type === 'unknow') {
          replyContent = '我是你的生活管家，可以帮你记待办、记账、记运动和心情。试试说"明天下午3点开会"、"午餐花了30元"、"跑步30分钟"、"今天心情不错"哦~'
        } else {
          const recordText = await handleParsedResult(parsed, db)
          replyContent = `✓ 已记录：${recordText}`
        }
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
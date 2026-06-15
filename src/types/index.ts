export interface ChatMessage {
  id: string
  conversationId: string
  senderId: string
  content: string
  timestamp: number
  type: 'text' | 'image' | 'voice'
}

export interface Conversation {
  id: string
  name: string
  avatar?: string
  lastMessage?: string
  lastMessageTime?: number
  unreadCount: number
}

export interface Todo {
  id: string
  title: string
  description?: string
  completed: boolean
  priority: 'high' | 'medium' | 'low'
  dueDate?: number
  createdAt: number
  batchId?: string  // 用于标记循环任务的批次ID
  originalText?: string // 原始聊天记录
}

export interface CalendarEvent {
  id: string
  title: string
  description?: string
  startDate: number
  endDate: number
  location?: string
  participants?: string[]
  originalText?: string // 原始聊天记录
}

export interface FinanceRecord {
  id: string
  type: 'income' | 'expense'
  category: string
  amount: number
  date: number
  note?: string
  originalText?: string // 原始聊天记录
}

export interface FinanceCategory {
  id: string
  name: string
  type: 'income' | 'expense'
  icon: string
}

export interface ReviewEntry {
  id: string
  date: number
  content: string
  rating: number
  tags?: string[]
}

// 日记/心情记录（AI解析 addDiary）
export interface DiaryRecord {
  id: string
  title: string        // 事项标题
  content?: string     // 详细内容/备注
  emotion?: 'positive' | 'negative' | 'neutral'  // 情绪极性
  createdAt: number   // 创建时间
  source?: string      // 来源标识，如 'ai'
  originalText?: string // 原始聊天记录
}

// 健康/运动记录（AI解析 addHealth）
export interface HealthRecord {
  id: string
  title: string        // 事项标题
  category?: string     // 分类：运动/养生/护肤
  duration?: number    // 持续时间（分钟）
  createdAt: number    // 创建时间
  source?: string       // 来源标识，如 'ai'
  originalText?: string // 原始聊天记录
}

export interface UserProfile {
  id: string
  name: string
  avatar?: string
  email?: string
  settings: UserSettings
}

export interface UserSettings {
  darkMode: boolean
  notificationEnabled: boolean
  themeColor: string
}

import { useState, useEffect } from 'react'
import { getDB, generateId } from '../utils/db'
import type { Conversation, Todo, FinanceRecord, ReviewEntry, UserProfile } from '../types'

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([])

  useEffect(() => {
    loadConversations()
  }, [])

  async function loadConversations() {
    const db = await getDB()
    const items = await db.getAll('conversations')
    setConversations(items.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0)))
  }

  async function addConversation(conv: Omit<Conversation, 'id' | 'unreadCount'>) {
    const db = await getDB()
    const newConv: Conversation = {
      ...conv,
      id: generateId(),
      unreadCount: 0,
    }
    await db.add('conversations', newConv)
    await loadConversations()
    return newConv
  }

  async function updateConversation(id: string, updates: Partial<Conversation>) {
    const db = await getDB()
    const conv = await db.get('conversations', id)
    if (conv) {
      await db.put('conversations', { ...conv, ...updates })
      await loadConversations()
    }
  }

  async function deleteConversation(id: string) {
    const db = await getDB()
    await db.delete('conversations', id)
    // 删除该会话的所有消息
    const messages = await db.getAllFromIndex('messages', 'by-conversationId', id)
    for (const msg of messages) {
      await db.delete('messages', msg.id)
    }
    await loadConversations()
  }

  return { conversations, addConversation, updateConversation, deleteConversation }
}

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([])

  useEffect(() => {
    loadTodos()
  }, [])

  async function loadTodos() {
    const db = await getDB()
    const items = await db.getAll('todos')
    setTodos(items.sort((a, b) => (a.dueDate || 0) - (b.dueDate || 0)))
  }

  async function addTodo(todo: Omit<Todo, 'id' | 'createdAt' | 'completed'>) {
    const db = await getDB()
    const newTodo: Todo = {
      ...todo,
      id: generateId(),
      createdAt: Date.now(),
      completed: false,
    }
    await db.add('todos', newTodo)
    await loadTodos()
    return newTodo
  }

  async function toggleTodo(id: string) {
    const db = await getDB()
    const todo = await db.get('todos', id)
    if (todo) {
      await db.put('todos', { ...todo, completed: !todo.completed })
      await loadTodos()
    }
  }

  async function deleteTodo(id: string) {
    const db = await getDB()
    await db.delete('todos', id)
    await loadTodos()
  }

  return { todos, addTodo, toggleTodo, deleteTodo }
}

export function useFinanceRecords() {
  const [records, setRecords] = useState<FinanceRecord[]>([])

  useEffect(() => {
    loadRecords()
  }, [])

  async function loadRecords() {
    const db = await getDB()
    const items = await db.getAll('financeRecords')
    setRecords(items.sort((a, b) => b.date - a.date))
  }

  async function addRecord(record: Omit<FinanceRecord, 'id'>) {
    const db = await getDB()
    const newRecord: FinanceRecord = {
      ...record,
      id: generateId(),
    }
    await db.add('financeRecords', newRecord)
    await loadRecords()
    return newRecord
  }

  async function deleteRecord(id: string) {
    const db = await getDB()
    await db.delete('financeRecords', id)
    await loadRecords()
  }

  const totalIncome = records.filter(r => r.type === 'income').reduce((sum, r) => sum + r.amount, 0)
  const totalExpense = records.filter(r => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0)

  return { records, addRecord, deleteRecord, totalIncome, totalExpense }
}

export function useReviews() {
  const [reviews, setReviews] = useState<ReviewEntry[]>([])

  useEffect(() => {
    loadReviews()
  }, [])

  async function loadReviews() {
    const db = await getDB()
    const items = await db.getAll('reviews')
    setReviews(items.sort((a, b) => b.date - a.date))
  }

  async function addReview(review: Omit<ReviewEntry, 'id'>) {
    const db = await getDB()
    const newReview: ReviewEntry = {
      ...review,
      id: generateId(),
    }
    await db.add('reviews', newReview)
    await loadReviews()
    return newReview
  }

  return { reviews, addReview }
}

export function useProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null)

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    const db = await getDB()
    const profiles = await db.getAll('profile')
    if (profiles.length > 0) {
      setProfile(profiles[0])
    } else {
      const defaultProfile: UserProfile = {
        id: 'default',
        name: 'Rosea',
        settings: {
          darkMode: false,
          notificationEnabled: true,
          themeColor: '#c9a997',
        },
      }
      await db.add('profile', defaultProfile)
      setProfile(defaultProfile)
    }
  }

  async function updateProfile(updates: Partial<UserProfile>) {
    if (!profile) return
    const db = await getDB()
    const updated = { ...profile, ...updates }
    await db.put('profile', updated)
    setProfile(updated)
  }

  return { profile, updateProfile }
}

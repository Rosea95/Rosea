import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { ChatMessage, Conversation, Todo, CalendarEvent, FinanceRecord, ReviewEntry, UserProfile, DiaryRecord, HealthRecord } from '../types'

interface RoseaDB extends DBSchema {
  conversations: {
    key: string
    value: Conversation
    indexes: { 'by-lastMessageTime': number }
  }
  messages: {
    key: string
    value: ChatMessage
    indexes: { 'by-conversationId': string; 'by-timestamp': number }
  }
  todos: {
    key: string
    value: Todo
    indexes: { 'by-dueDate': number; 'by-completed': boolean }
  }
  events: {
    key: string
    value: CalendarEvent
    indexes: { 'by-startDate': number }
  }
  financeRecords: {
    key: string
    value: FinanceRecord
    indexes: { 'by-date': number; 'by-type': string }
  }
  reviews: {
    key: string
    value: ReviewEntry
    indexes: { 'by-date': number }
  }
  diary: {
    key: string
    value: DiaryRecord
    indexes: { 'by-createdAt': number }
  }
  health: {
    key: string
    value: HealthRecord
    indexes: { 'by-createdAt': number }
  }
  profile: {
    key: string
    value: UserProfile
  }
}

let dbInstance: IDBPDatabase<RoseaDB> | null = null

export async function getDB(): Promise<IDBPDatabase<RoseaDB>> {
  if (dbInstance) return dbInstance

  dbInstance = await openDB<RoseaDB>('rosea-db', 2, {
    upgrade(db: IDBPDatabase<RoseaDB>) {
      if (!db.objectStoreNames.contains('conversations')) {
        const convStore = db.createObjectStore('conversations', { keyPath: 'id' })
        convStore.createIndex('by-lastMessageTime', 'lastMessageTime')
      }

      if (!db.objectStoreNames.contains('messages')) {
        const msgStore = db.createObjectStore('messages', { keyPath: 'id' })
        msgStore.createIndex('by-conversationId', 'conversationId')
        msgStore.createIndex('by-timestamp', 'timestamp')
      }

      if (!db.objectStoreNames.contains('todos')) {
        const todoStore = db.createObjectStore('todos', { keyPath: 'id' })
        todoStore.createIndex('by-dueDate', 'dueDate')
        todoStore.createIndex('by-completed', 'completed')
      }

      if (!db.objectStoreNames.contains('events')) {
        const eventStore = db.createObjectStore('events', { keyPath: 'id' })
        eventStore.createIndex('by-startDate', 'startDate')
      }

      if (!db.objectStoreNames.contains('financeRecords')) {
        const financeStore = db.createObjectStore('financeRecords', { keyPath: 'id' })
        financeStore.createIndex('by-date', 'date')
        financeStore.createIndex('by-type', 'type')
      }

      if (!db.objectStoreNames.contains('reviews')) {
        const reviewStore = db.createObjectStore('reviews', { keyPath: 'id' })
        reviewStore.createIndex('by-date', 'date')
      }

      if (!db.objectStoreNames.contains('diary')) {
        const diaryStore = db.createObjectStore('diary', { keyPath: 'id' })
        diaryStore.createIndex('by-createdAt', 'createdAt')
      }

      if (!db.objectStoreNames.contains('health')) {
        const healthStore = db.createObjectStore('health', { keyPath: 'id' })
        healthStore.createIndex('by-createdAt', 'createdAt')
      }

      if (!db.objectStoreNames.contains('profile')) {
        db.createObjectStore('profile', { keyPath: 'id' })
      }
    },
  })

  return dbInstance
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2)
}

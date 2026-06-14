import { getDB } from './db'

const BACKUP_KEY = 'rosea-backup'
const BACKUP_TIME_KEY = 'rosea-backup-time'

// 备份所有数据到 LocalStorage
export async function backupToLocalStorage(): Promise<void> {
  try {
    const db = await getDB()
    
    const backupData = {
      todos: await db.getAll('todos'),
      financeRecords: await db.getAll('financeRecords'),
      diary: await db.getAll('diary'),
      health: await db.getAll('health'),
      messages: await db.getAll('messages'),
      profile: await db.getAll('profile'),
      backupTime: Date.now(),
      version: '1.0'
    }
    
    localStorage.setItem(BACKUP_KEY, JSON.stringify(backupData))
    localStorage.setItem(BACKUP_TIME_KEY, new Date().toISOString())
    
    console.log('[备份] 数据已备份到 LocalStorage', backupData)
  } catch (error) {
    console.error('[备份] 备份失败:', error)
  }
}

// 从 LocalStorage 恢复数据
export async function restoreFromLocalStorage(): Promise<boolean> {
  try {
    const backupStr = localStorage.getItem(BACKUP_KEY)
    if (!backupStr) {
      console.error('[恢复] 没有找到备份数据')
      return false
    }
    
    const backupData = JSON.parse(backupStr)
    const db = await getDB()
    
    // 清空现有数据
    const stores: ('todos' | 'financeRecords' | 'diary' | 'health' | 'messages' | 'profile')[] = ['todos', 'financeRecords', 'diary', 'health', 'messages', 'profile']
    for (const store of stores) {
      const tx = db.transaction(store, 'readwrite')
      await tx.objectStore(store).clear()
      await tx.done
    }
    
    // 写入备份数据
    if (backupData.todos) {
      for (const item of backupData.todos) {
        await db.add('todos', item)
      }
    }
    if (backupData.financeRecords) {
      for (const item of backupData.financeRecords) {
        await db.add('financeRecords', item)
      }
    }
    if (backupData.diary) {
      for (const item of backupData.diary) {
        await db.add('diary', item)
      }
    }
    if (backupData.health) {
      for (const item of backupData.health) {
        await db.add('health', item)
      }
    }
    if (backupData.messages) {
      for (const item of backupData.messages) {
        await db.add('messages', item)
      }
    }
    if (backupData.profile) {
      for (const item of backupData.profile) {
        await db.add('profile', item)
      }
    }
    
    console.log('[恢复] 数据已从 LocalStorage 恢复')
    return true
  } catch (error) {
    console.error('[恢复] 恢复失败:', error)
    return false
  }
}

// 获取备份时间
export function getBackupTime(): string | null {
  return localStorage.getItem(BACKUP_TIME_KEY)
}

// 导出数据为 JSON 文件
export async function exportDataToFile(): Promise<void> {
  try {
    const db = await getDB()
    
    const exportData = {
      todos: await db.getAll('todos'),
      financeRecords: await db.getAll('financeRecords'),
      diary: await db.getAll('diary'),
      health: await db.getAll('health'),
      messages: await db.getAll('messages'),
      profile: await db.getAll('profile'),
      exportTime: Date.now(),
      version: '1.0',
      appName: 'Rosea'
    }
    
    const jsonStr = JSON.stringify(exportData, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = `rosea-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    console.log('[导出] 数据已导出为文件')
  } catch (error) {
    console.error('[导出] 导出失败:', error)
  }
}

// 从 JSON 文件导入数据
export async function importDataFromFile(file: File): Promise<boolean> {
  try {
    const text = await file.text()
    const importData = JSON.parse(text)
    
    // 验证数据格式
    if (!importData.version || !importData.appName) {
      console.error('[导入] 无效的数据格式')
      return false
    }
    
    const db = await getDB()
    
    // 清空现有数据
    const stores: ('todos' | 'financeRecords' | 'diary' | 'health' | 'messages' | 'profile')[] = ['todos', 'financeRecords', 'diary', 'health', 'messages', 'profile']
    for (const store of stores) {
      const tx = db.transaction(store, 'readwrite')
      await tx.objectStore(store).clear()
      await tx.done
    }
    
    // 写入导入数据
    if (importData.todos) {
      for (const item of importData.todos) {
        await db.add('todos', item)
      }
    }
    if (importData.financeRecords) {
      for (const item of importData.financeRecords) {
        await db.add('financeRecords', item)
      }
    }
    if (importData.diary) {
      for (const item of importData.diary) {
        await db.add('diary', item)
      }
    }
    if (importData.health) {
      for (const item of importData.health) {
        await db.add('health', item)
      }
    }
    if (importData.messages) {
      for (const item of importData.messages) {
        await db.add('messages', item)
      }
    }
    if (importData.profile) {
      for (const item of importData.profile) {
        await db.add('profile', item)
      }
    }
    
    // 同时备份到 LocalStorage
    localStorage.setItem(BACKUP_KEY, JSON.stringify(importData))
    localStorage.setItem(BACKUP_TIME_KEY, new Date().toISOString())
    
    console.log('[导入] 数据已从文件导入')
    return true
  } catch (error) {
    console.error('[导入] 导入失败:', error)
    return false
  }
}

// 获取数据统计
export async function getDataStats(): Promise<{
  todos: number
  financeRecords: number
  diary: number
  health: number
  messages: number
}> {
  try {
    const db = await getDB()
    return {
      todos: await db.count('todos'),
      financeRecords: await db.count('financeRecords'),
      diary: await db.count('diary'),
      health: await db.count('health'),
      messages: await db.count('messages')
    }
  } catch (error) {
    console.error('[统计] 获取数据统计失败:', error)
    return { todos: 0, financeRecords: 0, diary: 0, health: 0, messages: 0 }
  }
}
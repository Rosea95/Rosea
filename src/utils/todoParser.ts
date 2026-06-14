import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import 'dayjs/locale/zh-cn'

dayjs.extend(relativeTime)
dayjs.extend(customParseFormat)
dayjs.locale('zh-cn')

export interface ParsedTodo {
  task: string
  dueDate?: Date
  hasTime: boolean
  error?: string
}

/**
 * 循环任务解析结果
 */
export interface ParsedRecurringTask {
  isRecurring: boolean
  task: string
  dates: Date[]
  startDate?: Date
  endDate?: Date
  totalCount: number
  error?: string
  batchId?: string
}

/**
 * 生成批次ID
 */
function generateBatchId(message: string): string {
  // 使用消息的哈希值作为批次ID
  let hash = 0
  for (let i = 0; i < message.length; i++) {
    const char = message.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return `batch_${Math.abs(hash).toString(36)}`
}

/**
 * 星期映射
 */
const WEEKDAY_MAP: Record<string, number> = {
  '周日': 0, '星期日': 0,
  '周一': 1, '星期一': 1,
  '周二': 2, '星期二': 2,
  '周三': 3, '星期三': 3,
  '周四': 4, '星期四': 4,
  '周五': 5, '星期五': 5,
  '周六': 6, '星期六': 6,
}

/**
 * 解析用户输入，提取待办事项和时间
 * 核心原则：从长到短匹配，匹配后立即移除，避免断句错误
 */
export function parseTodoFromMessage(message: string): ParsedTodo {
  const now = dayjs()
  let baseDate: dayjs.Dayjs = now
  let hasDate = false
  let hasTimePart = false
  let processedMessage = message // 用于逐步移除已匹配的时间词
  
  try {
    // ===== 第一步：匹配相对时间（分钟/小时后）=====
    const relativeTimePatterns = [
      { pattern: /两个\s*小时\s*后?/, handler: () => now.add(2, 'hour') },
      { pattern: /(\d+)\s*小时\s*后/, handler: (match: RegExpMatchArray) => now.add(parseInt(match[1]), 'hour') },
      { pattern: /半小时\s*后?/, handler: () => now.add(30, 'minute') },
      { pattern: /(\d+)\s*分钟\s*后/, handler: (match: RegExpMatchArray) => now.add(parseInt(match[1]), 'minute') },
    ]
    
    for (const { pattern, handler } of relativeTimePatterns) {
      const match = processedMessage.match(pattern)
      if (match) {
        baseDate = handler(match)
        hasTimePart = true
        // 立即移除已匹配的时间词
        processedMessage = processedMessage.replace(pattern, '')
        break
      }
    }
    
    // ===== 第二步：匹配日期关键词（从长到短）=====
    if (!hasTimePart) {
      // 第一批：长词（必须优先匹配）
      const longDatePatterns = [
        { pattern: /大后天/, handler: () => now.add(3, 'day').startOf('day') },
        { pattern: /大前天/, handler: () => now.subtract(3, 'day').startOf('day') },
        { pattern: /下下周/, handler: () => now.add(2, 'week').day(1).startOf('day') },
        { pattern: /下个月/, handler: () => now.add(1, 'month').startOf('day') },
      ]
      
      for (const { pattern, handler } of longDatePatterns) {
        const match = processedMessage.match(pattern)
        if (match) {
          baseDate = handler()
          hasDate = true
          // 立即移除已匹配的时间词
          processedMessage = processedMessage.replace(pattern, '')
          break
        }
      }
      
      // 第二批：基本位移词
      if (!hasDate) {
        const basicDatePatterns = [
          { pattern: /后天/, handler: () => now.add(2, 'day').startOf('day') },
          { pattern: /前天/, handler: () => now.subtract(2, 'day').startOf('day') },
          { pattern: /今天|本日/, handler: () => now.startOf('day') },
          { pattern: /明天|次日/, handler: () => now.add(1, 'day').startOf('day') },
          { pattern: /下周/, handler: () => now.add(1, 'week').day(1).startOf('day') },
          { pattern: /下月/, handler: () => now.add(1, 'month').startOf('day') },
        ]
        
        for (const { pattern, handler } of basicDatePatterns) {
          const match = processedMessage.match(pattern)
          if (match) {
            baseDate = handler()
            hasDate = true
            // 立即移除已匹配的时间词
            processedMessage = processedMessage.replace(pattern, '')
            break
          }
        }
      }
      
      // 第三批：星期（周一、周二...周日）
      if (!hasDate) {
        for (const [keyword, weekday] of Object.entries(WEEKDAY_MAP)) {
          const pattern = new RegExp(keyword)
          const match = processedMessage.match(pattern)
          if (match) {
            const currentWeekday = now.day()
            let daysToAdd = weekday - currentWeekday
            if (daysToAdd <= 0) {
              daysToAdd += 7
            }
            // 如果用户说"下周X"，就加一周
            if (message.includes('下周')) {
              daysToAdd += 7
            }
            baseDate = now.add(daysToAdd, 'day').startOf('day')
            hasDate = true
            // 立即移除已匹配的时间词
            processedMessage = processedMessage.replace(pattern, '')
            break
          }
        }
      }
      
      // 第四批：具体日期（下个月X号）
      if (!hasDate) {
        const specificDatePatterns = [
          { pattern: /下个月\s*(\d+)\s*号/, handler: (match: RegExpMatchArray) => {
            const day = parseInt(match[1])
            return now.add(1, 'month').date(day).hour(9).minute(0).second(0)
          }},
          { pattern: /(?:今天|当日)\s*(\d+)\s*号/, handler: (match: RegExpMatchArray) => {
            const day = parseInt(match[1])
            return now.date(day).hour(9).minute(0).second(0)
          }},
        ]
        
        for (const { pattern, handler } of specificDatePatterns) {
          const match = processedMessage.match(pattern)
          if (match) {
            baseDate = handler(match)
            hasDate = true
            // 立即移除已匹配的时间词
            processedMessage = processedMessage.replace(pattern, '')
            break
          }
        }
      }
    }
    
    // ===== 第三步：匹配具体时间点（从长到短）=====
    const timePatterns = [
      // 上午/下午/晚上 X 点 X 分
      { pattern: /上午\s*(\d+)\s*点\s*(\d+)\s*分/, handler: (match: RegExpMatchArray, base: dayjs.Dayjs) => base.hour(parseInt(match[1])).minute(parseInt(match[2])).second(0) },
      { pattern: /早上\s*(\d+)\s*点\s*(\d+)\s*分/, handler: (match: RegExpMatchArray, base: dayjs.Dayjs) => base.hour(parseInt(match[1])).minute(parseInt(match[2])).second(0) },
      { pattern: /下午\s*(\d+)\s*点\s*(\d+)\s*分/, handler: (match: RegExpMatchArray, base: dayjs.Dayjs) => {
        const hour = parseInt(match[1])
        return base.hour(hour >= 12 ? hour : hour + 12).minute(parseInt(match[2])).second(0)
      }},
      { pattern: /傍晚\s*(\d+)\s*点\s*(\d+)\s*分/, handler: (match: RegExpMatchArray, base: dayjs.Dayjs) => base.hour(parseInt(match[1])).minute(parseInt(match[2])).second(0) },
      { pattern: /晚上\s*(\d+)\s*点\s*(\d+)\s*分/, handler: (match: RegExpMatchArray, base: dayjs.Dayjs) => {
        const hour = parseInt(match[1])
        return base.hour(hour >= 12 ? hour : hour + 12).minute(parseInt(match[2])).second(0)
      }},
      
      // 上午/下午/晚上 X 点
      { pattern: /上午\s*(\d+)\s*点/, handler: (match: RegExpMatchArray, base: dayjs.Dayjs) => base.hour(parseInt(match[1])).minute(0).second(0) },
      { pattern: /早上\s*(\d+)\s*点/, handler: (match: RegExpMatchArray, base: dayjs.Dayjs) => base.hour(parseInt(match[1])).minute(0).second(0) },
      { pattern: /下午\s*(\d+)\s*点/, handler: (match: RegExpMatchArray, base: dayjs.Dayjs) => {
        const hour = parseInt(match[1])
        return base.hour(hour >= 12 ? hour : hour + 12).minute(0).second(0)
      }},
      { pattern: /傍晚\s*(\d+)\s*点/, handler: (match: RegExpMatchArray, base: dayjs.Dayjs) => base.hour(parseInt(match[1])).minute(0).second(0) },
      { pattern: /晚上\s*(\d+)\s*点/, handler: (match: RegExpMatchArray, base: dayjs.Dayjs) => {
        const hour = parseInt(match[1])
        return base.hour(hour >= 12 ? hour : hour + 12).minute(0).second(0)
      }},
      
      // X 点 X 分
      { pattern: /(\d+)\s*点\s*(\d+)\s*分/, handler: (match: RegExpMatchArray, base: dayjs.Dayjs) => {
        const hour = parseInt(match[1])
        const minute = parseInt(match[2])
        return base.hour(hour >= 12 ? hour : hour + 12).minute(minute).second(0)
      }},
      
      // HH:MM 格式
      { pattern: /(\d{1,2}):(\d{2})/, handler: (match: RegExpMatchArray, base: dayjs.Dayjs) => base.hour(parseInt(match[1])).minute(parseInt(match[2])).second(0) },
      
      // X 点
      { pattern: /(\d+)\s*点/, handler: (match: RegExpMatchArray, base: dayjs.Dayjs) => {
        const hour = parseInt(match[1])
        return base.hour(hour >= 12 ? hour : (hour < 6 ? hour + 12 : hour + 12)).minute(0).second(0)
      }},
    ]
    
    for (const { pattern, handler } of timePatterns) {
      const match = processedMessage.match(pattern)
      if (match) {
        baseDate = handler(match, baseDate)
        hasTimePart = true
        // 立即移除已匹配的时间词
        processedMessage = processedMessage.replace(pattern, '')
        break
      }
    }
    
    // ===== 第四步：匹配时间词（傍晚、晚上、下午等）=====
    if (!hasTimePart) {
      const timeWordPatterns = [
        { pattern: /傍晚/, handler: (base: dayjs.Dayjs) => base.hour(18).minute(0).second(0) },
        { pattern: /晚上/, handler: (base: dayjs.Dayjs) => base.hour(20).minute(0).second(0) },
        { pattern: /下午/, handler: (base: dayjs.Dayjs) => base.hour(15).minute(0).second(0) },
        { pattern: /中午/, handler: (base: dayjs.Dayjs) => base.hour(12).minute(0).second(0) },
        { pattern: /上午|早上/, handler: (base: dayjs.Dayjs) => base.hour(9).minute(0).second(0) },
      ]
      
      for (const { pattern, handler } of timeWordPatterns) {
        const match = processedMessage.match(pattern)
        if (match) {
          baseDate = handler(baseDate)
          hasTimePart = true
          // 立即移除已匹配的时间词
          processedMessage = processedMessage.replace(pattern, '')
          break
        }
      }
    }
    
    // ===== 第五步：如果时间比现在还早，且是相对时间，说明需要加一天 =====
    if (dayjs(baseDate).isBefore(now) && (hasTimePart || hasDate)) {
      baseDate = baseDate.add(1, 'day')
    }
    
    // ===== 第六步：提取任务内容 =====
    let task = processedMessage
    
    // 清理任务文本
    task = task
      .replace(/记得|要|去|请|帮我|提醒|帮我添加|添加|创建|设置|安排|还信用卡|看电影|去银行|跑步|开会|喝水|提交报告|吃沙拉/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    
    // 如果任务为空，使用原消息
    if (!task) {
      task = message.trim()
    }
    
    // 判断是否解析成功
    const hasValidTime = hasDate || hasTimePart
    
    // 如果没有任何时间信息，返回无截止时间的待办
    if (!hasValidTime) {
      return {
        task,
        hasTime: false,
      }
    }
    
    return {
      task,
      dueDate: baseDate.toDate(),
      hasTime: true,
    }
    
  } catch (error) {
    console.error('时间解析失败:', error)
    return {
      task: message.trim(),
      hasTime: false,
      error: '抱歉，我没有理解这个时间，能说具体些吗？比如"明天下午3点"。'
    }
  }
}

/**
 * 格式化时间显示（显示具体的年月日和星期）
 */
export function formatDueDate(dueDate?: Date): string {
  if (!dueDate) return '无截止时间'
  
  const date = dayjs(dueDate)
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  
  // 显示格式：YYYY-MM-DD（周X）HH:mm
  return `${date.format('YYYY-MM-DD')}（${weekdays[date.day()]}）${date.format('HH:mm')}`
}

/**
 * 重写的解析循环任务函数
 * 第一步：识别是否为循环指令（同时包含A类和B类）
 * A类（频率）：每天、每周、每月、每周几（周一/周二...）
 * B类（终止条件）：坚持X周、共X次、到X月X日、到月底
 */
export function parseRecurringTask(message: string): ParsedRecurringTask {
  const now = dayjs()
  
  try {
    // ===== 第一步：检测A类（频率）=====
    const hasDaily = /每天/.test(message)
    const hasWeekly = /每周/.test(message)
    const hasMonthly = /每月/.test(message)
    const hasYearly = /每年/.test(message)
    
    // 检测是否包含"每周几"（周一、周二...周日）
    const weekdayKeywords = ['周一', '星期二', '周三', '星期三', '周四', '星期四', '周五', '星期五', '周六', '星期六', '周日', '星期日', '周天']
    const hasWeekday = weekdayKeywords.some(keyword => message.includes(keyword))
    
    // 如果没有A类（频率），则不是循环任务
    if (!hasDaily && !hasWeekly && !hasMonthly && !hasYearly && !hasWeekday) {
      return { isRecurring: false, task: '', dates: [], totalCount: 0 }
    }
    
    // ===== 第一步：检测B类（终止条件）=====
    const hasWeeks = /坚持\s*(\d+)\s*周/.test(message)
    const hasTimes = /共\s*(\d+)\s*次/.test(message)
    const hasMonthEnd = /到\s*底|到\s*月底/.test(message)
    const hasSpecificEnd = /到\s*(\d+)\s*月\s*(\d+)\s*号/.test(message)
    const hasDayEnd = /到\s*后天/.test(message)
    
    // 如果没有B类（终止条件），则不是循环任务
    if (!hasWeeks && !hasTimes && !hasMonthEnd && !hasSpecificEnd && !hasDayEnd) {
      return { isRecurring: false, task: '', dates: [], totalCount: 0 }
    }
    
    // ===== 第二步：提取任务内容 =====
    let task = message
    // 移除所有时间相关词语，保留纯任务内容
    task = task
      .replace(/每天|每周|每月|每年/g, '')
      .replace(/周一|星期二|周三|星期三|周四|星期四|周五|星期五|周六|星期六|周日|星期日|周天/g, '')
      .replace(/坚持\s*\d+\s*周/g, '')
      .replace(/共\s*\d+\s*次/g, '')
      .replace(/到\s*底|到\s*月底/g, '')
      .replace(/到\s*后天/g, '')
      .replace(/到\s*\d+\s*月\s*\d+\s*号/g, '')
      .replace(/早上|上午|下午|晚上|中午|傍晚/g, '')
      .replace(/\d+\s*点\s*\d+\s*分/g, '')
      .replace(/\d+\s*点/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    
    // 如果任务为空，使用原消息
    if (!task) {
      task = message.replace(/\s+/g, ' ').trim()
    }
    
    // ===== 第三步：解析时间点 =====
    let timeHour = 7  // 默认早上7点
    let timeMinute = 0
    
    // 解析具体时间
    const timePattern = message.match(/(\d+)\s*点\s*(\d+)?\s*分?/)
    if (timePattern) {
      timeHour = parseInt(timePattern[1])
      timeMinute = timePattern[2] ? parseInt(timePattern[2]) : 0
    }
    
    // 调整时间（早上不加12，下午/晚上要加）
    if (timeHour < 12 && /下午|晚上|傍晚/.test(message)) {
      timeHour += 12
    }
    
    // ===== 第四步：解析终止条件并计算日期列表 =====
    let dates: Date[] = []
    let startDate = now.hour(timeHour).minute(timeMinute).second(0)
    let endDate: dayjs.Dayjs | null = null
    
    // 处理"坚持X周"
    if (hasWeeks) {
      const weeksMatch = message.match(/坚持\s*(\d+)\s*周/)
      const weeks = weeksMatch ? parseInt(weeksMatch[1]) : 1
      
      if (hasWeekday || hasWeekly) {
        // 提取星期几
        const weekdays: number[] = []
        
        // 第一步：检查"一三五"这样的连写（单个汉字数字）
        const singleNumberMap: Record<string, number> = {
          '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0
        }
        
        // 匹配"周"后面跟的单个汉字数字
        const weekMatch = message.match(/周([一二三四五六日天])/)
        if (weekMatch) {
          const num = singleNumberMap[weekMatch[1]]
          if (num !== undefined && !weekdays.includes(num)) {
            weekdays.push(num)
          }
        }
        
        // 第二步：检查"一三五"连写（不带"周"）
        const dayString = message.replace(/.*?(?:每周|周)/, '').match(/([一二三四五六日天])/g)
        if (dayString) {
          for (const char of dayString) {
            const num = singleNumberMap[char]
            if (num !== undefined && !weekdays.includes(num)) {
              weekdays.push(num)
            }
          }
        }
        
        // 第三步：检查完整的中文星期
        if (/周一|星期一/.test(message)) weekdays.push(1)
        if (/周二|星期二/.test(message)) weekdays.push(2)
        if (/周三|星期三/.test(message)) weekdays.push(3)
        if (/周四|星期四/.test(message)) weekdays.push(4)
        if (/周五|星期五/.test(message)) weekdays.push(5)
        if (/周六|星期六/.test(message)) weekdays.push(6)
        if (/周日|星期日|周天/.test(message)) weekdays.push(0)
        
        // 排序（按星期顺序：日、一、二、三、四、五、六）
        weekdays.sort((a, b) => {
          if (a === 0) return -1
          if (b === 0) return 1
          return a - b
        })
        
        // 如果没有指定具体星期，默认周一到周五
        if (weekdays.length === 0) {
          weekdays.push(1, 2, 3, 4, 5)
        }
        
        // 调试日志
        console.log('识别到的星期:', weekdays)
        
        // 计算从今天开始到未来X周内，所有指定星期几的日期
        const totalDays = weeks * 7
        
        // 从今天开始，遍历未来totalDays天
        for (let i = 0; i <= totalDays; i++) {
          const currentDate = now.add(i, 'day')
          if (weekdays.includes(currentDate.day())) {
            dates.push(currentDate.hour(timeHour).minute(timeMinute).second(0).toDate())
          }
        }
        
        // 如果dates为空，说明weekdays没有正确识别
        if (dates.length === 0) {
          // 回退：尝试默认周一到周五
          weekdays.push(1, 2, 3, 4, 5)
          for (let i = 0; i <= totalDays; i++) {
            const currentDate = now.add(i, 'day')
            if (weekdays.includes(currentDate.day())) {
              dates.push(currentDate.hour(timeHour).minute(timeMinute).second(0).toDate())
            }
          }
        }
        
        // 返回结果
        return {
          isRecurring: true,
          task,
          dates,
          startDate: dates[0],
          endDate: dates[dates.length - 1],
          totalCount: dates.length,
          batchId: generateBatchId(message),
        }
      } else {
        // 没有指定星期几，默认每天
        const dates: Date[] = []
        for (let i = 0; i < weeks * 7; i++) {
          dates.push(now.add(i, 'day').hour(timeHour).minute(timeMinute).second(0).toDate())
        }
        
        return {
          isRecurring: true,
          task,
          dates,
          startDate: dates[0],
          endDate: dates[dates.length - 1],
          totalCount: dates.length,
          batchId: generateBatchId(message),
        }
      }
    }
    
    // 处理"到后天"
    else if (hasDayEnd) {
      const tomorrow = now.add(1, 'day').startOf('day')
      const dayAfterTomorrow = now.add(2, 'day').startOf('day')
      
      // 从今天到后天
      dates = [
        startDate.toDate(),
        tomorrow.hour(timeHour).minute(timeMinute).toDate(),
        dayAfterTomorrow.hour(timeHour).minute(timeMinute).toDate(),
      ]
      endDate = dayAfterTomorrow.hour(timeHour).minute(timeMinute)
    }
    
    // 处理"到月底"
    else if (hasMonthEnd) {
      const monthEnd = now.endOf('month').startOf('day')
      let currentDate = startDate
      
      while (currentDate.isBefore(monthEnd) || currentDate.isSame(monthEnd, 'day')) {
        dates.push(currentDate.toDate())
        currentDate = currentDate.add(1, 'day')
      }
      endDate = dates[dates.length - 1] ? dayjs(dates[dates.length - 1]) : startDate
    }
    
    // 处理"到某月某号"
    else if (hasSpecificEnd) {
      const specificMatch = message.match(/到\s*(\d+)\s*月\s*(\d+)\s*号/)
      if (specificMatch) {
        const targetMonth = parseInt(specificMatch[1])
        const targetDay = parseInt(specificMatch[2])
        
        // 找到目标日期
        let targetDate = now.month(targetMonth - 1).date(targetDay).hour(timeHour).minute(timeMinute)
        
        // 如果目标日期已过，可能是明年
        if (targetDate.isBefore(now)) {
          targetDate = targetDate.add(1, 'year')
        }
        
        let currentDate = startDate
        while (currentDate.isBefore(targetDate) || currentDate.isSame(targetDate)) {
          dates.push(currentDate.toDate())
          currentDate = currentDate.add(1, 'day')
        }
        endDate = targetDate
      }
    }
    
    // 处理"共X次"
    else if (hasTimes) {
      const timesMatch = message.match(/共\s*(\d+)\s*次/)
      const totalTimes = timesMatch ? parseInt(timesMatch[1]) : 1
      
      if (hasMonthly) {
        // 每月某号共X次
        const dayMatch = message.match(/(\d+)\s*号/)
        const targetDay = dayMatch ? parseInt(dayMatch[1]) : 15
        
        for (let i = 0; i < totalTimes; i++) {
          const date = now.add(i, 'month').date(targetDay).hour(timeHour).minute(timeMinute)
          dates.push(date.toDate())
        }
        endDate = dates[dates.length - 1] ? dayjs(dates[dates.length - 1]) : startDate
      } else {
        // 默认每天共X次
        for (let i = 0; i < totalTimes; i++) {
          dates.push(startDate.add(i, 'day').toDate())
        }
        endDate = dates[dates.length - 1] ? dayjs(dates[dates.length - 1]) : startDate
      }
    }
    
    // 如果没有解析到日期，返回错误
    if (dates.length === 0) {
      return {
        isRecurring: true,
        task,
        dates: [],
        totalCount: 0,
        error: '抱歉，我没有理解这个循环规则。请说具体些，比如"每周一三五早上7点跑步，坚持2周"。'
      }
    }
    
    // 排序日期
    dates.sort((a, b) => a.getTime() - b.getTime())
    
    // 生成批次ID
    const batchId = generateBatchId(message)
    
    return {
      isRecurring: true,
      task,
      dates,
      startDate: dates[0],
      endDate: dates[dates.length - 1],
      totalCount: dates.length,
      batchId,
    }
    
  } catch (error) {
    console.error('循环任务解析失败:', error)
    return {
      isRecurring: false,
      task: message,
      dates: [],
      totalCount: 0,
      error: '抱歉，我没有理解这个循环规则。'
    }
  }
}
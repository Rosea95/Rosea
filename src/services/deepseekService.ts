import { DEEPSEEK_CONFIG, SYSTEM_PROMPT, STORAGE_KEYS } from '../config/deepseek'

export interface AIAction {
  a: 'addTodo' | 'addCycle' | 'addFin' | 'addDiary' | 'addHealth' | 'unknow'
  d: {
    t: string | null
    tm: string | null  // YYYY-MM-DD HH:mm 格式
    r: string | null  // 如 'weekly-1,3,5' 或 'daily'
    rc: number | null  // 循环次数
    c: string | null  // 财务分类
    m: number | null  // 金额
    n: string | null  // 备注
  }
}

// 新的 AI 解析结果格式
export interface ParseResult {
  action: 'addTodo' | 'addCycleTodo' | 'addFin' | 'addDiary' | 'addHealth' | 'addBeauty' | 'unknown'
  data: {
    title: string | null
    time: string | null
    repeat: string | null
    repeatCount: number | null
    category: string | null
    amount: number | null
    note: string | null
    beautyName: string | null
    openDate: string | null
    expiryMonths: number | null
  }
}

// 运动意图判断结果
export interface SportIntent {
  intent: 'plan' | 'log'
  title: string
}

// 从LocalStorage获取API Key
export function getApiKey(): string {
  return localStorage.getItem(STORAGE_KEYS.DEEPSEEK_API_KEY) || DEEPSEEK_CONFIG.API_KEY
}

// 新的 parseWithAI 函数 - 智能解析用户输入
export async function parseWithAI(message: string): Promise<ParseResult> {
  const apiKey = getApiKey()
  
  if (!apiKey) {
    console.log('[parseWithAI] API Key未设置，降级处理')
    throw new Error('API_KEY_NOT_SET')
  }

  const systemPrompt = `你是一个智能生活管理助手。请分析用户输入，并返回一个严格的 JSON 对象。

你需要识别用户意图，并提取关键信息。返回的 JSON 结构如下：
{
  "action": "动作类型",
  "data": {
    "title": "事项标题",
    "time": "时间，格式化为 YYYY-MM-DD HH:mm，未提及则为 null",
    "repeat": "循环规则，如 weekly-1,3,5 或 daily，无则为 null",
    "repeatCount": "循环次数，数字，无则为 null",
    "category": "记账分类，如 餐饮/交通/购物/护肤，无则为 null",
    "amount": "金额，数字，无则为 null",
    "note": "备注，无则为 null",
    "beautyName": "护肤品/化妆品名称，无则为 null",
    "openDate": "开封日期 YYYY-MM-DD，无则为 null",
    "expiryMonths": "保质期月数，数字，无则为 null"
  }
}

action 可选值：
- addTodo：单次待办
- addCycleTodo：循环待办
- addFin：记账（必须包含金额）
- addDiary：日记/心情
- addHealth：运动/健康记录
- addBeauty：护肤品/化妆品开封记录（必须包含名称和保质期相关）
- unknown：无法识别

强制规则：
- 如果用户提到“买了/新开/开封/保质期”等词且涉及护肤品/化妆品，action 必须是 addBeauty，绝对不能识别为 addFinance。
- 只返回 JSON，不要任何其他文字。`

  try {
    const response = await fetch(`${DEEPSEEK_CONFIG.BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_CONFIG.MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        temperature: 0.01,  // 极低温度确保稳定输出
      }),
    })

    if (!response.ok) {
      console.log(`[parseWithAI] API调用失败: ${response.status}`)
      throw new Error(`API Error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    
    if (!content) {
      console.log('[parseWithAI] 返回内容为空')
      throw new Error('Empty response from AI')
    }

    console.log('[parseWithAI] 原始返回内容:', content)

    // 清理并解析 JSON
    let jsonStr = content.trim()
    
    // 去除可能的 markdown 代码块
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7)
    }
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3)
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3)
    }
    
    // 从字符串中提取 JSON 对象
    const firstBrace = jsonStr.indexOf('{')
    const lastBrace = jsonStr.lastIndexOf('}')
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = jsonStr.substring(firstBrace, lastBrace + 1)
    }
    
    console.log('[parseWithAI] 提取的JSON字符串:', jsonStr)
    
    const parsed = JSON.parse(jsonStr) as ParseResult
    
    console.log('[parseWithAI] 解析成功:', parsed)
    
    return parsed
    
  } catch (error) {
    console.error('[parseWithAI] 调用失败:', error)
    throw error
  }
}

// 调用DeepSeek API进行运动意图判断
export async function callDeepSeekSportIntent(userMessage: string): Promise<SportIntent | null> {
  const apiKey = getApiKey()
  
  if (!apiKey) {
    console.log('[运动意图API] API Key未设置，降级处理')
    return null
  }

  const prompt = `判断用户输入的运动是"计划"还是"记录"。
输入：${userMessage}
如果是计划，回复 JSON: {"intent":"plan","title":"运动名"}
如果是记录，回复 JSON: {"intent":"log","title":"运动名"}
只回复 JSON，不要其他内容。`

  try {
    const response = await fetch(`${DEEPSEEK_CONFIG.BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_CONFIG.MODEL,
        messages: [
          { role: 'user', content: prompt },
        ],
        temperature: 0.01,
      }),
    })

    if (!response.ok) {
      console.log(`[运动意图API] API调用失败: ${response.status}`)
      return null
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    
    if (!content) {
      console.log('[运动意图API] 返回内容为空')
      return null
    }

    try {
      const result = JSON.parse(content)
      if (result.intent && result.title) {
        console.log('[运动意图API] 解析成功:', result)
        return result as SportIntent
      }
    } catch {
      console.log('[运动意图API] JSON解析失败:', content)
    }
    
    return null
  } catch (error) {
    console.log('[运动意图API] 网络错误:', error)
    return null
  }
}

// 调用DeepSeek API
export async function callDeepSeekAI(userMessage: string): Promise<AIAction> {
  const apiKey = getApiKey()
  
  if (!apiKey) {
    throw new Error('API_KEY_NOT_SET')
  }

  const response = await fetch(`${DEEPSEEK_CONFIG.BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_CONFIG.MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.1,  // 低温度，确保输出稳定
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error?.message || `API Error: ${response.status}`)
  }

  const data = await response.json()
  const aiContent = data.choices?.[0]?.message?.content?.trim()

  if (!aiContent) {
    throw new Error('Empty response from AI')
  }

  console.log('[DeepSeek] 原始返回内容:', aiContent)

  // 尝试解析JSON
  try {
    // 尝试提取JSON字符串（找到第一个 { 和最后一个 }）
    let jsonStr = aiContent.trim()
    
    // 去除可能的markdown代码块
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7)
    }
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3)
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3)
    }
    
    // 从字符串中提取JSON对象
    const firstBrace = jsonStr.indexOf('{')
    const lastBrace = jsonStr.lastIndexOf('}')
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = jsonStr.substring(firstBrace, lastBrace + 1)
    }
    
    console.log('[DeepSeek] 提取的JSON字符串:', jsonStr)
    
    const parsed = JSON.parse(jsonStr) as AIAction
    
    console.log('[DeepSeek] 解析后的JSON对象:', parsed)
    
    // 验证必要字段
    if (!parsed.a) {
      throw new Error('Invalid AI response: missing action')
    }
    
    return parsed
  } catch (parseError) {
    console.error('[DeepSeek] JSON解析失败:', parseError, 'Raw content:', aiContent)
    throw new Error('JSON_PARSE_FAILED')
  }
}

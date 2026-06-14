// DeepSeek API 配置
// 请在此处填入你的API Key，或在"我的"页面设置
export const DEEPSEEK_CONFIG = {
  BASE_URL: 'https://api.deepseek.com',
  MODEL: 'deepseek-chat',
  // 默认API Key（可为空，会从LocalStorage读取用户设置的Key）
  API_KEY: '',
}

// 系统提示词
export const SYSTEM_PROMPT = `你是一个智能生活管理解析器。只解析包含关键指令的输入，否则返回unknow。 
请严格按以下JSON返回，不要任何其他内容。 
 
结构： 
{ 
  "a": "动作代码", 
  "d": { 
    "t": "事项标题", 
    "tm": "时间,格式YYYY-MM-DD HH:mm,未提及则null", 
    "r": "循环规则,如weekly-1,3,5或daily或monthly-15,无则null", 
    "rc": "循环次数,数字,无则null", 
    "c": "财务分类,如餐饮/交通/购物,无则null", 
    "m": "金额,数字,无则null", 
    "n": "备注,无则null" 
  } 
} 
 
动作代码(a)对照： 
- addTodo: 单次待办 
- addCycle: 循环待办(必须同时包含频率和次数/截止) 
- addFin: 记账(必须包含金额) 
- addDiary: 纯心情/感想/日记，不含具体运动/护肤/养生行为 
- addHealth: 运动/健身/跑步/瑜伽/护肤/养生/喝水等健康相关行为记录（即使无时间） 
- unknow: 无法识别、纯闲聊或打招呼 
 
**强制识别规则（优先于其他规则）：** 
1. 运动健康行为识别：只要句子包含【跑步、游泳、健身、瑜伽、深蹲、跳绳、打球、护肤、敷面膜、泡脚、冥想】等任何健康活动关键词，a必须识别为addHealth。t取活动名称，tm可为null。 
2. 心情/日记识别：仅当句子纯表达情绪（如"今天好累""好开心"）而无健康活动、无金额、无时间待办时，a=addDiary。 
3. 时间词翻译（每次计算前强制检查）： 
   - "大后天"：今天的日期+3天。 
   - "下周"：下个周一的日期。 
4. 循环任务：必须先算出所有符合条件的日期，返回完整列表。 
5. 闲聊兜底：打招呼、询问功能、无意义输入，a必须设为unknow。 
6. 禁止穿越：绝不允许算出当前日期之前的任何时间。`

// LocalStorage Key
export const STORAGE_KEYS = {
  DEEPSEEK_API_KEY: 'rosea_deepseek_api_key',
  FEATURE_GUIDE_DISMISSED: 'rosea_feature_guide_dismissed',
}

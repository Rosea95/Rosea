import dayjs from 'dayjs'

// 获取问候语（根据时间段自动切换）
export function getGreeting(): string {
  const hour = dayjs().hour()
  
  if (hour >= 5 && hour < 12) {
    return '早安~'
  } else if (hour >= 12 && hour < 18) {
    return '午安~'
  } else if (hour >= 18 && hour < 22) {
    return '晚安~'
  } else {
    return '夜深了~'
  }
}

// 获取日期显示（如"6月14日 周六"）
export function getDateDisplay(): string {
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const month = dayjs().month() + 1
  const day = dayjs().date()
  const weekday = weekdays[dayjs().day()]
  
  return `${month}月${day}日 ${weekday}`
}

// 获取完整问候标题
export function getGreetingTitle(): string {
  return `${getDateDisplay()}，${getGreeting()}`
}

// 触发震动反馈（仅记录成功时使用）
export function triggerVibrate(duration: number = 15): void {
  if (navigator.vibrate) {
    navigator.vibrate(duration)
  }
}
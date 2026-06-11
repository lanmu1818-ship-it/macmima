/**
 * 剪贴板管理工具
 * 支持复制和自动清除
 */

let clearTimeoutId: NodeJS.Timeout | null = null

/**
 * 复制文本到剪贴板
 * @param text 要复制的文本
 * @param autoClear 是否自动清除（秒）
 */
export async function copyToClipboard(
  text: string,
  autoClear: number = 30
): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)

    // 清除之前的定时器
    if (clearTimeoutId) {
      clearTimeout(clearTimeoutId)
    }

    // 设置自动清除
    if (autoClear > 0) {
      clearTimeoutId = setTimeout(async () => {
        try {
          const currentText = await navigator.clipboard.readText()
          if (currentText === text) {
            await navigator.clipboard.writeText('')
          }
        } catch (error) {
          console.error('清除剪贴板失败:', error)
        }
      }, autoClear * 1000)
    }

    return true
  } catch (error) {
    console.error('复制失败:', error)
    return false
  }
}

/**
 * 立即清除剪贴板
 */
export async function clearClipboard(): Promise<void> {
  try {
    await navigator.clipboard.writeText('')
    if (clearTimeoutId) {
      clearTimeout(clearTimeoutId)
      clearTimeoutId = null
    }
  } catch (error) {
    console.error('清除剪贴板失败:', error)
  }
}

/**
 * 读取剪贴板内容
 */
export async function readClipboard(): Promise<string> {
  try {
    return await navigator.clipboard.readText()
  } catch (error) {
    console.error('读取剪贴板失败:', error)
    return ''
  }
}

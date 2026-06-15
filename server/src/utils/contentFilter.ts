const builtInSensitiveWords = [
  '政治',
  '暴乱',
  '颠覆',
  '分裂国家',
  '色情',
  '黄色网站',
  '卖淫',
  '嫖娼',
  '约炮',
  '毒品',
  '吸毒',
  '贩毒',
  '冰毒',
  '海洛因',
  '大麻',
  '摇头丸',
  '赌博',
  '博彩',
  '下注',
  '赌球',
  '网赌',
  '六合彩',
  '老虎机',
  '傻逼',
  '妈的',
  '草泥马',
  'fuck',
  'shit',
  'porn',
  'casino',
  'gambling',
  'drug',
]

function getExtraSensitiveWords() {
  return (process.env.CHAT_SENSITIVE_WORDS || '')
    .split(/[\n,，|]/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function maskText(value: string, term: string) {
  const pattern = new RegExp(escapeRegExp(term), 'gi')
  return value.replace(pattern, (match) => '*'.repeat(Math.max(2, match.length)))
}

export function sanitizeChatContent(input: string) {
  const normalized = input.replace(/\r\n/g, '\n').trim()
  const words = Array.from(new Set([...builtInSensitiveWords, ...getExtraSensitiveWords()]))
    .map((word) => word.trim())
    .filter((word) => word.length >= 2)

  const content = words.reduce((current, word) => maskText(current, word), normalized)

  return {
    content,
    masked: content !== normalized,
  }
}

import { useState, useEffect } from 'react'
import { X, Copy, RefreshCw, Check } from 'lucide-react'
import { generatePassword, checkPasswordStrength } from '@/utils/crypto'
import { copyToClipboard } from '@/utils/clipboard'

interface PasswordGeneratorProps {
  onClose: () => void
  onSelect?: (password: string) => void
}

export default function PasswordGenerator({ onClose, onSelect }: PasswordGeneratorProps) {
  const [password, setPassword] = useState('')
  const [copied, setCopied] = useState(false)
  const [options, setOptions] = useState({
    length: 16,
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: true,
    excludeAmbiguous: true,
  })

  const strength = checkPasswordStrength(password)

  useEffect(() => {
    handleGenerate()
  }, [options])

  const handleGenerate = () => {
    try {
      const newPassword = generatePassword(options)
      setPassword(newPassword)
      setCopied(false)
    } catch (error) {
      console.error('生成密码失败:', error)
    }
  }

  const handleCopy = async () => {
    const success = await copyToClipboard(password)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleSelect = () => {
    if (onSelect) {
      onSelect(password)
    }
    onClose()
  }

  const getStrengthColor = (score: number) => {
    if (score <= 2) return 'bg-gray-400'
    if (score <= 4) return 'bg-gray-600'
    if (score <= 6) return 'bg-gray-800'
    return 'bg-black'
  }

  const getStrengthLabel = (score: number) => {
    if (score <= 2) return '弱'
    if (score <= 4) return '中'
    if (score <= 6) return '强'
    return '非常强'
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">密码生成器</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 生成的密码 */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <input
              type="text"
              value={password}
              readOnly
              className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm"
            />
            <button
              onClick={handleGenerate}
              className="p-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              title="重新生成"
            >
              <RefreshCw size={18} />
            </button>
            <button
              onClick={handleCopy}
              className="p-3 bg-primary-600 text-white hover:bg-primary-700 rounded-lg transition-colors"
              title="复制"
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
            </button>
          </div>

          {/* 强度指示器 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">强度：</span>
              <span className="font-medium">{getStrengthLabel(strength.score)}</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${getStrengthColor(strength.score)}`}
                style={{ width: `${(strength.score / 7) * 100}%` }}
              />
            </div>
            {strength.feedback.length > 0 && (
              <div className="text-xs text-gray-500 space-y-1">
                {strength.feedback.map((fb, idx) => (
                  <div key={idx}>• {fb}</div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 选项 */}
        <div className="space-y-4 mb-6">
          {/* 长度 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">长度</label>
              <span className="text-sm text-gray-600">{options.length}</span>
            </div>
            <input
              type="range"
              min="8"
              max="64"
              value={options.length}
              onChange={(e) => setOptions({ ...options, length: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* 复选框选项 */}
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={options.includeUppercase}
                onChange={(e) =>
                  setOptions({ ...options, includeUppercase: e.target.checked })
                }
                className="w-4 h-4 text-primary-600 rounded"
              />
              <span className="text-sm text-gray-700">大写字母 (A-Z)</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={options.includeLowercase}
                onChange={(e) =>
                  setOptions({ ...options, includeLowercase: e.target.checked })
                }
                className="w-4 h-4 text-primary-600 rounded"
              />
              <span className="text-sm text-gray-700">小写字母 (a-z)</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={options.includeNumbers}
                onChange={(e) =>
                  setOptions({ ...options, includeNumbers: e.target.checked })
                }
                className="w-4 h-4 text-primary-600 rounded"
              />
              <span className="text-sm text-gray-700">数字 (0-9)</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={options.includeSymbols}
                onChange={(e) =>
                  setOptions({ ...options, includeSymbols: e.target.checked })
                }
                className="w-4 h-4 text-primary-600 rounded"
              />
              <span className="text-sm text-gray-700">符号 (!@#$%...)</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={options.excludeAmbiguous}
                onChange={(e) =>
                  setOptions({ ...options, excludeAmbiguous: e.target.checked })
                }
                className="w-4 h-4 text-primary-600 rounded"
              />
              <span className="text-sm text-gray-700">排除易混淆字符 (0/O, 1/l/I)</span>
            </label>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          {onSelect && (
            <button
              onClick={handleSelect}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              使用此密码
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

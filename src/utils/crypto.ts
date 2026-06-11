/**
 * 加密核心模块
 * 实现 AES-256-GCM 加密、PBKDF2 密钥派生
 */

export interface EncryptedData {
  encrypted: string
  iv: string
  authTag: string
}

/**
 * 从主密码派生加密密钥
 * 使用 PBKDF2 算法，100000 次迭代
 */
export async function deriveKey(
  masterPassword: string,
  salt: string
): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const passwordBuffer = encoder.encode(masterPassword)
  const saltBuffer = encoder.encode(salt)

  // 导入密码作为密钥材料
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  )

  // 派生 AES-GCM 密钥
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )

  return key
}

export async function deriveWorkspaceSharedKey(workspaceKey: string): Promise<CryptoKey> {
  return deriveKey(workspaceKey, 'macmima-workspace-shared-v1')
}

/**
 * 加密数据
 * 使用 AES-256-GCM 算法
 */
export async function encryptData(
  data: string,
  key: CryptoKey
): Promise<EncryptedData> {
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)

  // 生成随机 IV (初始化向量)
  const iv = crypto.getRandomValues(new Uint8Array(12))

  // 加密数据
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    dataBuffer
  )

  // AES-GCM 会在密文末尾附加 16 字节的认证标签
  const encryptedArray = new Uint8Array(encryptedBuffer)
  const ciphertext = encryptedArray.slice(0, -16)
  const authTag = encryptedArray.slice(-16)

  return {
    encrypted: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv),
    authTag: arrayBufferToBase64(authTag),
  }
}

/**
 * 解密数据
 */
export async function decryptData(
  encryptedData: EncryptedData,
  key: CryptoKey
): Promise<string> {
  const ciphertext = base64ToArrayBuffer(encryptedData.encrypted)
  const iv = base64ToArrayBuffer(encryptedData.iv)
  const authTag = base64ToArrayBuffer(encryptedData.authTag)

  // 合并密文和认证标签
  const combined = new Uint8Array(ciphertext.byteLength + authTag.byteLength)
  combined.set(new Uint8Array(ciphertext), 0)
  combined.set(new Uint8Array(authTag), ciphertext.byteLength)

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(iv),
      },
      key,
      combined
    )

    const decoder = new TextDecoder()
    return decoder.decode(decryptedBuffer)
  } catch (error) {
    throw new Error('解密失败：密钥错误或数据已损坏')
  }
}

/**
 * 生成随机盐值
 */
export function generateSalt(): string {
  const salt = crypto.getRandomValues(new Uint8Array(32))
  return arrayBufferToBase64(salt)
}

/**
 * 哈希密码用于服务器验证
 * 注意：这不是用于加密的密钥，仅用于登录验证
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + salt)

  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return arrayBufferToBase64(new Uint8Array(hashBuffer))
}

/**
 * 生成强密码
 */
export function generatePassword(options: {
  length?: number
  includeUppercase?: boolean
  includeLowercase?: boolean
  includeNumbers?: boolean
  includeSymbols?: boolean
  excludeAmbiguous?: boolean
}): string {
  const {
    length = 16,
    includeUppercase = true,
    includeLowercase = true,
    includeNumbers = true,
    includeSymbols = true,
    excludeAmbiguous = true,
  } = options

  let charset = ''

  if (includeLowercase) {
    charset += excludeAmbiguous ? 'abcdefghjkmnpqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz'
  }
  if (includeUppercase) {
    charset += excludeAmbiguous ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  }
  if (includeNumbers) {
    charset += excludeAmbiguous ? '23456789' : '0123456789'
  }
  if (includeSymbols) {
    charset += '!@#$%^&*()_+-=[]{}|;:,.<>?'
  }

  if (charset.length === 0) {
    throw new Error('至少选择一种字符类型')
  }

  const password: string[] = []
  const randomValues = new Uint32Array(length)
  crypto.getRandomValues(randomValues)

  for (let i = 0; i < length; i++) {
    password.push(charset[randomValues[i] % charset.length])
  }

  return password.join('')
}

/**
 * 检查密码强度
 */
export function checkPasswordStrength(password: string): {
  score: number
  feedback: string[]
} {
  const feedback: string[] = []
  let score = 0

  if (password.length >= 8) score += 1
  if (password.length >= 12) score += 1
  if (password.length >= 16) score += 1

  if (/[a-z]/.test(password)) score += 1
  if (/[A-Z]/.test(password)) score += 1
  if (/[0-9]/.test(password)) score += 1
  if (/[^a-zA-Z0-9]/.test(password)) score += 1

  if (password.length < 8) {
    feedback.push('密码至少需要 8 个字符')
  }
  if (!/[a-z]/.test(password)) {
    feedback.push('建议包含小写字母')
  }
  if (!/[A-Z]/.test(password)) {
    feedback.push('建议包含大写字母')
  }
  if (!/[0-9]/.test(password)) {
    feedback.push('建议包含数字')
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    feedback.push('建议包含特殊字符')
  }

  // 检查常见弱密码
  const commonPasswords = ['password', '123456', 'qwerty', 'abc123', 'password123']
  if (commonPasswords.some((weak) => password.toLowerCase().includes(weak))) {
    feedback.push('密码包含常见弱密码模式')
    score = Math.min(score, 2)
  }

  return { score: Math.min(score, 7), feedback }
}

// 工具函数：ArrayBuffer 转 Base64
function arrayBufferToBase64(buffer: Uint8Array | ArrayBuffer): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

// 工具函数：Base64 转 ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

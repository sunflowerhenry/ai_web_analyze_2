import { SocksProxyAgent } from 'socks-proxy-agent'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { HttpProxyAgent } from 'http-proxy-agent'
import axios from 'axios'
import type { ProxyConfig, ProxySettings } from '@/store/analysis-store'

// 用户代理列表
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0'
]

// 创建代理Agent
export function createProxyAgent(proxyConfig: ProxyConfig) {
  const { type, host, port, username, password } = proxyConfig
  
  let proxyUrl = `${type}://`
  
  if (username && password) {
    proxyUrl += `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
  }
  
  proxyUrl += `${host}:${port}`

  switch (type) {
    case 'socks5':
      return new SocksProxyAgent(proxyUrl)
    case 'http':
      return new HttpProxyAgent(proxyUrl)
    case 'https':
      return new HttpsProxyAgent(proxyUrl)
    default:
      throw new Error(`不支持的代理类型: ${type}`)
  }
}

// 获取随机用户代理
export function getRandomUserAgent(): string {
  if (USER_AGENTS.length === 0) {
    return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
  const index = Math.floor(Math.random() * USER_AGENTS.length)
  return USER_AGENTS[index]!
}

// 获取随机延迟
export function getRandomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// 测试代理连接
export async function testProxy(proxyConfig: ProxyConfig, testUrl = 'https://httpbin.org/ip'): Promise<boolean> {
  try {
    const agent = createProxyAgent(proxyConfig)
    
    const response = await axios.get(testUrl, {
      httpAgent: agent,
      httpsAgent: agent,
      timeout: 10000,
      proxy: false
    })
    
    return response.status === 200
  } catch (error) {
    console.error(`代理测试失败 ${proxyConfig.host}:${proxyConfig.port}:`, error)
    return false
  }
}

// 代理管理器
export class ProxyManager {
  private proxies: ProxyConfig[]
  private currentIndex = 0
  private strategy: 'round-robin' | 'concurrent' | 'random'

  constructor(proxySettings: ProxySettings) {
    this.proxies = proxySettings.proxies.filter(p => p.status === 'working' || p.status === 'unknown')
    this.strategy = proxySettings.strategy
  }

  // 获取下一个代理
  getNextProxy(): ProxyConfig | null {
    if (this.proxies.length === 0) return null

    switch (this.strategy) {
      case 'round-robin': {
        const proxy = this.proxies[this.currentIndex] || null
        this.currentIndex = (this.currentIndex + 1) % this.proxies.length
        return proxy
      }

      case 'random':
        return this.proxies[Math.floor(Math.random() * this.proxies.length)] || null

      case 'concurrent':
        // 并发模式下返回所有可用代理
        return this.proxies[0] || null // 这里简化处理，实际使用时会在外部处理并发

      default:
        return this.proxies[0] || null
    }
  }

  // 获取多个代理（用于并发）
  getMultipleProxies(count: number): ProxyConfig[] {
    if (this.proxies.length === 0) return []
    
    const result = []
    const maxCount = Math.min(count, this.proxies.length)
    
    for (let i = 0; i < maxCount; i++) {
      const proxy = this.getNextProxy()
      if (proxy) result.push(proxy)
    }
    
    return result
  }

  // 标记代理状态
  markProxyStatus(proxyConfig: ProxyConfig, status: 'working' | 'failed') {
    const proxy = this.proxies.find(p => p.host === proxyConfig.host && p.port === proxyConfig.port)
    if (proxy) {
      proxy.status = status
      proxy.lastChecked = new Date()
    }
  }

  // 获取可用代理数量
  getAvailableProxyCount(): number {
    return this.proxies.length
  }
}

// 获取axios配置（包含代理和反检测设置）
export function getAxiosConfig(
  proxyConfig?: ProxyConfig,
  antiDetectionSettings?: any,
  bypassSystemProxy = true
) {
  const config: any = {
    timeout: 15000,
    headers: {
      'User-Agent': antiDetectionSettings?.randomUserAgent 
        ? getRandomUserAgent() 
        : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    }
  }

  // 强制禁用系统代理，避免冲突
  if (bypassSystemProxy) {
    config.proxy = false
  }

  if (proxyConfig) {
    const agent = createProxyAgent(proxyConfig)
    config.httpAgent = agent
    config.httpsAgent = agent
    // 确保不使用系统代理
    config.proxy = false
  }

  return config
}

// 批量测试代理
export async function testProxies(
  proxies: ProxyConfig[], 
  testUrl = 'https://httpbin.org/ip',
  maxConcurrent = 5
): Promise<ProxyConfig[]> {
  const results = []
  
  // 分批测试代理
  for (let i = 0; i < proxies.length; i += maxConcurrent) {
    const batch = proxies.slice(i, i + maxConcurrent)
    
    const batchPromises = batch.map(async (proxy) => {
      const isWorking = await testProxy(proxy, testUrl)
      return {
        ...proxy,
        status: isWorking ? 'working' as const : 'failed' as const,
        lastChecked: new Date()
      }
    })
    
    const batchResults = await Promise.all(batchPromises)
    results.push(...batchResults)
    
    // 添加延迟避免过于频繁的请求
    if (i + maxConcurrent < proxies.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  
  return results
} 
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ProxyConfig {
  host: string
  port: number
  username?: string
  password?: string
  type: 'socks5' | 'http' | 'https'
  status?: 'unknown' | 'working' | 'failed'
  lastChecked?: Date
}

export interface ProxySettings {
  enabled: boolean
  proxies: ProxyConfig[]
  strategy: 'round-robin' | 'concurrent' | 'random'
  maxConcurrentProxies: number
  testUrl: string
}

export interface ConcurrencySettings {
  enabled: boolean
  maxConcurrent: number
  delayBetweenRequests: number
  retryAttempts: number
}

export interface AntiDetectionSettings {
  enabled: boolean
  useHeadlessBrowser: boolean
  randomUserAgent: boolean
  randomDelay: boolean
  minDelay: number
  maxDelay: number
}

export interface AIConfig {
  modelName: string
  apiUrl: string
  apiKey: string
  promptTemplate: string
  companyNamePrompt: string
  emailCrawlPrompt: string
  proxySettings: ProxySettings
  concurrencySettings: ConcurrencySettings
  antiDetectionSettings: AntiDetectionSettings
}

export interface CompanyInfo {
  names: string[]  // 公司名称（按优先级排序）
  founderNames: string[]  // 创始人/老板名称
  brandNames: string[]  // 品牌名称
  fullName: string  // 公司全称
  primaryName: string  // 主要名称（AI选择的最佳名称）
}

export interface EmailInfo {
  email: string
  source: string  // 邮箱来源页面
  ownerName?: string  // 邮箱所有者名称
  type: 'contact' | 'support' | 'sales' | 'info' | 'other'  // 邮箱类型
}

export interface AnalysisResult {
  id: string
  url: string
  result: 'Y' | 'N' | 'PENDING' | 'ERROR'
  reason: string
  companyInfo?: CompanyInfo
  emails?: EmailInfo[]
  status: 'waiting' | 'crawling' | 'analyzing' | 'info-crawling' | 'completed' | 'failed' | 'crawl-failed' | 'analysis-failed' | 'info-crawl-failed'
  crawledContent?: {
    title?: string
    description?: string
    content?: string
    pages?: Array<{
      url: string
      title: string
      content: string
      type: 'home' | 'about' | 'contact' | 'privacy' | 'terms' | 'other'
    }>
  }
  error?: string
  errorDetails?: {
    type: 'crawl_error' | 'ai_error' | 'network_error' | 'timeout_error' | 'config_error' | 'unknown_error'
    stage: 'crawling' | 'ai_analysis' | 'info_extraction' | 'initialization'
    message: string
    statusCode?: number
    retryable: boolean
  }
  createdAt: Date
  updatedAt: Date
  hasInfoCrawled: boolean  // 是否已爬取详细信息
  infoCrawlProgress?: number  // 信息爬取进度
  backgroundTask?: {
    taskId: string
    startedAt: Date
    canRunInBackground: boolean
    priority: 'low' | 'normal' | 'high'
  }
}

interface AnalysisState {
  // 配置相关
  config: AIConfig
  updateConfig: (config: Partial<AIConfig>) => void
  
  // 分析数据
  analysisData: AnalysisResult[]
  addUrls: (urls: string[]) => void
  updateResult: (id: string, result: Partial<AnalysisResult>) => void
  deleteResults: (ids: string[]) => void
  clearResults: () => void
  
  // 分析状态
  isAnalyzing: boolean
  currentProgress: number
  totalItems: number
  setAnalyzing: (status: boolean) => void
  setProgress: (current: number, total: number) => void
  
  // 后台任务管理
  backgroundTasks: string[]
  addBackgroundTask: (taskId: string) => void
  removeBackgroundTask: (taskId: string) => void
  syncBackgroundTaskResults: (taskId: string) => Promise<void>
  
  // 云端同步功能
  isSyncingToCloud: boolean
  lastCloudSyncTime?: Date
  cloudSyncError?: string
  syncToCloud: () => Promise<void>
  loadFromCloud: () => Promise<void>
}

const defaultConfig: AIConfig = {
  modelName: 'gpt-3.5-turbo',
  apiUrl: 'https://api.openai.com/v1/chat/completions',
  apiKey: '',
  proxySettings: {
    enabled: false,
    proxies: [],
    strategy: 'round-robin',
    maxConcurrentProxies: 3,
    testUrl: 'https://httpbin.org/ip'
  },
  concurrencySettings: {
    enabled: false,
    maxConcurrent: 3,
    delayBetweenRequests: 2000,
    retryAttempts: 2
  },
  antiDetectionSettings: {
    enabled: true,
    useHeadlessBrowser: false,
    randomUserAgent: true,
    randomDelay: true,
    minDelay: 1000,
    maxDelay: 3000
  },
  promptTemplate: `请分析以下网站内容，判断这是否是一个目标客户网站。

网站信息：
标题：{title}
描述：{description}
主要内容：{content}
页脚内容：{footerContent}
爬取的页面：{pages}

请根据以下标准进行判断：
1. 是否是企业官网
2. 是否有明确的业务介绍
3. 是否有联系方式
4. 网站内容是否专业完整
5. 是否有明确的公司信息

请以JSON格式回复：
{
  "result": "Y" 或 "N",
  "reason": "详细的判断依据，包括网站类型、业务范围、专业程度等分析"
}`,
  companyNamePrompt: `请从以下网站内容中提取公司相关信息，按优先级排序：

网站内容：
{content}

提取优先级（从高到低）：
1. 邮箱所有者的名称（如果有明确的联系邮箱，优先提取邮箱所有者）
2. 公司创始人或老板的名称
3. 公司的全称名称
4. 公司的品牌名称

注意事项：
- 优先寻找页面中的"关于我们"、"公司简介"、"联系我们"等部分
- 注意识别CEO、创始人、总经理等职位信息
- 从版权信息、备案信息中提取公司名称
- 如果有多个可能的名称，请全部列出

请以JSON格式回复：
{
  "primaryName": "最主要的公司名称",
  "names": ["按优先级排序的所有公司名称"],
  "founderNames": ["创始人/老板名称"],
  "brandNames": ["品牌名称"],
  "fullName": "公司全称（如：XX有限公司）",
  "confidence": "提取信息的可信度(1-10)"
}`,
  emailCrawlPrompt: `请从以下网站内容中提取所有有效的邮箱地址，并识别邮箱所有者：

网站内容：
{content}

要求：
1. 提取所有有效邮箱地址
2. 过滤掉以下无效邮箱：
   - 图片格式邮箱（.png, .jpg, .jpeg, .gif, .webp, .svg等）
   - CDN相关邮箱（包含cdn字样）
   - 测试邮箱（test@, demo@, example@等）
   - 明显的垃圾邮箱
3. 识别邮箱类型（contact, support, sales, info, personal等）
4. 尽可能识别邮箱所有者姓名
5. 标注邮箱来源（页脚、联系页面、关于页面等）

特别注意：
- 重点关注页脚、联系页面、隐私政策、服务条款页面中的邮箱
- 如果发现个人邮箱（如CEO、创始人的邮箱），请特别标注

请以JSON格式回复：
{
  "emails": [
    {
      "email": "邮箱地址",
      "ownerName": "邮箱所有者姓名（如果能识别）",
      "type": "邮箱类型（contact/support/sales/info/personal/other）",
      "source": "邮箱来源描述（如：页脚联系信息、关于页面等）"
    }
  ]
}`
}

export const useAnalysisStore = create<AnalysisState>()(
  persist(
    (set, get) => ({
      // 配置相关
      config: defaultConfig,
      updateConfig: (newConfig) => {
        console.log('Store updateConfig called with:', newConfig)
        console.log('Current config before update:', get().config)
        
        set((state) => {
          const updatedConfig = { ...state.config, ...newConfig }
          console.log('Updated config (before set):', updatedConfig)
          
          return { config: updatedConfig }
        })
        
        // 验证更新后的状态
        setTimeout(() => {
          const currentState = get()
          console.log('Store state after update:', currentState.config)
        }, 50)
      },
      
      // 分析数据
      analysisData: [],
      addUrls: (urls) =>
        set((state) => {
          const existingUrls = new Set(state.analysisData.map(item => item.url))
          const newResults: AnalysisResult[] = urls
            .filter(url => url.trim() && !existingUrls.has(url.trim()))
            .map(url => ({
              id: crypto.randomUUID(),
              url: url.trim(),
              result: 'PENDING' as const,
              reason: '',
              status: 'waiting' as const,
              hasInfoCrawled: false,
              createdAt: new Date(),
              updatedAt: new Date()
            }))
          
          // 自动清理：如果数据太多，保留最新的10000条（提升限制）
          const allData = [...state.analysisData, ...newResults]
          const limitedData = allData.length > 10000 
            ? allData.slice(-10000) 
            : allData
          
          console.log(`[Store] 添加了 ${newResults.length} 个新URL，总数: ${limitedData.length}`)
          
          return {
            analysisData: limitedData
          }
        }),
      
      updateResult: (id, result) =>
        set((state) => {
          // 找到要更新的项目
          const itemIndex = state.analysisData.findIndex(item => item.id === id)
          if (itemIndex === -1) {
            console.warn(`[Store] 尝试更新不存在的项目: ${id}`)
            return state // 如果找不到项目，不做任何更改
          }
          
          // 优化crawledContent存储，只保留必要信息
          const optimizedResult = { ...result }
          if (result.crawledContent) {
            optimizedResult.crawledContent = {
              title: result.crawledContent.title,
              description: result.crawledContent.description,
              // 限制content长度，避免存储过大
              content: result.crawledContent.content?.substring(0, 1500), // 限制到1500字符
              // 不存储页面数组，太占空间
              pages: undefined
            }
          }
          
          // 创建新的数组，确保不可变性
          const newAnalysisData = [...state.analysisData]
          const existingItem = newAnalysisData[itemIndex]
          newAnalysisData[itemIndex] = { 
            ...existingItem, 
            ...optimizedResult, 
            updatedAt: new Date() 
          } as AnalysisResult
          
          return {
            analysisData: newAnalysisData
          }
        }),
      
      deleteResults: (ids) =>
        set((state) => ({
          analysisData: state.analysisData.filter(item => !ids.includes(item.id))
        })),
      
      clearResults: () => set({ analysisData: [] }),
      
      // 分析状态
      isAnalyzing: false,
      currentProgress: 0,
      totalItems: 0,
      setAnalyzing: (status) => set({ isAnalyzing: status }),
      setProgress: (current, total) => set({ currentProgress: current, totalItems: total }),
      
      // 云端同步功能
      isSyncingToCloud: false,
      lastCloudSyncTime: undefined,
      cloudSyncError: undefined,
      syncToCloud: async () => {
        // 这个函数会在下面重新定义
      },
      loadFromCloud: async () => {
        // 这个函数会在下面重新定义
      },
      
      // 后台任务管理
      backgroundTasks: [],
      addBackgroundTask: (taskId) =>
        set((state) => {
          // 限制后台任务数量，避免无限增长
          const allTasks = [...state.backgroundTasks, taskId]
          const limitedTasks = allTasks.length > 10 
            ? allTasks.slice(-10) 
            : allTasks
          
          return {
            backgroundTasks: limitedTasks
          }
        }),
      
      removeBackgroundTask: (taskId) =>
        set((state) => ({
          backgroundTasks: state.backgroundTasks.filter(id => id !== taskId)
        })),
      
      syncBackgroundTaskResults: async (taskId) => {
        try {
          console.log('开始同步后台任务结果:', taskId)
          
          const response = await fetch('/api/background-task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'results',
              taskId
            })
          })
          
          if (response.ok) {
            const data = await response.json()
            console.log('获取到后台任务数据:', data)
            
            const { addUrls, updateResult } = get()
            const currentAnalysisData = get().analysisData
            console.log('当前分析数据:', currentAnalysisData.map(item => ({ url: item.url, status: item.status })))
            
            // 将后台任务结果同步到前端状态
            if (data.results && data.results.length > 0) {
              console.log('同步成功结果:', data.results.length, '个')
              
              // 首先确保所有URL都已添加
              const urls = data.results.map((result: any) => result.url)
              addUrls(urls)
              
              // 等待一下，确保URL已添加
              await new Promise(resolve => setTimeout(resolve, 100))
              
              // 获取最新的分析数据
              const latestAnalysisData = get().analysisData
              
              // 更新每个URL的分析结果
              data.results.forEach((result: any) => {
                const existingItem = latestAnalysisData.find(item => item.url === result.url)
                console.log(`更新结果 ${result.url}:`, existingItem ? '找到' : '未找到')
                
                if (existingItem) {
                  updateResult(existingItem.id, {
                    result: result.analyzeData?.result || 'PENDING',
                    reason: result.analyzeData?.reason || '',
                    status: 'completed',
                    crawledContent: result.crawlData
                  })
                } else {
                  console.warn('未找到URL对应的分析项:', result.url)
                }
              })
            }
            
            // 处理错误结果
            if (data.errors && data.errors.length > 0) {
              console.log('同步错误结果:', data.errors.length, '个')
              
              // 首先确保所有URL都已添加
              const errorUrls = data.errors.map((error: any) => error.url).filter(Boolean)
              if (errorUrls.length > 0) {
                addUrls(errorUrls)
                await new Promise(resolve => setTimeout(resolve, 100))
              }
              
              const latestAnalysisData = get().analysisData
              
              data.errors.forEach((error: any) => {
                const existingItem = latestAnalysisData.find(item => item.url === error.url)
                console.log(`更新错误 ${error.url}:`, existingItem ? '找到' : '未找到')
                
                if (existingItem) {
                  updateResult(existingItem.id, {
                    result: 'ERROR',
                    reason: error.message,
                    status: 'failed',
                    error: error.message,
                    errorDetails: {
                      type: error.type || 'unknown_error',
                      stage: error.stage || 'crawling',
                      message: error.message,
                      retryable: true
                    }
                  })
                } else {
                  console.warn('未找到错误URL对应的分析项:', error.url)
                }
              })
            }
            
            console.log('后台任务结果同步完成')
          } else {
            console.error('获取后台任务结果失败:', response.status, response.statusText)
          }
        } catch (error) {
          console.error('同步后台任务结果失败:', error)
        }
      }
    }),
    {
      name: 'analysis-store',
      partialize: (state) => ({
        config: state.config,
        // 只保存最新的10000条分析数据，防止localStorage过大
        analysisData: state.analysisData.slice(-10000),
        // 只保存最新的5个后台任务
        backgroundTasks: state.backgroundTasks.slice(-5)
      }),
      onRehydrateStorage: () => (state) => {
        console.log('Rehydrating store:', state)
        if (state?.config) {
          console.log('Config loaded from storage:', state.config)
        }
        
        // 清理过期数据
        if (state?.analysisData) {
          const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          const filteredData = state.analysisData.filter(item => 
            new Date(item.createdAt) > oneWeekAgo
          )
          if (filteredData.length !== state.analysisData.length) {
            console.log(`清理了 ${state.analysisData.length - filteredData.length} 条过期数据`)
            state.analysisData = filteredData
          }
        }
      },
      version: 2, // 增加版本号，触发migration
      migrate: (persistedState: any, version: number) => {
        console.log('Migrating store from version:', version)
        
        if (version < 2) {
          // 清理旧版本的大数据
          if (persistedState.analysisData && persistedState.analysisData.length > 10000) {
            console.log('Migration: 清理过多的分析数据')
            persistedState.analysisData = persistedState.analysisData.slice(-10000)
          }
          
          if (persistedState.backgroundTasks && persistedState.backgroundTasks.length > 5) {
            console.log('Migration: 清理过多的后台任务')
            persistedState.backgroundTasks = persistedState.backgroundTasks.slice(-5)
          }
        }
        
        return persistedState
      }
    }
  )
)

// 扩展store以支持云端同步
const originalStore = useAnalysisStore

// 为store添加云端同步功能
Object.assign(useAnalysisStore.getState(), {
  isSyncingToCloud: false,
  lastCloudSyncTime: undefined,
  cloudSyncError: undefined,
  
  // 同步到云端
  syncToCloud: async () => {
    const state = useAnalysisStore.getState()
    
    try {
      useAnalysisStore.setState({ isSyncingToCloud: true })
      
      console.log('🔄 开始云端同步...')
      
      // 准备要同步的数据
      const dataToSync = {
        config: state.config,
        analysisData: state.analysisData.slice(-5000), // 限制数据量
        backgroundTasks: state.backgroundTasks.slice(-10),
        timestamp: new Date().toISOString(),
        version: '1.0'
      }
      
      // 调用存储API
      const response = await fetch('/api/storage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'save',
          key: 'analysis-store-data',
          data: dataToSync
        })
      })
      
      if (!response.ok) {
        throw new Error(`存储API调用失败: ${response.status}`)
      }
      
      const result = await response.json()
      console.log('✅ 云端同步成功:', result.message)
      
      // 同时保存本地备份
      try {
        localStorage.setItem('analysis-store-backup', JSON.stringify(dataToSync))
        console.log('📁 本地备份已更新')
      } catch (localError) {
        console.warn('本地备份失败:', localError)
      }
      
      useAnalysisStore.setState({
        isSyncingToCloud: false,
        lastCloudSyncTime: new Date(),
        cloudSyncError: undefined
      })
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '同步失败'
      
      useAnalysisStore.setState({
        isSyncingToCloud: false,
        cloudSyncError: errorMessage
      })
      
      console.error('❌ 云端同步失败:', errorMessage)
      
      // 同步失败时，至少保证本地备份
      try {
        const fallbackData = {
          config: state.config,
          analysisData: state.analysisData.slice(-3000),
          backgroundTasks: state.backgroundTasks.slice(-5),
          timestamp: new Date().toISOString(),
          isFallback: true
        }
        localStorage.setItem('analysis-store-fallback', JSON.stringify(fallbackData))
        console.log('💾 已创建本地兜底备份')
      } catch (fallbackError) {
        console.error('兜底备份也失败了:', fallbackError)
      }
    }
  },
  
  // 从云端加载数据
  loadFromCloud: async () => {
    const state = useAnalysisStore.getState()
    
    try {
      console.log('🔄 正在从云端加载数据...')
      
      // 先尝试从云端API加载
      const response = await fetch('/api/storage?key=analysis-store-data', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const result = await response.json()
        
        if (result.data && result.success) {
          const cloudData = result.data
          
          // 验证数据完整性
          if (cloudData.config || cloudData.analysisData || cloudData.backgroundTasks) {
            // 合并云端数据到当前状态
            useAnalysisStore.setState({
              config: { ...state.config, ...cloudData.config },
              analysisData: cloudData.analysisData || state.analysisData,
              backgroundTasks: cloudData.backgroundTasks || state.backgroundTasks,
              cloudSyncError: undefined
            })
            
            console.log('✅ 从云端加载数据成功')
            console.log(`📊 恢复了 ${cloudData.analysisData?.length || 0} 条分析记录`)
            console.log(`⏰ 数据时间戳: ${cloudData.timestamp}`)
            
            return
          }
        }
      }
      
      // 云端加载失败，尝试本地备份
      console.log('☁️ 云端暂无数据，尝试加载本地备份...')
      
      const backupSources = [
        'analysis-store-backup',
        'analysis-store-fallback', 
        'analysis-store-final-backup'
      ]
      
      for (const backupKey of backupSources) {
        try {
          const backup = localStorage.getItem(backupKey)
          if (backup) {
            const backupData = JSON.parse(backup)
            
            // 合并备份数据到当前状态
            useAnalysisStore.setState({
              config: { ...state.config, ...backupData.config },
              analysisData: backupData.analysisData || state.analysisData,
              backgroundTasks: backupData.backgroundTasks || state.backgroundTasks,
              cloudSyncError: undefined
            })
            
            console.log(`✅ 从本地备份恢复数据: ${backupKey}`)
            console.log(`📊 恢复了 ${backupData.analysisData?.length || 0} 条分析记录`)
            console.log(`⏰ 备份时间: ${backupData.timestamp}`)
            
            if (backupData.isFallback) {
              console.warn('⚠️  使用的是兜底备份数据')
            }
            
            return
          }
                 } catch (error) {
           console.warn(`加载 ${backupKey} 失败:`, error)
           // 继续尝试下一个备份源
         }
      }
      
      console.log('📝 未找到任何备份数据，使用默认状态')
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '加载失败'
      
      useAnalysisStore.setState({
        cloudSyncError: errorMessage
      })
      
      console.error('❌ 从云端加载数据失败:', errorMessage)
      
      // 尝试最后的本地恢复
      try {
        const emergencyBackup = localStorage.getItem('analysis-store')
        if (emergencyBackup) {
          console.log('🚨 尝试从zustand持久化数据恢复...')
          // zustand的persist会自动处理这个
        }
      } catch (emergencyError) {
        console.error('紧急恢复也失败了:', emergencyError)
      }
    }
  }
})

// 自动云端同步（每5分钟）
if (typeof window !== 'undefined') {
  setInterval(() => {
    const state = useAnalysisStore.getState()
    if (!state.isSyncingToCloud && state.analysisData.length > 0) {
      console.log('🔄 执行定时云端同步...')
      state.syncToCloud?.()
    }
  }, 5 * 60 * 1000) // 5分钟
  
  // 页面关闭前同步
  window.addEventListener('beforeunload', () => {
    const state = useAnalysisStore.getState()
    if (!state.isSyncingToCloud) {
      // 使用同步方式进行最后的备份
      try {
        const dataToSave = {
          config: state.config,
          analysisData: state.analysisData.slice(-3000),
          backgroundTasks: state.backgroundTasks.slice(-5),
          timestamp: new Date().toISOString()
        }
        localStorage.setItem('analysis-store-final-backup', JSON.stringify(dataToSave))
      } catch (error) {
        console.warn('最终备份失败:', error)
      }
    }
  })
} 
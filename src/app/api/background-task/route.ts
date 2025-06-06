import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import axios from 'axios'
import * as cheerio from 'cheerio'

// 增强的多页面爬虫逻辑
async function crawlWebsite(url: string) {
  let targetUrl: string
  
  try {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
      targetUrl = urlObj.toString()
    } catch (error) {
      throw new Error(`URL格式不正确: ${url}`)
    }
    
    // 通用请求配置
    const requestConfig = {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      },
      maxRedirects: 3
    }
    
    // 1. 爬取主页
    console.log(`正在爬取主页: ${targetUrl}`)
    const mainResponse = await axios.get(targetUrl, requestConfig)
    const mainPage$ = cheerio.load(mainResponse.data)
    
    // 提取基本信息
    const title = mainPage$('title').text().trim() || mainPage$('h1').first().text().trim() || '无标题'
    const description = mainPage$('meta[name="description"]').attr('content') || 
                       mainPage$('meta[property="og:description"]').attr('content') || 
                       mainPage$('meta[name="keywords"]').attr('content') || ''
    const keywords = mainPage$('meta[name="keywords"]').attr('content') || ''
    
    // 收集所有页面内容
    let allContent = ''
    const pagesInfo: string[] = []
    
    // 从主页提取内容
    const mainContent = extractPageContent(mainPage$, '主页')
    allContent += `=== 主页内容 ===\n${mainContent}\n\n`
    pagesInfo.push('主页')
    
    // 2. 寻找并爬取关键页面
    const baseUrl = new URL(targetUrl)
    const pagesToCrawl = findKeyPages(mainPage$, baseUrl.origin)
    
    for (const pageInfo of pagesToCrawl) {
      if (allContent.length >= 5000) break // 控制总长度
      
      try {
        console.log(`正在爬取页面: ${pageInfo.name} - ${pageInfo.url}`)
        await new Promise(resolve => setTimeout(resolve, 500)) // 避免请求过快
        
        const pageResponse = await axios.get(pageInfo.url, {
          ...requestConfig,
          timeout: 10000 // 减少单页超时时间
        })
        
        const page$ = cheerio.load(pageResponse.data)
        const pageContent = extractPageContent(page$, pageInfo.name)
        
        if (pageContent.length > 50) { // 只添加有意义的内容
          allContent += `=== ${pageInfo.name}页面内容 ===\n${pageContent}\n\n`
          pagesInfo.push(pageInfo.name)
        }
      } catch (error) {
        console.log(`爬取${pageInfo.name}页面失败，跳过: ${error instanceof Error ? error.message : '未知错误'}`)
      }
    }
    
    // 清理和限制总内容长度
    const finalContent = allContent
      .replace(/\s+/g, ' ')           // 压缩空白字符
      .replace(/\n{3,}/g, '\n\n')     // 压缩多余换行
      .replace(/[^\w\s\u4e00-\u9fff\.\,\;\:\!\?\-\(\)\[\]]/g, ' ') // 保留中英文、数字和基本标点
      .substring(0, 6000) // 扩展到6000字符
    
    // 提取额外的公司信息
    const companyInfo = mainPage$('.company, .about, .intro, .description, .overview').text().trim().substring(0, 500)
    
    // 提取页脚信息
    const footerContent = mainPage$('footer, .footer, .copyright, .contact-info').text().trim().substring(0, 300)
    
    console.log(`爬取完成，共获取${finalContent.length}字符内容，包含页面: ${pagesInfo.join(', ')}`)
    
    return { 
      title, 
      description, 
      content: finalContent,
      keywords,
      companyInfo,
      footerContent,
      pages: pagesInfo.join(', '),
      url: targetUrl
    }
    
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('爬取超时，网站响应过慢')
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        throw new Error('无法连接到目标网站，请检查URL')
      } else if (error.response?.status === 403) {
        throw new Error('网站拒绝访问，可能存在反爬虫保护')
      } else if (error.response?.status === 404) {
        throw new Error('页面不存在')
      } else if (error.response && error.response.status >= 500) {
        throw new Error('目标服务器错误')
      }
    }
    throw new Error(`爬取页面失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

// 辅助函数：从页面中提取有意义的内容
function extractPageContent(page$: any, pageName: string): string {
  // 移除无用元素
  page$('script, style, nav, header, footer, aside, .nav, .navigation, .menu, .sidebar, .breadcrumb, .pagination, .social, .share, .ad, .advertisement, iframe, noscript').remove()
  
  // 优先提取主要内容区域
  const mainContentSelectors = ['main', 'article', '.content', '.main-content', '.page-content', '.post-content', '#content', '#main']
  let content = ''
  
  for (const selector of mainContentSelectors) {
    const element = page$(selector)
    if (element.length > 0) {
      content = element.text().trim()
      break
    }
  }
  
  // 如果没找到主要内容区域，提取body内容
  if (!content) {
    content = page$('body').text().trim()
  }
  
  return content.substring(0, 1500) // 每个页面最多1500字符
}

// 辅助函数：寻找关键页面链接
function findKeyPages(mainPage$: any, baseUrl: string) {
  const keyPages: { name: string; url: string }[] = []
  
  // 定义关键页面的关键词（中英文）
  const keyPatterns = [
    { patterns: ['about', '关于', 'about-us', 'company', '公司'], name: '关于我们' },
    { patterns: ['product', '产品', 'products', 'catalog', '目录'], name: '产品中心' },
    { patterns: ['service', '服务', 'services', 'solution', '解决方案'], name: '服务中心' },
    { patterns: ['contact', '联系', 'contact-us', '联系我们'], name: '联系我们' },
    { patterns: ['news', '新闻', 'blog', '资讯', 'press'], name: '新闻资讯' }
  ]
  
  // 查找导航链接
  const navLinks = mainPage$('nav a, .nav a, .navigation a, .menu a, header a').toArray()
  const allLinks = mainPage$('a[href]').toArray()
  
  // 合并所有链接，优先处理导航链接
  const linksToCheck = [...navLinks, ...allLinks]
  
  for (const keyPattern of keyPatterns) {
    if (keyPages.length >= 4) break // 最多爬取4个额外页面
    
    for (const link of linksToCheck) {
      const href = mainPage$(link).attr('href')
      const text = mainPage$(link).text().toLowerCase().trim()
      
      if (!href) continue
      
      // 检查是否匹配关键词
      const isMatch = keyPattern.patterns.some(pattern => 
        text.includes(pattern.toLowerCase()) || href.toLowerCase().includes(pattern.toLowerCase())
      )
      
      if (isMatch) {
        let fullUrl = ''
        try {
          if (href.startsWith('http')) {
            fullUrl = href
          } else if (href.startsWith('/')) {
            fullUrl = baseUrl + href
          } else if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) {
            // 跳过锚点和JavaScript链接 - 直接继续下一个循环
          } else {
            fullUrl = baseUrl + '/' + href
          }
          
          // 避免重复和自己
          if (!keyPages.some(p => p.url === fullUrl) && fullUrl !== baseUrl) {
            keyPages.push({ name: keyPattern.name, url: fullUrl })
            break // 每种类型只取第一个匹配的链接
          }
        } catch (error) {
          // 跳过无效链接，继续处理下一个
        }
      }
    }
  }
  
  return keyPages
}

// 优化的AI分析逻辑
async function analyzeWebsite(config: any, crawledContent: any) {
  try {
    if (!config.apiKey) {
      throw new Error('API密钥未配置')
    }
    
    if (!config.apiUrl) {
      throw new Error('API地址未配置')
    }
    
    if (!crawledContent || !crawledContent.content) {
      throw new Error('没有可分析的内容')
    }
    
    // 使用用户配置的提示词模板，而非硬编码
    const optimizedPrompt = config.promptTemplate
      .replace(/{title}/g, crawledContent.title || '无标题')
      .replace(/{description}/g, crawledContent.description || '无描述')
      .replace(/{content}/g, crawledContent.content || '无内容')
      .replace(/{footerContent}/g, crawledContent.footerContent || '无页脚信息')
      .replace(/{pages}/g, crawledContent.pages || '仅爬取了主页')
      .replace(/{keywords}/g, crawledContent.keywords || '无关键词')
      .replace(/{companyInfo}/g, crawledContent.companyInfo || '无额外公司信息')
      .replace(/{url}/g, crawledContent.url || '未知URL')
    
    // 调用AI分析 - 优化参数
    const response = await axios.post(
      config.apiUrl,
      {
        model: config.modelName,
        messages: [
          {
            role: 'system',
            content: '你是一个专业的网站分析助手，擅长判断网站是否属于目标客户。请严格按照JSON格式返回分析结果，不要添加任何额外说明。'
          },
          {
            role: 'user',
            content: optimizedPrompt
          }
        ],
        temperature: 0.1, // 降低随机性，提高一致性
        max_tokens: 800,  // 适当增加token数量
        response_format: { type: "json_object" } // 如果API支持，强制JSON格式
      },
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 45000 // 增加超时时间
      }
    )
    
    const aiResponse = response.data.choices[0]?.message?.content
    if (!aiResponse) {
      throw new Error('AI返回空响应')
    }
    
    // 改进的JSON解析
    try {
      // 清理可能的markdown格式
      const cleanedResponse = aiResponse
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim()
      
      const parsed = JSON.parse(cleanedResponse)
      
      return {
        result: parsed.result === 'Y' ? 'Y' : 'N',
        reason: (parsed.reason || '无具体原因').substring(0, 500), // 限制原因长度
        confidence: parsed.confidence || null // 如果AI返回了置信度
      }
    } catch (parseError) {
      console.warn('JSON解析失败，尝试文本提取:', aiResponse)
      
      // 更强健的文本提取
      const resultMatch = aiResponse.match(/["\s]*result["\s]*:\s*["\s]*(Y|N)["\s]*/i)
      const reasonMatch = aiResponse.match(/["\s]*reason["\s]*:\s*["\s]*([^"]+)["\s]*/i)
      
      if (resultMatch) {
        return {
          result: resultMatch[1].toUpperCase() as 'Y' | 'N',
          reason: reasonMatch ? reasonMatch[1].substring(0, 500) : aiResponse.substring(0, 300)
        }
      } else {
        // 最后的fallback
        return {
          result: 'N' as const,
          reason: `AI响应解析失败，原始响应: ${aiResponse.substring(0, 200)}`
        }
      }
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        throw new Error('API密钥无效，请检查配置')
      } else if (error.response?.status === 429) {
        throw new Error('API调用频率超限，请稍后重试')
      } else if (error.response?.status === 400) {
        throw new Error('请求参数错误，请检查模型名称和API地址')
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('AI分析超时，请稍后重试')
      }
    }
    throw new Error(`AI分析失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

// 内存中的任务队列 (生产环境应该使用Redis或数据库)
const backgroundTasks = new Map<string, {
  id: string
  type: 'analyze' | 'crawl'
  urls: string[]
  config: any
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: { current: number; total: number }
  results: any[]
  errors: any[]
  currentlyProcessing: string[] // 正在处理的URL
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
}>()

// 正在运行的任务处理器
const runningTasks = new Map<string, {
  abortController: AbortController
  promise: Promise<void>
}>()

// 内存管理配置
const MEMORY_CONFIG = {
  MAX_TASKS: 50,              // 最大任务数量
  MAX_RESULTS_PER_TASK: 10000,  // 提升到10000个结果支持
  MAX_ERRORS_PER_TASK: 5000,   // 提升到5000个错误支持
  CLEANUP_INTERVAL: 2 * 60 * 1000, // 2分钟清理一次，更频繁
  TASK_RETENTION_TIME: 7 * 24 * 60 * 60 * 1000, // 任务保留7天
  BATCH_SIZE: 20,             // 减少批次大小到20，降低内存压力
  BATCH_DELAY: 200,           // 减少批次间延迟到200ms，提高处理速度
  MEMORY_CHECK_INTERVAL: 50,  // 每50个URL检查一次内存，更频繁
  CONCURRENT_LIMIT_NORMAL: 8, // 普通情况下的并发限制
  CONCURRENT_LIMIT_LARGE: 4,  // 大批量情况下的并发限制
  LARGE_BATCH_THRESHOLD: 1000, // 大批量的阈值
}

// 内存使用检查
function checkMemoryUsage() {
  const usage = process.memoryUsage()
  const heapUsedMB = usage.heapUsed / 1024 / 1024
  const rssMB = usage.rss / 1024 / 1024
  
  return {
    heapUsedMB,
    rssMB,
    isHighMemory: heapUsedMB > 300 || rssMB > 400, // 降低阈值：300MB堆内存或400MB RSS
    shouldCleanup: heapUsedMB > 200 || rssMB > 300, // 降低阈值：200MB堆内存或300MB RSS时开始清理
    isCritical: heapUsedMB > 500 || rssMB > 600     // 新增严重状态，需要强制清理
  }
}

// 自动清理函数
function performMemoryCleanup() {
  const now = new Date()
  const cutoffTime = new Date(now.getTime() - MEMORY_CONFIG.TASK_RETENTION_TIME)
  
  let cleanedTasks = 0
  let cleanedResults = 0
  let cleanedErrors = 0
  
  // 清理过期的已完成任务
  for (const [taskId, task] of backgroundTasks.entries()) {
    if (
      (task.status === 'completed' || task.status === 'failed') &&
      task.completedAt &&
      task.completedAt < cutoffTime
    ) {
      backgroundTasks.delete(taskId)
      cleanedTasks++
      continue
    }
    
    // 清理任务中过多的结果和错误记录
    if (task.results.length > MEMORY_CONFIG.MAX_RESULTS_PER_TASK) {
      const excessResults = task.results.length - MEMORY_CONFIG.MAX_RESULTS_PER_TASK
      task.results = task.results.slice(-MEMORY_CONFIG.MAX_RESULTS_PER_TASK) // 保留最新的
      cleanedResults += excessResults
    }
    
    if (task.errors.length > MEMORY_CONFIG.MAX_ERRORS_PER_TASK) {
      const excessErrors = task.errors.length - MEMORY_CONFIG.MAX_ERRORS_PER_TASK
      task.errors = task.errors.slice(-MEMORY_CONFIG.MAX_ERRORS_PER_TASK) // 保留最新的
      cleanedErrors += excessErrors
    }
  }
  
  // 如果任务总数超过限制，删除最老的已完成任务
  if (backgroundTasks.size > MEMORY_CONFIG.MAX_TASKS) {
    const completedTasks = Array.from(backgroundTasks.entries())
      .filter(([_, task]) => task.status === 'completed' || task.status === 'failed')
      .sort(([_, a], [__, b]) => (a.completedAt?.getTime() || 0) - (b.completedAt?.getTime() || 0))
    
    const tasksToDelete = completedTasks.slice(0, backgroundTasks.size - MEMORY_CONFIG.MAX_TASKS)
    tasksToDelete.forEach(([taskId]) => {
      backgroundTasks.delete(taskId)
      cleanedTasks++
    })
  }
  
  if (cleanedTasks > 0 || cleanedResults > 0 || cleanedErrors > 0) {
    console.log(`[MemoryCleanup] 清理完成: 任务=${cleanedTasks}, 结果=${cleanedResults}, 错误=${cleanedErrors}, 剩余任务=${backgroundTasks.size}`)
  }
}

// 启动定期清理
setInterval(performMemoryCleanup, MEMORY_CONFIG.CLEANUP_INTERVAL)

// 在任务完成时也进行轻量清理
function lightweightCleanup() {
  const now = new Date()
  const cutoffTime = new Date(now.getTime() - MEMORY_CONFIG.TASK_RETENTION_TIME)
  
  // 只清理明显过期的任务
  for (const [taskId, task] of backgroundTasks.entries()) {
    if (
      (task.status === 'completed' || task.status === 'failed') &&
      task.completedAt &&
      task.completedAt < cutoffTime &&
      Math.random() < 0.1 // 10%的概率执行清理，避免频繁操作
    ) {
      backgroundTasks.delete(taskId)
      break // 每次只清理一个
    }
  }
}

// 后台任务处理函数（优化大批量处理）
async function processBackgroundTask(taskId: string) {
  const task = backgroundTasks.get(taskId)
  if (!task) return

  // 验证配置缓存 - 输出关键配置信息（不包含敏感的API密钥）
  console.log(`[BackgroundTask ${taskId.substring(0, 8)}] Starting with cached config:`, {
    hasApiKey: !!task.config?.apiKey,
    apiUrl: task.config?.apiUrl,
    modelName: task.config?.modelName,
    urlCount: task.urls.length,
    estimatedTime: `${Math.ceil(task.urls.length / 60)} 分钟` // 预估时间（每分钟60个URL）
  })

  task.status = 'running'
  task.startedAt = new Date()

  try {
    const abortController = new AbortController()
    
    const taskPromise = (async () => {
      const totalUrls = task.urls.length
      let batchSize = MEMORY_CONFIG.BATCH_SIZE // 开始使用默认批次大小
      
      // 根据任务规模动态调整批次大小
      if (totalUrls > 5000) {
        batchSize = Math.max(10, MEMORY_CONFIG.BATCH_SIZE * 0.5) // 超大任务使用更小批次
      } else if (totalUrls > MEMORY_CONFIG.LARGE_BATCH_THRESHOLD) {
        batchSize = Math.max(15, MEMORY_CONFIG.BATCH_SIZE * 0.75) // 大任务适中批次
      }
      
      console.log(`[BackgroundTask ${taskId.substring(0, 8)}] 开始分批处理 ${totalUrls} 个URL，初始批次大小: ${batchSize}`)
      
      for (let batchStart = 0; batchStart < totalUrls; batchStart += batchSize) {
        if (abortController.signal.aborted) break

        const batchEnd = Math.min(batchStart + batchSize, totalUrls)
        const currentBatch = task.urls.slice(batchStart, batchEnd)
        
        console.log(`[BackgroundTask ${taskId.substring(0, 8)}] 处理批次 ${Math.floor(batchStart/batchSize) + 1}/${Math.ceil(totalUrls/batchSize)} (URLs ${batchStart + 1}-${batchEnd})`)
        
        // 检查内存使用
        if (batchStart > 0 && batchStart % (MEMORY_CONFIG.MEMORY_CHECK_INTERVAL * batchSize) === 0) {
          const memoryStatus = checkMemoryUsage()
          console.log(`[BackgroundTask ${taskId.substring(0, 8)}] 内存检查: Heap=${memoryStatus.heapUsedMB.toFixed(1)}MB, RSS=${memoryStatus.rssMB.toFixed(1)}MB`)
          
          if (memoryStatus.isCritical) {
            console.log(`[BackgroundTask ${taskId.substring(0, 8)}] 严重内存压力，强制清理并暂停`)
            performMemoryCleanup()
            // 强制垃圾回收（如果可用）
            if (global.gc) {
              global.gc()
            }
            await new Promise(resolve => setTimeout(resolve, 5000)) // 暂停5秒
          } else if (memoryStatus.shouldCleanup) {
            console.log(`[BackgroundTask ${taskId.substring(0, 8)}] 触发内存清理`)
            performMemoryCleanup()
            
            // 如果内存使用过高，增加延迟
            if (memoryStatus.isHighMemory) {
              console.log(`[BackgroundTask ${taskId.substring(0, 8)}] 高内存使用，暂停2秒`)
              await new Promise(resolve => setTimeout(resolve, 2000))
            }
          }
        }

        // 并发处理当前批次
        const batchPromises = currentBatch.map(async (url, index) => {
          if (abortController.signal.aborted) return

          const globalIndex = batchStart + index
          if (!url) return // 跳过空URL
          
          try {
            // 更新进度和当前处理状态
            task.progress = { current: globalIndex + 1, total: totalUrls }
            
            // 使用新的并发限制配置
            const concurrentLimit = task.urls.length > MEMORY_CONFIG.LARGE_BATCH_THRESHOLD 
              ? MEMORY_CONFIG.CONCURRENT_LIMIT_LARGE 
              : MEMORY_CONFIG.CONCURRENT_LIMIT_NORMAL
            
            if (index >= concurrentLimit) {
              await new Promise(resolve => setTimeout(resolve, index * 100)) // 减少交错延迟
            }
            
            task.currentlyProcessing = task.currentlyProcessing || []
            task.currentlyProcessing.push(url)

            // 爬取网站 - 直接调用函数
            const crawlData = await crawlWebsite(url)

            // AI分析
            if (task.type === 'analyze') {
              const analyzeData = await analyzeWebsite(task.config, crawlData)

              task.results.push({
                url,
                crawlData: {
                  title: crawlData.title,
                  description: crawlData.description,
                  // 优化内容存储，只保留必要信息
                  content: crawlData.content?.substring(0, 2000), // 限制到2000字符
                  url: crawlData.url
                },
                analyzeData,
                completedAt: new Date()
              })
            } else {
              task.results.push({
                url,
                crawlData: {
                  title: crawlData.title,
                  description: crawlData.description,
                  content: crawlData.content?.substring(0, 2000), // 限制到2000字符
                  url: crawlData.url
                },
                completedAt: new Date()
              })
            }

            // 处理完成，从正在处理列表中移除
            task.currentlyProcessing = task.currentlyProcessing.filter(u => u !== url)

          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误'
            
            // 根据错误类型分类
            let errorType: 'crawl_error' | 'ai_error' | 'network_error' | 'timeout_error' | 'config_error' | 'unknown_error' = 'unknown_error'
            let stage: 'crawling' | 'ai_analysis' | 'info_extraction' | 'initialization' = 'crawling'
            
            if (errorMessage.includes('爬取') || errorMessage.includes('连接') || errorMessage.includes('页面不存在')) {
              errorType = 'crawl_error'
              stage = 'crawling'
            } else if (errorMessage.includes('API') || errorMessage.includes('分析')) {
              errorType = 'ai_error'
              stage = 'ai_analysis'
            } else if (errorMessage.includes('超时')) {
              errorType = 'timeout_error'
            } else if (errorMessage.includes('配置') || errorMessage.includes('密钥')) {
              errorType = 'config_error'
            }
            
            task.errors.push({
              url,
              stage,
              type: errorType,
              message: errorMessage,
              timestamp: new Date()
            })
            
            // 处理失败，从正在处理列表中移除
            if (task.currentlyProcessing) {
              task.currentlyProcessing = task.currentlyProcessing.filter(u => u !== url)
            }
          }
        })

        // 等待当前批次完成
        await Promise.allSettled(batchPromises)
        
        // 批次间延迟，根据批次大小和内存状态调整
        if (batchEnd < totalUrls) {
          const memoryStatus = checkMemoryUsage()
          let delay = MEMORY_CONFIG.BATCH_DELAY
          
          // 根据任务大小调整延迟
          if (task.urls.length > MEMORY_CONFIG.LARGE_BATCH_THRESHOLD) {
            delay = MEMORY_CONFIG.BATCH_DELAY * 2
          }
          
          // 根据内存状态调整延迟
          if (memoryStatus.isHighMemory) {
            delay = delay * 3
          } else if (memoryStatus.shouldCleanup) {
            delay = delay * 2
          }
          
          await new Promise(resolve => setTimeout(resolve, delay))
        }
        
        // 定期清理结果，避免内存积累
        if (task.results.length > MEMORY_CONFIG.MAX_RESULTS_PER_TASK) {
          console.log(`[BackgroundTask ${taskId.substring(0, 8)}] 清理过多结果: ${task.results.length} -> ${MEMORY_CONFIG.MAX_RESULTS_PER_TASK}`)
          task.results = task.results.slice(-MEMORY_CONFIG.MAX_RESULTS_PER_TASK)
        }
        
        if (task.errors.length > MEMORY_CONFIG.MAX_ERRORS_PER_TASK) {
          console.log(`[BackgroundTask ${taskId.substring(0, 8)}] 清理过多错误: ${task.errors.length} -> ${MEMORY_CONFIG.MAX_ERRORS_PER_TASK}`)
          task.errors = task.errors.slice(-MEMORY_CONFIG.MAX_ERRORS_PER_TASK)
        }
      }
      
      console.log(`[BackgroundTask ${taskId.substring(0, 8)}] 所有批次处理完成`)
    })()

    runningTasks.set(taskId, { abortController, promise: taskPromise })
    await taskPromise

    task.status = 'completed'
    task.completedAt = new Date()
    task.currentlyProcessing = [] // 清空正在处理的列表

    // 最终统计
    const successCount = task.results.length
    const errorCount = task.errors.length
    const totalTime = task.completedAt.getTime() - (task.startedAt?.getTime() || 0)
    
    console.log(`[BackgroundTask ${taskId.substring(0, 8)}] 任务完成统计:`, {
      总数: task.urls.length,
      成功: successCount,
      失败: errorCount,
      成功率: `${((successCount / task.urls.length) * 100).toFixed(1)}%`,
      总耗时: `${Math.floor(totalTime / 1000 / 60)} 分钟 ${Math.floor((totalTime / 1000) % 60)} 秒`
    })

    // 执行轻量清理
    lightweightCleanup()

  } catch (error) {
    task.status = 'failed'
    task.completedAt = new Date()
    task.currentlyProcessing = [] // 清空正在处理的列表
    task.errors.push({
      stage: 'task_execution',
      type: 'unknown_error',
      message: error instanceof Error ? error.message : '任务执行失败',
      timestamp: new Date()
    })

    console.error(`[BackgroundTask ${taskId.substring(0, 8)}] 任务执行失败:`, error)

    // 执行轻量清理
    lightweightCleanup()
  } finally {
    runningTasks.delete(taskId)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, taskId, urls, config, type } = await request.json()

    switch (action) {
      case 'create': {
        if (!urls || !Array.isArray(urls) || urls.length === 0) {
          return NextResponse.json({ error: '缺少URL列表' }, { status: 400 })
        }

        // 检查是否有正在运行或等待的任务
        const existingTask = Array.from(backgroundTasks.values()).find(task => 
          task.status === 'pending' || task.status === 'running'
        )

        if (existingTask) {
          // 向现有任务添加URL
          existingTask.urls.push(...urls)
          existingTask.progress.total = existingTask.urls.length

          return NextResponse.json({
            taskId: existingTask.id,
            message: `已向现有任务添加 ${urls.length} 个URL`,
            status: 'added_to_existing',
            totalUrls: existingTask.urls.length
          })
        } else {
          // 创建新任务
          const newTaskId = crypto.randomUUID()
          const task = {
            id: newTaskId,
            type: type || 'analyze',
            urls,
            config,
            status: 'pending' as const,
            progress: { current: 0, total: urls.length },
            results: [],
            errors: [],
            currentlyProcessing: [],
            createdAt: new Date()
          }

          backgroundTasks.set(newTaskId, task)

          // 立即开始处理任务
          processBackgroundTask(newTaskId)

          return NextResponse.json({
            taskId: newTaskId,
            message: '后台任务已创建并开始执行',
            status: 'created'
          })
        }
      }

      case 'status': {
        if (!taskId) {
          return NextResponse.json({ error: '缺少任务ID' }, { status: 400 })
        }

        const task = backgroundTasks.get(taskId)
        if (!task) {
          return NextResponse.json({ error: '任务不存在' }, { status: 404 })
        }

        return NextResponse.json({
          taskId,
          status: task.status,
          progress: task.progress,
          resultsCount: task.results.length,
          errorsCount: task.errors.length,
          createdAt: task.createdAt,
          startedAt: task.startedAt,
          completedAt: task.completedAt
        })
      }

      case 'results': {
        if (!taskId) {
          return NextResponse.json({ error: '缺少任务ID' }, { status: 400 })
        }

        const task = backgroundTasks.get(taskId)
        if (!task) {
          return NextResponse.json({ error: '任务不存在' }, { status: 404 })
        }

        return NextResponse.json({
          taskId,
          status: task.status,
          progress: task.progress,
          results: task.results,
          errors: task.errors,
          currentlyProcessing: task.currentlyProcessing,
          summary: {
            total: task.urls.length,
            completed: task.results.length,
            failed: task.errors.length,
            processing: task.currentlyProcessing.length
          }
        })
      }

      case 'realtime-status': {
        if (!taskId) {
          return NextResponse.json({ error: '缺少任务ID' }, { status: 400 })
        }

        const task = backgroundTasks.get(taskId)
        if (!task) {
          return NextResponse.json({ error: '任务不存在' }, { status: 404 })
        }

        // 返回实时状态信息
        return NextResponse.json({
          taskId,
          status: task.status,
          progress: task.progress,
          currentlyProcessing: task.currentlyProcessing,
          recentResults: task.results.slice(-5), // 最近5个结果
          recentErrors: task.errors.slice(-5),   // 最近5个错误
          summary: {
            total: task.urls.length,
            completed: task.results.length,
            failed: task.errors.length,
            remaining: task.urls.length - task.results.length - task.errors.length
          }
        })
      }

      case 'cancel': {
        if (!taskId) {
          return NextResponse.json({ error: '缺少任务ID' }, { status: 400 })
        }

        const task = backgroundTasks.get(taskId)
        if (!task) {
          return NextResponse.json({ error: '任务不存在' }, { status: 404 })
        }

        const runningTask = runningTasks.get(taskId)
        if (runningTask) {
          runningTask.abortController.abort()
          runningTasks.delete(taskId)
        }

        task.status = 'failed'
        task.completedAt = new Date()
        task.errors.push({
          stage: 'task_execution',
          type: 'unknown_error',
          message: '任务被用户取消',
          timestamp: new Date()
        })

        return NextResponse.json({
          taskId,
          message: '任务已取消',
          status: 'cancelled'
        })
      }

      case 'config-check': {
        if (!taskId) {
          return NextResponse.json({ error: '缺少任务ID' }, { status: 400 })
        }

        const task = backgroundTasks.get(taskId)
        if (!task) {
          return NextResponse.json({ error: '任务不存在' }, { status: 404 })
        }

        // 返回配置状态（不包含敏感信息）
        return NextResponse.json({
          taskId,
          configStatus: {
            hasApiKey: !!task.config?.apiKey,
            apiKeyLength: task.config?.apiKey?.length || 0,
            apiUrl: task.config?.apiUrl,
            modelName: task.config?.modelName,
            hasProxySettings: !!task.config?.proxySettings,
            hasConcurrencySettings: !!task.config?.concurrencySettings,
            hasAntiDetectionSettings: !!task.config?.antiDetectionSettings
          },
          message: 'API配置已缓存在后台任务中'
        })
      }

      case 'list': {
        const taskList = Array.from(backgroundTasks.values()).map(task => ({
          id: task.id,
          type: task.type,
          status: task.status,
          progress: task.progress,
          urlCount: task.urls.length,
          resultsCount: task.results.length,
          errorsCount: task.errors.length,
          createdAt: task.createdAt,
          startedAt: task.startedAt,
          completedAt: task.completedAt
        })).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

        return NextResponse.json({ tasks: taskList })
      }

      case 'cleanup': {
        // 清理已完成的旧任务 (超过1小时)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
        let cleaned = 0

        for (const [id, task] of backgroundTasks.entries()) {
          if (task.status === 'completed' && task.completedAt && task.completedAt < oneHourAgo) {
            backgroundTasks.delete(id)
            cleaned++
          }
        }

        return NextResponse.json({
          message: `已清理${cleaned}个过期任务`,
          remaining: backgroundTasks.size
        })
      }

      default:
        return NextResponse.json({ error: '无效的操作类型' }, { status: 400 })
    }

  } catch (error) {
    return NextResponse.json({
      error: `后台任务处理失败: ${error instanceof Error ? error.message : '未知错误'}`
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')

    if (taskId) {
      // 获取特定任务状态
      const task = backgroundTasks.get(taskId)
      if (!task) {
        return NextResponse.json({ error: '任务不存在' }, { status: 404 })
      }

      return NextResponse.json({
        taskId,
        status: task.status,
        progress: task.progress,
        resultsCount: task.results.length,
        errorsCount: task.errors.length,
        createdAt: task.createdAt,
        startedAt: task.startedAt,
        completedAt: task.completedAt
      })
    } else {
      // 获取所有任务列表
      const taskList = Array.from(backgroundTasks.values()).map(task => ({
        id: task.id,
        type: task.type,
        status: task.status,
        progress: task.progress,
        urlCount: task.urls.length,
        resultsCount: task.results.length,
        errorsCount: task.errors.length,
        createdAt: task.createdAt,
        startedAt: task.startedAt,
        completedAt: task.completedAt
      })).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

      return NextResponse.json({ 
        tasks: taskList,
        summary: {
          total: taskList.length,
          running: taskList.filter(t => t.status === 'running').length,
          pending: taskList.filter(t => t.status === 'pending').length,
          completed: taskList.filter(t => t.status === 'completed').length,
          failed: taskList.filter(t => t.status === 'failed').length
        }
      })
    }

  } catch (error) {
    return NextResponse.json({
      error: `获取任务状态失败: ${error instanceof Error ? error.message : '未知错误'}`
    }, { status: 500 })
  }
} 
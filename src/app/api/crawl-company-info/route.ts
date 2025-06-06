import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import axios from 'axios'
import * as cheerio from 'cheerio'
import { ProxyManager, getAxiosConfig, getRandomDelay } from '@/lib/proxy-utils'
import type { ProxyConfig, ProxySettings, ConcurrencySettings, AntiDetectionSettings, CompanyInfo, EmailInfo } from '@/store/analysis-store'

interface CrawlCompanyInfoRequest {
  url: string
  proxySettings?: ProxySettings
  concurrencySettings?: ConcurrencySettings
  antiDetectionSettings?: AntiDetectionSettings
  aiConfig: {
    modelName: string
    apiUrl: string
    apiKey: string
    companyNamePrompt: string
    emailCrawlPrompt: string
  }
}

interface CrawlCompanyInfoResult {
  companyInfo?: CompanyInfo
  emails?: EmailInfo[]
  crawledPages?: Array<{
    url: string
    title: string
    content: string
    type: string
  }>
  error?: string
}

// 目标页面类型识别关键词（用于信息爬取）
const INFO_PAGE_PATTERNS = {
  home: ['/', '/home', '/index', '/首页', '/main'],
  about: ['/about', '/about-us', '/company', '/who-we-are', '/关于我们', '/公司简介', '/企业介绍', '/our-story', '/history'],
  contact: ['/contact', '/contact-us', '/contacts', '/get-in-touch', '/联系我们', '/联系方式', '/reach-us'],
  privacy: ['/privacy', '/privacy-policy', '/隐私政策', '/隐私条款', '/privacy-statement'],
  terms: ['/terms', '/terms-of-service', '/terms-and-conditions', '/服务条款', '/使用条款', '/legal'],
  team: ['/team', '/our-team', '/staff', '/people', '/团队', '/员工', '/management', '/leadership'],
  support: ['/support', '/help', '/faq', '/customer-service', '/支持', '/帮助', '/客服'],
  footer: [] // 页脚信息通过特殊处理获取
}

// 判断页面类型
function getInfoPageType(url: string): string {
  const path = new URL(url).pathname.toLowerCase()
  
  for (const [type, patterns] of Object.entries(INFO_PAGE_PATTERNS)) {
    if (patterns.some(pattern => path.includes(pattern) || path === pattern)) {
      return type
    }
  }
  
  return 'other'
}

// 发现信息页面
function discoverInfoPages($: cheerio.CheerioAPI, baseUrl: string): Array<{url: string, type: string, priority: number}> {
  const links: Array<{url: string, type: string, priority: number}> = []
  const baseUrlObj = new URL(baseUrl)
  
  $('a[href]').each((_, element) => {
    const href = $(element).attr('href')
    const linkText = $(element).text().trim().toLowerCase()
    
    if (!href) return
    
    try {
      let fullUrl: string
      if (href.startsWith('http')) {
        fullUrl = href
      } else if (href.startsWith('/')) {
        fullUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}${href}`
      } else {
        fullUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}/${href}`
      }
      
      const linkUrl = new URL(fullUrl)
      if (linkUrl.host === baseUrlObj.host) {
        const pageType = getInfoPageType(fullUrl)
        
        // 设置页面优先级（针对信息爬取）
        let priority = 3
        if (pageType === 'contact') priority = 10
        else if (pageType === 'about') priority = 9
        else if (pageType === 'team') priority = 8
        else if (pageType === 'privacy' || pageType === 'terms') priority = 7
        else if (pageType === 'support') priority = 6
        else if (pageType === 'home') priority = 5
        
        // 根据链接文本调整优先级
        if (linkText.includes('联系') || linkText.includes('contact')) priority += 3
        if (linkText.includes('关于') || linkText.includes('about')) priority += 2
        if (linkText.includes('团队') || linkText.includes('team')) priority += 2
        if (linkText.includes('隐私') || linkText.includes('privacy')) priority += 1
        if (linkText.includes('条款') || linkText.includes('terms')) priority += 1
        
        links.push({ url: fullUrl, type: pageType, priority })
      }
    } catch (error) {
      // 忽略无效链接
    }
  })
  
  // 去重并按优先级排序
  const uniqueLinks = Array.from(
    new Map(links.map(link => [link.url, link])).values()
  ).sort((a, b) => b.priority - a.priority)
  
  return uniqueLinks.slice(0, 15) // 限制最多15个页面
}

// 提取页面内容（包括页脚信息）
function extractPageContent($: cheerio.CheerioAPI): string {
  // 移除脚本、样式、导航等无关内容
  $('script, style, nav, .nav, .navigation, .menu').remove()
  
  // 提取主要内容
  const mainSelectors = [
    'main',
    '.main',
    '.content',
    '.main-content',
    '#content',
    '#main',
    'article',
    '.article',
    'body'
  ]
  
  let content = ''
  for (const selector of mainSelectors) {
    const element = $(selector)
    if (element.length > 0) {
      content = element.text().trim().replace(/\s+/g, ' ')
      break
    }
  }
  
  // 特别提取页脚信息
  const footerContent = $('footer, .footer, #footer').text().trim().replace(/\s+/g, ' ')
  if (footerContent) {
    content += '\n\n页脚信息：' + footerContent
  }
  
  return content.substring(0, 5000) // 限制长度
}

// 使用AI提取公司信息
async function extractCompanyInfoWithAI(content: string, aiConfig: any): Promise<CompanyInfo | null> {
  try {
    const prompt = aiConfig.companyNamePrompt.replace('{content}', content)
    
    const response = await axios.post(aiConfig.apiUrl, {
      model: aiConfig.modelName,
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.1
    }, {
      headers: {
        'Authorization': `Bearer ${aiConfig.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    })

    const result = response.data.choices[0]?.message?.content
    if (!result) return null

    const parsed = JSON.parse(result)
    return {
      primaryName: parsed.primaryName || '',
      names: parsed.names || [],
      founderNames: parsed.founderNames || [],
      brandNames: parsed.brandNames || [],
      fullName: parsed.fullName || ''
    }
  } catch (error) {
    console.error('AI提取公司信息失败:', error)
    return null
  }
}

// 使用AI提取邮箱信息
async function extractEmailsWithAI(content: string, aiConfig: any, sourcePage: string): Promise<EmailInfo[]> {
  try {
    const prompt = aiConfig.emailCrawlPrompt.replace('{content}', content)
    
    const response = await axios.post(aiConfig.apiUrl, {
      model: aiConfig.modelName,
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.1
    }, {
      headers: {
        'Authorization': `Bearer ${aiConfig.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    })

    const result = response.data.choices[0]?.message?.content
    if (!result) return []

    const parsed = JSON.parse(result)
    return (parsed.emails || []).map((email: any) => ({
      email: email.email,
      source: sourcePage,
      ownerName: email.ownerName,
      type: email.type || 'other'
    }))
  } catch (error) {
    console.error('AI提取邮箱失败:', error)
    return []
  }
}

// 爬取单个页面
async function crawlInfoPage(
  url: string,
  proxyConfig?: ProxyConfig,
  antiDetectionSettings?: AntiDetectionSettings
): Promise<{ title: string; content: string; type: string }> {
  const config = getAxiosConfig(proxyConfig, antiDetectionSettings, true)
  
  if (antiDetectionSettings?.randomDelay) {
    const delay = getRandomDelay(
      antiDetectionSettings.minDelay || 1000,
      antiDetectionSettings.maxDelay || 3000
    )
    await new Promise(resolve => setTimeout(resolve, delay))
  }

  const response = await axios.get(url, config)
  const $ = cheerio.load(response.data)
  
  const title = $('title').text().trim() || $('h1').first().text().trim() || '无标题'
  const content = extractPageContent($)
  const type = getInfoPageType(url)
  
  return { title, content, type }
}

export async function POST(request: NextRequest) {
  try {
    const body: CrawlCompanyInfoRequest = await request.json()
    const { url, proxySettings, concurrencySettings, antiDetectionSettings, aiConfig } = body
    
    if (!url) {
      return NextResponse.json({ error: '缺少URL参数' }, { status: 400 })
    }
    
    // 验证URL格式
    let targetUrl: string
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
      targetUrl = urlObj.toString()
    } catch (error) {
      return NextResponse.json({ error: '无效的URL格式' }, { status: 400 })
    }
    
    const result: CrawlCompanyInfoResult = {}
    
    try {
      // 初始化代理管理器
      let proxyManager: ProxyManager | null = null
      if (proxySettings?.enabled && proxySettings.proxies.length > 0) {
        proxyManager = new ProxyManager(proxySettings)
      }
      
      // 1. 首先爬取主页以发现其他页面
      const mainProxy = proxyManager?.getNextProxy()
      const mainPage = await crawlInfoPage(targetUrl, mainProxy || undefined, antiDetectionSettings)
      
      // 2. 发现其他信息页面
      const discoveryProxy = proxyManager?.getNextProxy()
      const config = getAxiosConfig(discoveryProxy || undefined, antiDetectionSettings, true)
      const response = await axios.get(targetUrl, config)
      
      const $ = cheerio.load(response.data)
      const discoveredLinks = discoverInfoPages($, targetUrl)
      
      // 3. 爬取所有重要页面
      const crawledPages = [mainPage]
      
      for (const link of discoveredLinks) {
        try {
          const proxy = proxyManager?.getNextProxy()
          const pageData = await crawlInfoPage(link.url, proxy || undefined, antiDetectionSettings)
          crawledPages.push(pageData)
          
          // 添加延迟
          if (antiDetectionSettings?.randomDelay) {
            const delay = getRandomDelay(
              antiDetectionSettings.minDelay || 1000,
              antiDetectionSettings.maxDelay || 3000
            )
            await new Promise(resolve => setTimeout(resolve, delay))
          }
        } catch (error) {
          console.error(`爬取页面 ${link.url} 失败:`, error)
        }
      }
      
      result.crawledPages = crawledPages.map(page => ({
        url: targetUrl,
        title: page.title,
        content: page.content,
        type: page.type
      }))
      
      // 4. 合并所有页面内容用于AI分析
      const allContent = crawledPages.map(page => 
        `页面类型: ${page.type}\n标题: ${page.title}\n内容: ${page.content}`
      ).join('\n\n---\n\n')
      
      // 5. 使用AI提取公司信息
      const companyInfo = await extractCompanyInfoWithAI(allContent, aiConfig)
      if (companyInfo) {
        result.companyInfo = companyInfo
      }
      
      // 6. 使用AI提取邮箱信息
      const allEmails: EmailInfo[] = []
      for (const page of crawledPages) {
        const emails = await extractEmailsWithAI(page.content, aiConfig, `${page.type}页面`)
        allEmails.push(...emails)
      }
      
      // 去重邮箱
      const uniqueEmails = Array.from(
        new Map(allEmails.map(email => [email.email, email])).values()
      )
      
      result.emails = uniqueEmails
      
    } catch (error) {
      result.error = error instanceof Error ? error.message : '信息爬取失败'
    }
    
    return NextResponse.json(result)
    
  } catch (error) {
    console.error('公司信息爬取API错误:', error)
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    )
  }
} 
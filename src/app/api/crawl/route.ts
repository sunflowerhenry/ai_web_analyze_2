import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import axios from 'axios'
import * as cheerio from 'cheerio'

interface CrawlResult {
  title?: string
  description?: string
  content?: string
  pages?: Array<{
    url: string
    title: string
    content: string
  }>
  companyName?: string
  error?: string
  errorDetails?: {
    type: 'crawl_error' | 'network_error' | 'timeout_error' | 'config_error'
    stage: 'crawling' | 'initialization'
    message: string
    statusCode?: number
    retryable: boolean
  }
}

// 目标页面类型识别关键词
const PAGE_PATTERNS = {
  about: ['/about', '/about-us', '/company', '/who-we-are', '/关于我们', '/公司简介'],
  contact: ['/contact', '/contact-us', '/contacts', '/get-in-touch', '/联系我们', '/联系方式'],
  home: ['/', '/home', '/index', '/首页']
}

// 提取页面主要文本内容
function extractMainContent($: cheerio.CheerioAPI): string {
  // 移除脚本、样式、导航等无关内容
  $('script, style, nav, header, footer, aside, .nav, .navigation, .menu').remove()
  
  // 优先提取主要内容区域
  const mainSelectors = [
    'main',
    '.main',
    '.content',
    '.main-content',
    '#content',
    '#main',
    'article',
    '.article'
  ]
  
  for (const selector of mainSelectors) {
    const mainContent = $(selector)
    if (mainContent.length > 0) {
      return mainContent.text().trim().replace(/\s+/g, ' ').substring(0, 2000)
    }
  }
  
  // 如果没有找到主要内容区域，提取body内容
  return $('body').text().trim().replace(/\s+/g, ' ').substring(0, 2000)
}

// 发现相关页面链接
function discoverPages($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const links: string[] = []
  const baseUrlObj = new URL(baseUrl)
  
  $('a[href]').each((_, element) => {
    const href = $(element).attr('href')
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
      
      // 只收集同域名的链接
      const linkUrl = new URL(fullUrl)
      if (linkUrl.host === baseUrlObj.host) {
        links.push(fullUrl)
      }
    } catch (error) {
      // 忽略无效链接
    }
  })
  
  return [...new Set(links)]
}

// 根据URL路径判断页面类型
function getPageType(url: string): 'home' | 'about' | 'contact' | 'other' {
  const path = new URL(url).pathname.toLowerCase()
  
  if (PAGE_PATTERNS.about.some(pattern => path.includes(pattern))) {
    return 'about'
  }
  if (PAGE_PATTERNS.contact.some(pattern => path.includes(pattern))) {
    return 'contact'
  }
  if (PAGE_PATTERNS.home.some(pattern => path === pattern || path.endsWith(pattern))) {
    return 'home'
  }
  return 'other'
}

// 提取公司名称
function extractCompanyName($: cheerio.CheerioAPI): string {
  // 尝试从多个位置提取公司名称
  const selectors = [
    'h1',
    '.company-name',
    '.brand-name',
    '.logo-text',
    'title',
    '[class*="company"]',
    '[class*="brand"]',
    '[class*="logo"]'
  ]
  
  for (const selector of selectors) {
    const element = $(selector).first()
    if (element.length > 0) {
      const text = element.text().trim()
      if (text && text.length < 100 && text.length > 2) {
        // 清理常见的后缀
        const cleaned = text
          .replace(/\s*[-|–]\s*.*/g, '') // 移除破折号后的内容
          .replace(/\s*(官网|官方网站|首页|主页|网站).*$/g, '') // 移除网站相关词汇
          .replace(/\s*(公司|企业|集团|有限公司|股份有限公司|Co\.|Ltd\.|Inc\.|Corp\.).*$/gi, '$1') // 保留公司类型
          .trim()
        
        if (cleaned.length > 2 && cleaned.length < 50) {
          return cleaned
        }
      }
    }
  }
  
  return ''
}

// 爬取单个页面
async function crawlPage(url: string): Promise<{ title: string; content: string; description?: string; companyName?: string }> {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    })
    
    const $ = cheerio.load(response.data)
    
    const title = $('title').text().trim() || $('h1').first().text().trim() || '无标题'
    const description = $('meta[name="description"]').attr('content') || 
                      $('meta[property="og:description"]').attr('content') || ''
    const content = extractMainContent($)
    const companyName = extractCompanyName($)
    
    return { title, content, description, companyName }
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

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()
    
    if (!url) {
      return NextResponse.json({ 
        error: '缺少URL参数',
        errorDetails: {
          type: 'config_error',
          stage: 'initialization',
          message: '请求中缺少必要的URL参数',
          retryable: false
        }
      }, { status: 400 })
    }
    
    // 验证URL格式
    let targetUrl: string
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
      targetUrl = urlObj.toString()
    } catch (error) {
      return NextResponse.json({ 
        error: '无效的URL格式',
        errorDetails: {
          type: 'config_error',
          stage: 'initialization',
          message: `URL格式不正确: ${url}`,
          retryable: false
        }
      }, { status: 400 })
    }
    
    const result: CrawlResult = {}
    
    try {
      // 1. 首先爬取主页
      const mainPage = await crawlPage(targetUrl)
      result.title = mainPage.title
      result.description = mainPage.description
      result.content = mainPage.content
      result.companyName = mainPage.companyName
      
      // 2. 发现其他相关页面
      const response = await axios.get(targetUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      })
      
      const $ = cheerio.load(response.data)
      const discoveredLinks = discoverPages($, targetUrl)
      
      // 3. 只爬取关于我们页面（不爬取联系页面）
      const targetPages = discoveredLinks.filter(link => {
        const type = getPageType(link)
        return type === 'about'
      }).slice(0, 3) // 限制最多3个关于页面
      
      const pages = []
      for (const pageUrl of targetPages) {
        try {
          const pageData = await crawlPage(pageUrl)
          pages.push({
            url: pageUrl,
            title: pageData.title,
            content: pageData.content
          })
          
          // 如果主页没有公司名称，尝试从其他页面获取
          if (!result.companyName && pageData.companyName) {
            result.companyName = pageData.companyName
          }
        } catch (error) {
          // 忽略单个页面的错误，继续处理其他页面
          console.error(`爬取页面 ${pageUrl} 失败:`, error)
        }
      }
      
      if (pages.length > 0) {
        result.pages = pages
      }
      
    } catch (error) {
      result.error = error instanceof Error ? error.message : '爬取失败'
    }
    
    return NextResponse.json(result)
    
  } catch (error) {
    console.error('爬虫API错误:', error)
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    )
  }
} 
import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import * as cheerio from 'cheerio'

interface CompanyCrawlResult {
  companyName?: string
  emails?: Array<{
    email: string
    source: string
  }>
  error?: string
}

// 页面类型模式
const PAGE_PATTERNS = {
  home: ['/', '/index', '/home'],
  about: ['about', 'company', 'brand', 'who-we-are', 'our-story', 'our-company'],
  contact: ['contact', 'contacts', 'contact-us', 'get-in-touch', 'reach-us'],
  privacy: ['privacy', 'privacy-policy', 'terms', 'terms-of-service', 'legal', 'policy']
}

// 爬取单个页面
async function crawlPage(url: string): Promise<{
  title: string
  content: string
  companyName?: string
  emails?: Array<{ email: string; source: string }>
}> {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    })

    const $ = cheerio.load(response.data)
    
    // 移除脚本和样式标签
    $('script, style, nav, footer, header').remove()
    
    const title = $('title').text().trim()
    const content = $('body').text().replace(/\s+/g, ' ').trim()
    
    // 提取公司名称
    let companyName = ''
    
    // 从多个地方尝试提取公司名称
    const companySelectors = [
      'meta[property="og:site_name"]',
      'meta[name="application-name"]',
      '.company-name',
      '.brand-name',
      '.logo-text',
      'h1',
      '.header-title'
    ]
    
         for (const selector of companySelectors) {
       const element = $(selector).first()
       if (element.length) {
         const text = element.attr('content') || element.text().trim()
         if (text && text.length < 100 && text.length > 2) {
           companyName = text
           break
         }
       }
     }
    
    // 如果还没找到，从title中提取
    if (!companyName && title) {
      const titleParts = title.split(/[-|–—]/)
      if (titleParts.length > 1) {
        const lastPart = titleParts[titleParts.length - 1]
        if (lastPart) {
          companyName = lastPart.trim()
        }
      }
    }
    
    // 提取邮箱
    const emails: Array<{ email: string; source: string }> = []
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
    const pageText = response.data
    const emailMatches = pageText.match(emailRegex)
    
    if (emailMatches) {
      const uniqueEmails = [...new Set(emailMatches)]
      for (const email of uniqueEmails) {
        // 过滤掉一些常见的无用邮箱
        if (typeof email === 'string' &&
            !email.includes('example.com') && 
            !email.includes('test.com') && 
            !email.includes('placeholder') &&
            !email.includes('noreply') &&
            !email.includes('no-reply')) {
          emails.push({
            email: email.toLowerCase(),
            source: url
          })
        }
      }
    }
    
    return {
      title,
      content: content.substring(0, 2000), // 限制内容长度
      companyName,
      emails
    }
  } catch (error) {
    throw new Error(`爬取页面失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
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
      
      const urlObj = new URL(fullUrl)
      
      // 只处理同域名的链接
      if (urlObj.hostname === baseUrlObj.hostname) {
        const path = urlObj.pathname.toLowerCase()
        
        // 检查是否是目标页面类型
        const isTargetPage = [
          ...PAGE_PATTERNS.about,
          ...PAGE_PATTERNS.contact,
          ...PAGE_PATTERNS.privacy
        ].some(pattern => path.includes(pattern))
        
        if (isTargetPage && !links.includes(fullUrl)) {
          links.push(fullUrl)
        }
      }
    } catch (error) {
      // 忽略无效的URL
    }
  })
  
  return links.slice(0, 10) // 限制最多10个页面
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()
    
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
    
    const result: CompanyCrawlResult = {}
    
    try {
      // 收集所有邮箱和公司信息
      const allEmails: Array<{ email: string; source: string }> = []
      let companyName = ''
      
      // 1. 首先爬取主页
      const mainPage = await crawlPage(targetUrl)
      companyName = mainPage.companyName || ''
      if (mainPage.emails) {
        allEmails.push(...mainPage.emails)
      }
      
      // 2. 发现其他相关页面
      const response = await axios.get(targetUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      })
      
      const $ = cheerio.load(response.data)
      const discoveredLinks = discoverPages($, targetUrl)
      
      // 3. 爬取所有相关页面（联系页面、隐私条款等）
      for (const pageUrl of discoveredLinks) {
        try {
          const pageData = await crawlPage(pageUrl)
          
          // 收集邮箱
          if (pageData.emails) {
            allEmails.push(...pageData.emails)
          }
          
          // 如果主页没有公司名称，尝试从其他页面获取
          if (!companyName && pageData.companyName) {
            companyName = pageData.companyName
          }
        } catch (error) {
          // 忽略单个页面的错误，继续处理其他页面
          console.error(`爬取页面 ${pageUrl} 失败:`, error)
        }
      }
      
      // 设置结果
      if (companyName) {
        result.companyName = companyName
      }
      
      // 去重邮箱并设置结果
      if (allEmails.length > 0) {
        const uniqueEmails = allEmails.filter((email, index, self) => 
          index === self.findIndex(e => e.email === email.email)
        )
        result.emails = uniqueEmails
      }
      
    } catch (error) {
      result.error = error instanceof Error ? error.message : '爬取失败'
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
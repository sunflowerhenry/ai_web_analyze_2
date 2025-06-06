import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import axios from 'axios'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { SocksProxyAgent } from 'socks-proxy-agent'

// 用户代理列表
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
]

// 页面类型识别
const pageTypePatterns = {
  home: [/^\/$/i, /home/i, /index/i, /首页/i],
  about: [/about/i, /company/i, /who-we-are/i, /our-story/i, /关于我们/i, /公司简介/i, /企业介绍/i],
  contact: [/contact/i, /get-in-touch/i, /reach-us/i, /联系我们/i, /联系方式/i],
  privacy: [/privacy/i, /policy/i, /隐私政策/i, /隐私条款/i],
  terms: [/terms/i, /conditions/i, /service/i, /使用条款/i, /服务条款/i],
  team: [/team/i, /people/i, /staff/i, /leadership/i, /团队/i, /管理层/i],
  footer: ['footer', 'foot', '页脚']
}

// 获取代理配置
function getProxyAgent(proxySettings: any) {
  if (!proxySettings?.enabled || !proxySettings?.proxies?.length) {
    return undefined
  }

  const proxy = proxySettings.proxies[0]
  if (!proxy) return undefined

  const auth = proxy.username && proxy.password ? 
    `${proxy.username}:${proxy.password}` : ''

  if (proxy.type === 'socks5') {
    const proxyUrl = auth ? 
      `socks5://${auth}@${proxy.host}:${proxy.port}` :
      `socks5://${proxy.host}:${proxy.port}`
    return new SocksProxyAgent(proxyUrl)
  } else {
    const proxyUrl = auth ? 
      `http://${auth}@${proxy.host}:${proxy.port}` :
      `http://${proxy.host}:${proxy.port}`
    return new HttpsProxyAgent(proxyUrl)
  }
}

// 随机延迟
async function randomDelay(antiDetectionSettings: any) {
  if (antiDetectionSettings?.enabled && antiDetectionSettings?.randomDelay) {
    const delay = Math.random() * 
      (antiDetectionSettings.maxDelay - antiDetectionSettings.minDelay) + 
      antiDetectionSettings.minDelay
    await new Promise(resolve => setTimeout(resolve, delay))
  }
}

// 获取随机用户代理
function getRandomUserAgent(antiDetectionSettings: any) {
  if (antiDetectionSettings?.enabled && antiDetectionSettings?.randomUserAgent) {
    return userAgents[Math.floor(Math.random() * userAgents.length)]
  }
  return userAgents[0]
}

// 识别页面类型
function identifyPageType(url: string, title: string, content: string): string {
  const urlPath = new URL(url).pathname.toLowerCase()
  
  for (const [type, patterns] of Object.entries(pageTypePatterns)) {
    for (const pattern of patterns) {
      if (pattern instanceof RegExp) {
        if (pattern.test(urlPath) || pattern.test(title) || pattern.test(content.slice(0, 500))) {
          return type
        }
      } else {
        if (urlPath.includes(pattern) || title.toLowerCase().includes(pattern) || 
            content.toLowerCase().slice(0, 500).includes(pattern)) {
          return type
        }
      }
    }
  }
  
  return 'other'
}

// 爬取单个页面
async function crawlPage(url: string, proxyAgent: any, userAgent?: string, timeout = 30000) {
  try {
    const finalUserAgent = userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': finalUserAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      httpsAgent: proxyAgent,
      httpAgent: proxyAgent,
      timeout,
      maxRedirects: 5,
      validateStatus: (status) => status < 500
    })

    const $ = cheerio.load(response.data)
    
    // 移除脚本和样式
    $('script').remove()
    $('style').remove()
    $('noscript').remove()
    
    // 获取标题
    const titleElement = $('title').text().trim()
    const h1Element = $('h1').first().text().trim()
    const ogTitle = $('meta[property="og:title"]').attr('content')
    const title = titleElement || h1Element || ogTitle || ''
    
    // 获取描述
    const metaDesc = $('meta[name="description"]').attr('content')
    const ogDesc = $('meta[property="og:description"]').attr('content')
    const description = metaDesc || ogDesc || ''
    
    // 获取主要内容
    const content = $('body').text()
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 10000) // 限制内容长度
    
    // 获取页脚内容
    const footerContent = $('footer').text().replace(/\s+/g, ' ').trim()
    
    return {
      url,
      title,
      description,
      content,
      footerContent,
      type: identifyPageType(url, title, content)
    }
  } catch (error) {
    console.error(`Error crawling ${url}:`, error)
    return null
  }
}

// 查找相关页面链接
function findRelevantLinks($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const links = new Set<string>()
  const baseHost = new URL(baseUrl).host
  
  // 查找所有链接
  $('a[href]').each((_, element) => {
    const href = $(element).attr('href')
    if (!href) return
    
    try {
      const absoluteUrl = new URL(href, baseUrl).toString()
      const urlObj = new URL(absoluteUrl)
      
      // 只保留同域名的链接
      if (urlObj.host === baseHost) {
        // 检查是否是我们感兴趣的页面
        const pathname = urlObj.pathname.toLowerCase()
        const linkText = $(element).text().toLowerCase()
        
        for (const patterns of Object.values(pageTypePatterns)) {
          for (const pattern of patterns) {
            if (pattern instanceof RegExp) {
              if (pattern.test(pathname) || pattern.test(linkText)) {
                links.add(absoluteUrl)
                break
              }
            } else {
              if (pathname.includes(pattern) || linkText.includes(pattern)) {
                links.add(absoluteUrl)
                break
              }
            }
          }
        }
      }
    } catch (e) {
      // 忽略无效URL
    }
  })
  
  return Array.from(links)
}

export async function POST(req: NextRequest) {
  try {
    const { url, proxySettings, antiDetectionSettings } = await req.json()
    
    if (!url) {
      return NextResponse.json({ error: '请提供网站URL' }, { status: 400 })
    }

    // 获取代理和用户代理
    const proxyAgent = getProxyAgent(proxySettings)
    const userAgent = getRandomUserAgent(antiDetectionSettings)
    
    // 首先爬取主页
    await randomDelay(antiDetectionSettings)
    const homePageData = await crawlPage(url, proxyAgent, userAgent)
    
    if (!homePageData) {
      return NextResponse.json({ error: '无法访问网站' }, { status: 500 })
    }

    const pages = [homePageData]
    
    try {
      // 从主页查找其他相关页面
      const response = await axios.get(url, {
        headers: { 'User-Agent': userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
        httpsAgent: proxyAgent,
        httpAgent: proxyAgent,
        timeout: 30000
      })
      
      const $ = cheerio.load(response.data)
      const relevantLinks = findRelevantLinks($, url)
      
      // 爬取找到的相关页面（限制数量）
      const maxPages = 10
      const crawledUrls = new Set([url])
      
      for (const link of relevantLinks.slice(0, maxPages - 1)) {
        if (crawledUrls.has(link)) continue
        
        await randomDelay(antiDetectionSettings)
        const pageData = await crawlPage(link, proxyAgent, userAgent)
        
        if (pageData) {
          pages.push(pageData)
          crawledUrls.add(link)
        }
        
        if (pages.length >= maxPages) break
      }
    } catch (error) {
      console.error('Error finding additional pages:', error)
      // 即使查找其他页面失败，也返回主页数据
    }
    
    // 合并所有页面的内容
    const combinedContent = pages.map(p => p.content).join(' ')
    const footerContent = pages.map(p => p.footerContent).filter(Boolean).join(' ')
    
    return NextResponse.json({
      title: homePageData.title,
      description: homePageData.description,
      content: combinedContent.slice(0, 20000), // 限制总内容长度
      footerContent,
      pages: pages.map(p => ({
        url: p.url,
        title: p.title,
        type: p.type,
        contentLength: p.content.length
      })),
      crawledCount: pages.length
    })
    
  } catch (error) {
    console.error('Crawl error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '爬取失败' },
      { status: 500 }
    )
  }
} 
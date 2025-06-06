import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import axios from 'axios'

// 过滤无效邮箱
function filterValidEmails(emails: any[]): any[] {
  const invalidPatterns = [
    /\.(png|jpg|jpeg|gif|webp|svg|ico)$/i,
    /cdn\./i,
    /example\.com$/i,
    /test@/i,
    /demo@/i
  ]
  
  return emails.filter(email => {
    const emailAddress = typeof email === 'string' ? email : email.email
    return !invalidPatterns.some(pattern => pattern.test(emailAddress))
  })
}

export async function POST(req: NextRequest) {
  try {
    const { content, config } = await req.json()
    
    if (!content || !config.apiKey) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
    }

    // 构建提示词
    const prompt = config.emailCrawlPrompt.replace('{content}', content)
    
    // 调用AI API
    const response = await axios.post(
      config.apiUrl,
      {
        model: config.modelName,
        messages: [
          {
            role: 'system',
            content: '你是一个专业的邮箱信息提取助手，擅长从网站内容中准确提取邮箱地址和相关信息。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      },
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    )

    // 解析AI响应
    const aiResponse = response.data.choices[0].message.content
    let emailData: any
    
    try {
      emailData = JSON.parse(aiResponse)
    } catch (e) {
      // 如果解析失败，尝试提取JSON部分
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        emailData = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('无法解析AI响应')
      }
    }

    // 过滤有效邮箱
    const validEmails = filterValidEmails(emailData.emails || [])

    return NextResponse.json({ emails: validEmails })
    
  } catch (error) {
    console.error('Extract emails error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '提取邮箱信息失败' },
      { status: 500 }
    )
  }
} 
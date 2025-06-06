import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import axios from 'axios'

export async function POST(req: NextRequest) {
  try {
    const { content, config } = await req.json()
    
    if (!content || !config.apiKey) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
    }

    // 构建提示词
    const prompt = config.companyNamePrompt.replace('{content}', content)
    
    // 调用AI API
    const response = await axios.post(
      config.apiUrl,
      {
        model: config.modelName,
        messages: [
          {
            role: 'system',
            content: '你是一个专业的信息提取助手，擅长从网站内容中准确提取公司相关信息。'
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
    let companyInfo: any
    
    try {
      companyInfo = JSON.parse(aiResponse)
    } catch (e) {
      // 如果解析失败，尝试提取JSON部分
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        companyInfo = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('无法解析AI响应')
      }
    }

    return NextResponse.json({ companyInfo })
    
  } catch (error) {
    console.error('Extract company info error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '提取公司信息失败' },
      { status: 500 }
    )
  }
} 
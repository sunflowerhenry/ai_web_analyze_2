import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import axios from 'axios'

interface AnalysisRequest {
  config: {
    modelName: string
    apiUrl: string
    apiKey: string
    promptTemplate: string
  }
  crawledContent: {
    title?: string
    description?: string
    content?: string
    footerContent?: string
    pages?: Array<{
      url: string
      title: string
      type: string
      contentLength: number
    }>
    crawledCount?: number
  }
}

interface AnalysisResult {
  result: 'Y' | 'N'
  reason: string
}

// 构建分析提示词
function buildPrompt(template: string, content: any): string {
  // 页面信息摘要
  let pagesInfo = ''
  if (content.pages && content.pages.length > 0) {
    pagesInfo = content.pages.map((page: any) => 
      `${page.type}: ${page.url} (${page.title})`
    ).join('\n')
  }
  
  return template
    .replace('{title}', content.title || '无标题')
    .replace('{description}', content.description || '无描述')
    .replace('{content}', content.content || '无内容')
    .replace('{footerContent}', content.footerContent || '无页脚信息')
    .replace('{pages}', pagesInfo || '仅爬取了主页')
}

// 调用OpenAI API
async function callOpenAI(config: any, prompt: string): Promise<AnalysisResult> {
  try {
    const response = await axios.post(
      config.apiUrl,
      {
        model: config.modelName,
        messages: [
          {
            role: 'system',
            content: '你是一个专业的网站分析助手，擅长判断网站是否属于目标客户。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      },
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    )
    
    const aiResponse = response.data.choices[0]?.message?.content
    if (!aiResponse) {
      throw new Error('AI返回空响应')
    }
    
    // 尝试解析JSON响应
    try {
      const parsed = JSON.parse(aiResponse)
      return {
        result: parsed.result === 'Y' ? 'Y' : 'N',
        reason: parsed.reason || '无具体原因'
      }
    } catch (parseError) {
      // 如果不是JSON格式，尝试从文本中提取结果
      const resultMatch = aiResponse.match(/result["\s]*:["\s]*(Y|N)/i)
      const reasonMatch = aiResponse.match(/reason["\s]*:["\s]*"([^"]+)"/i)
      
      return {
        result: resultMatch ? (resultMatch[1].toUpperCase() as 'Y' | 'N') : 'N',
        reason: reasonMatch ? reasonMatch[1] : aiResponse.substring(0, 200)
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
      }
    }
    throw new Error(`AI分析失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

// 调用其他AI服务（如Claude、通义千问等）
async function callGenericAI(config: any, prompt: string): Promise<AnalysisResult> {
  try {
    // 这里可以根据不同的API地址适配不同的AI服务
    const response = await axios.post(
      config.apiUrl,
      {
        model: config.modelName,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      },
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    )
    
    const aiResponse = response.data.choices?.[0]?.message?.content || 
                      response.data.output?.text ||
                      response.data.result ||
                      response.data.content
    
    if (!aiResponse) {
      throw new Error('AI返回空响应')
    }
    
    // 尝试解析JSON响应
    try {
      const parsed = JSON.parse(aiResponse)
      return {
        result: parsed.result === 'Y' ? 'Y' : 'N',
        reason: parsed.reason || '无具体原因'
      }
    } catch (parseError) {
      // 如果不是JSON格式，尝试从文本中提取结果
      const resultMatch = aiResponse.match(/result["\s]*:["\s]*(Y|N)/i)
      const reasonMatch = aiResponse.match(/reason["\s]*:["\s]*"([^"]+)"/i)
      
      return {
        result: resultMatch ? (resultMatch[1].toUpperCase() as 'Y' | 'N') : 'N',
        reason: reasonMatch ? reasonMatch[1] : aiResponse.substring(0, 200)
      }
    }
  } catch (error) {
    throw new Error(`AI分析失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { config, crawledContent }: AnalysisRequest = await request.json()
    
    // 验证必要参数
    if (!config.apiKey) {
      return NextResponse.json({ 
        error: 'API密钥未配置',
        errorDetails: {
          type: 'config_error',
          stage: 'ai_analysis',
          message: 'AI API密钥未设置，请先配置',
          retryable: false
        }
      }, { status: 400 })
    }
    
    if (!config.apiUrl) {
      return NextResponse.json({ 
        error: 'API地址未配置',
        errorDetails: {
          type: 'config_error',
          stage: 'ai_analysis',
          message: 'AI API地址未设置，请先配置',
          retryable: false
        }
      }, { status: 400 })
    }
    
    if (!crawledContent || !crawledContent.content) {
      return NextResponse.json({ 
        error: '没有可分析的内容',
        errorDetails: {
          type: 'config_error',
          stage: 'ai_analysis',
          message: '爬取的网站内容为空，无法进行分析',
          retryable: false
        }
      }, { status: 400 })
    }
    
    // 构建分析提示词
    const prompt = buildPrompt(config.promptTemplate, crawledContent)
    
    let result: AnalysisResult
    
    try {
      // 根据API地址判断使用哪种AI服务
      if (config.apiUrl.includes('openai.com')) {
        result = await callOpenAI(config, prompt)
      } else {
        result = await callGenericAI(config, prompt)
      }
      
      return NextResponse.json(result)
      
    } catch (error) {
      // 根据错误类型返回详细的错误信息
      if (error instanceof Error) {
        let errorType: 'ai_error' | 'network_error' | 'timeout_error' | 'config_error' = 'ai_error'
        let retryable = true
        
        if (error.message.includes('API密钥无效') || error.message.includes('401')) {
          errorType = 'config_error'
          retryable = false
        } else if (error.message.includes('超时') || error.message.includes('timeout')) {
          errorType = 'timeout_error'
          retryable = true
        } else if (error.message.includes('网络') || error.message.includes('连接')) {
          errorType = 'network_error'
          retryable = true
        }
        
        return NextResponse.json({
          error: error.message,
          errorDetails: {
            type: errorType,
            stage: 'ai_analysis',
            message: error.message,
            retryable
          }
        }, { status: 500 })
      }
      
      return NextResponse.json({
        error: 'AI分析失败',
        errorDetails: {
          type: 'ai_error',
          stage: 'ai_analysis',
          message: '未知的AI分析错误',
          retryable: true
        }
      }, { status: 500 })
    }
    
  } catch (error) {
    return NextResponse.json({
      error: `请求处理失败: ${error instanceof Error ? error.message : '未知错误'}`,
      errorDetails: {
        type: 'unknown_error',
        stage: 'ai_analysis',
        message: error instanceof Error ? error.message : '请求处理失败',
        retryable: false
      }
    }, { status: 500 })
  }
} 
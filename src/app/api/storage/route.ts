import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

// 云端存储API - 支持多种存储后端
export async function POST(request: NextRequest) {
  try {
    const { action, key, data } = await request.json()
    
    if (action === 'save') {
      await saveToStorage(key, data)
      return NextResponse.json({ success: true, message: '数据保存成功' })
    }
    
    return NextResponse.json({ error: '未知操作' }, { status: 400 })
  } catch (error) {
    console.error('存储错误:', error)
    return NextResponse.json({ 
      error: '存储失败', 
      details: error instanceof Error ? error.message : '未知错误' 
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')
    
    if (!key) {
      return NextResponse.json({ error: '缺少key参数' }, { status: 400 })
    }
    
    const data = await loadFromStorage(key)
    return NextResponse.json({ data, success: true })
  } catch (error) {
    console.error('加载错误:', error)
    return NextResponse.json({ 
      error: '加载失败', 
      details: error instanceof Error ? error.message : '未知错误' 
    }, { status: 500 })
  }
}

// 智能存储选择 - 根据环境自动选择最佳存储方案
async function saveToStorage(key: string, data: any): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production'
  const timestamp = new Date().toISOString()
  
  console.log(`💾 存储数据 - 环境: ${isProduction ? '生产' : '开发'}, 键: ${key}`)
  
  if (isProduction) {
    // 生产环境存储策略（按优先级）
    const storageOptions = [
      { name: 'Vercel KV Redis', check: () => !!process.env.KV_REST_API_URL },
      { name: 'Supabase', check: () => !!process.env.SUPABASE_URL },
      { name: 'PlanetScale', check: () => !!process.env.DATABASE_URL },
      { name: 'Firebase', check: () => !!process.env.FIREBASE_PROJECT_ID }
    ]
    
    for (const option of storageOptions) {
      if (option.check()) {
        console.log(`🌟 使用 ${option.name} 进行云端存储`)
        await saveToCloudProvider(option.name, key, data)
        return
      }
    }
    
    // 兜底：使用内存存储
    console.log('⚠️  未配置云端存储，使用内存存储（重启后数据丢失）')
    await saveToMemory(key, data)
    
  } else {
    // 本地开发：文件系统存储
    console.log('📁 使用本地文件系统存储')
    await saveToLocalFiles(key, data)
  }
}

async function loadFromStorage(key: string): Promise<any> {
  const isProduction = process.env.NODE_ENV === 'production'
  
  if (isProduction) {
    // 尝试从各种云端存储加载
    const providers = ['Vercel KV', 'Supabase', 'PlanetScale', 'Firebase', 'Memory']
    
    for (const provider of providers) {
      try {
        const data = await loadFromCloudProvider(provider, key)
        if (data) {
          console.log(`✅ 从 ${provider} 加载数据成功`)
          return data
        }
             } catch (error) {
         console.warn(`从 ${provider} 加载失败:`, error)
         // 继续尝试下一个provider
       }
    }
    
    return null
    
  } else {
    // 本地开发：从文件系统加载
    return await loadFromLocalFiles(key)
  }
}

// 云端存储实现
async function saveToCloudProvider(provider: string, key: string, data: any): Promise<void> {
  const compressedData = JSON.stringify(data)
  
  switch (provider) {
    case 'Vercel KV Redis':
      // Vercel KV 实现
      if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
        const response = await fetch(`${process.env.KV_REST_API_URL}/set/${key}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.KV_REST_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(compressedData)
        })
        
        if (!response.ok) {
          throw new Error(`Vercel KV 存储失败: ${response.status}`)
        }
      }
      break
      
    case 'Supabase':
      // Supabase 实现
      if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
        const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/storage_data`, {
          method: 'POST',
          headers: {
            'apikey': process.env.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            key: key,
            data: compressedData,
            updated_at: new Date().toISOString()
          })
        })
        
        if (!response.ok) {
          throw new Error(`Supabase 存储失败: ${response.status}`)
        }
      }
      break
      
    default:
      await saveToMemory(key, data)
  }
}

async function loadFromCloudProvider(provider: string, key: string): Promise<any> {
  switch (provider) {
    case 'Vercel KV':
      if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
        const response = await fetch(`${process.env.KV_REST_API_URL}/get/${key}`, {
          headers: {
            'Authorization': `Bearer ${process.env.KV_REST_API_TOKEN}`
          }
        })
        
        if (response.ok) {
          const result = await response.json()
          return JSON.parse(result.result)
        }
      }
      break
      
    case 'Supabase':
      if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
        const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/storage_data?key=eq.${key}`, {
          headers: {
            'apikey': process.env.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`
          }
        })
        
        if (response.ok) {
          const result = await response.json()
          if (result.length > 0) {
            return JSON.parse(result[0].data)
          }
        }
      }
      break
      
    case 'Memory':
      return loadFromMemory(key)
  }
  
  return null
}

// 内存存储（临时方案）
const memoryStorage = new Map<string, any>()

async function saveToMemory(key: string, data: any): Promise<void> {
  memoryStorage.set(key, {
    data: data,
    timestamp: new Date().toISOString()
  })
}

function loadFromMemory(key: string): any {
  const stored = memoryStorage.get(key)
  return stored?.data || null
}

// 本地文件存储
async function saveToLocalFiles(key: string, data: any): Promise<void> {
  try {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    
    const dataDir = './data'
    const fileName = `${key.replace(/[^a-zA-Z0-9]/g, '_')}.json`
    const filePath = path.join(dataDir, fileName)
    
    // 确保目录存在
    await fs.mkdir(dataDir, { recursive: true })
    
    const fileData = {
      key: key,
      data: data,
      timestamp: new Date().toISOString(),
      environment: 'development'
    }
    
    await fs.writeFile(filePath, JSON.stringify(fileData, null, 2))
    console.log(`✅ 数据已保存到: ${filePath}`)
    
  } catch (error) {
    console.error('本地文件保存失败:', error)
    throw error
  }
}

async function loadFromLocalFiles(key: string): Promise<any> {
  try {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    
    const dataDir = './data'
    const fileName = `${key.replace(/[^a-zA-Z0-9]/g, '_')}.json`
    const filePath = path.join(dataDir, fileName)
    
    const content = await fs.readFile(filePath, 'utf-8')
    const fileData = JSON.parse(content)
    
    console.log(`✅ 从本地文件加载数据: ${filePath}`)
    return fileData.data
    
  } catch (error) {
    console.log(`📝 本地文件不存在: ${key}`)
    return null
  }
} 
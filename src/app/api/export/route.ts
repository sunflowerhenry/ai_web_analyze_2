import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

interface ExportData {
  id: string
  url: string
  result: string
  reason: string
  companyName: string
  emails: string
  emailSources: string
  status: string
  createdAt: string
  updatedAt: string
}

export async function POST(request: NextRequest) {
  try {
    const { data, format } = await request.json()
    
    if (!data || !Array.isArray(data)) {
      return NextResponse.json({ error: '无效的数据格式' }, { status: 400 })
    }
    
    // 准备导出数据
    const exportData: ExportData[] = data.map((item: any) => ({
      id: item.id,
      url: item.url,
      result: item.result,
      reason: item.reason || '',
      companyName: item.companyName || '',
      emails: item.emails ? item.emails.join('; ') : '',
      emailSources: item.emailSources ? item.emailSources.join('; ') : '',
      status: item.status,
      createdAt: new Date(item.createdAt).toLocaleString('zh-CN'),
      updatedAt: new Date(item.updatedAt).toLocaleString('zh-CN')
    }))
    
    switch (format) {
      case 'excel': {
        // 创建工作簿
        const wb = XLSX.utils.book_new()
        
        // 创建工作表数据
        const wsData = [
          ['序号', '网站链接', '判断结果', '判断依据', '网站公司名称', '邮箱', '邮箱来源页面', '分析状态', '创建时间', '更新时间'],
          ...exportData.map((item, index) => [
            index + 1,
            item.url,
            item.result === 'Y' ? '是' : item.result === 'N' ? '否' : item.result,
            item.reason,
            item.companyName,
            item.emails,
            item.emailSources,
            getStatusText(item.status),
            item.createdAt,
            item.updatedAt
          ])
        ]
        
        const ws = XLSX.utils.aoa_to_sheet(wsData)
        
        // 设置列宽
        ws['!cols'] = [
          { width: 8 },   // 序号
          { width: 40 },  // 网站链接
          { width: 12 },  // 判断结果
          { width: 50 },  // 判断依据
          { width: 20 },  // 网站公司名称
          { width: 30 },  // 邮箱
          { width: 40 },  // 邮箱来源页面
          { width: 12 },  // 分析状态
          { width: 20 },  // 创建时间
          { width: 20 }   // 更新时间
        ]
        
        XLSX.utils.book_append_sheet(wb, ws, '网站分析结果')
        
        // 生成Excel文件
        const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
        
        return new NextResponse(excelBuffer, {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="网站分析结果_${new Date().toISOString().split('T')[0]}.xlsx"`
          }
        })
      }
      
      case 'csv': {
        const csvData = [
          ['序号', '网站链接', '判断结果', '判断依据', '网站公司名称', '邮箱', '邮箱来源页面', '分析状态', '创建时间', '更新时间'],
          ...exportData.map((item, index) => [
            index + 1,
            item.url,
            item.result === 'Y' ? '是' : item.result === 'N' ? '否' : item.result,
            item.reason,
            item.companyName,
            item.emails,
            item.emailSources,
            getStatusText(item.status),
            item.createdAt,
            item.updatedAt
          ])
        ]
        
        const csvContent = csvData.map(row => 
          row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        ).join('\n')
        
        // 添加BOM以支持中文
        const csvWithBOM = '\uFEFF' + csvContent
        
        return new NextResponse(csvWithBOM, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="网站分析结果_${new Date().toISOString().split('T')[0]}.csv"`
          }
        })
      }
      
      case 'json': {
        const jsonData = {
          exportTime: new Date().toISOString(),
          totalCount: exportData.length,
          data: exportData.map((item, index) => ({
            序号: index + 1,
            网站链接: item.url,
            判断结果: item.result === 'Y' ? '是' : item.result === 'N' ? '否' : item.result,
            判断依据: item.reason,
            网站公司名称: item.companyName,
            邮箱: item.emails,
            邮箱来源页面: item.emailSources,
            分析状态: getStatusText(item.status),
            创建时间: item.createdAt,
            更新时间: item.updatedAt
          }))
        }
        
        return new NextResponse(JSON.stringify(jsonData, null, 2), {
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Disposition': `attachment; filename="网站分析结果_${new Date().toISOString().split('T')[0]}.json"`
          }
        })
      }
      
      default:
        return NextResponse.json({ error: '不支持的导出格式' }, { status: 400 })
    }
    
  } catch (error) {
    console.error('导出API错误:', error)
    return NextResponse.json(
      { error: '导出失败' },
      { status: 500 }
    )
  }
}

function getStatusText(status: string): string {
  switch (status) {
    case 'waiting': return '等待中'
    case 'crawling': return '爬取中'
    case 'analyzing': return '分析中'
    case 'completed': return '已完成'
    case 'failed': return '失败'
    default: return status
  }
} 
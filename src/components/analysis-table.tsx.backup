'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Play, 
  Trash2, 
  Download, 
  Copy, 
  RefreshCw, 
  Settings,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  StopCircle,
  Mail,
  Building,
  Filter,
  ArrowUpDown,
  Eye,
  EyeOff,
  PlayCircle
} from 'lucide-react'
import { useAnalysisStore, type AnalysisResult } from '@/store/analysis-store'
import { toast } from 'sonner'
import axios from 'axios'
import * as XLSX from 'xlsx'

export function AnalysisTable() {
  const { 
    analysisData, 
    deleteResults, 
    clearResults, 
    updateResult, 
    isAnalyzing, 
    setAnalyzing, 
    setProgress,
    config 
  } = useAnalysisStore()
  
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [expandedReasons, setExpandedReasons] = useState<Set<string>>(new Set())
  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(new Set())
  
  // 新增状态 - 使用 useRef 确保在异步操作中能正确访问最新状态
  const [isStopRequested, setIsStopRequested] = useState(false)
  const stopRequestedRef = useRef(false)
  const [currentAnalysisControllers, setCurrentAnalysisControllers] = useState<AbortController[]>([])
  
  // 筛选和排序状态
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterResult, setFilterResult] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [sortBy, setSortBy] = useState<string>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [showTableSettings, setShowTableSettings] = useState(false)

  // 同步停止状态到 ref
  useEffect(() => {
    stopRequestedRef.current = isStopRequested
  }, [isStopRequested])

  // 筛选和排序后的数据
  const filteredAndSortedData = useMemo(() => {
    let filtered = analysisData
    
    // 搜索筛选
    if (searchQuery.trim()) {
      filtered = filtered.filter(item => 
        item.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.reason && item.reason.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.companyInfo?.primaryName && item.companyInfo.primaryName.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    }
    
    // 状态筛选
    if (filterStatus !== 'all') {
      filtered = filtered.filter(item => item.status === filterStatus)
    }
    
    // 结果筛选
    if (filterResult !== 'all') {
      filtered = filtered.filter(item => item.result === filterResult)
    }
    
    // 排序
    filtered.sort((a, b) => {
      let aValue: any = a[sortBy as keyof AnalysisResult]
      let bValue: any = b[sortBy as keyof AnalysisResult]
      
      if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
        aValue = new Date(aValue).getTime()
        bValue = new Date(bValue).getTime()
      }
      
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase()
        bValue = bValue.toLowerCase()
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })
    
    return filtered
  }, [analysisData, filterStatus, filterResult, searchQuery, sortBy, sortOrder])

  // 当排序或筛选条件改变时重置页码到第一页
  useEffect(() => {
    setCurrentPage(1)
  }, [filterStatus, filterResult, searchQuery, sortBy, sortOrder])

  // 分页数据
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return filteredAndSortedData.slice(startIndex, startIndex + pageSize)
  }, [filteredAndSortedData, currentPage, pageSize])

  const totalPages = Math.ceil(filteredAndSortedData.length / pageSize)

  // 检查是否可以开始分析
  const canStartAnalysis = analysisData.some(item => 
    item.status === 'waiting' || item.status === 'failed'
  )

  // 检查是否可以一键爬取
  const canCrawlAll = analysisData.some(item => 
    item.result === 'Y' && !item.hasInfoCrawled
  )

  // 状态图标映射
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'waiting': return <Clock className="h-4 w-4 text-gray-500" />
      case 'crawling': return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      case 'analyzing': return <Loader2 className="h-4 w-4 text-orange-500 animate-spin" />
      case 'info-crawling': return <Loader2 className="h-4 w-4 text-purple-500 animate-spin" />
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />
      default: return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  // 结果徽章
  const getResultBadge = (result: string) => {
    switch (result) {
      case 'Y': return <Badge variant="default" className="bg-green-500">是</Badge>
      case 'N': return <Badge variant="secondary">否</Badge>
      case 'ERROR': return <Badge variant="destructive">错误</Badge>
      default: return <Badge variant="outline">待分析</Badge>
    }
  }

  // 全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(paginatedData.map(item => item.id))
    } else {
      setSelectedIds([])
    }
  }

  // 单项选择
  const handleSelectItem = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id])
    } else {
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id))
    }
  }

  // 删除选中项
  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) {
      toast.error('请先选择要删除的项目')
      return
    }
    
    deleteResults(selectedIds)
    setSelectedIds([])
    toast.success(`已删除 ${selectedIds.length} 个项目`)
  }

  // 清空所有数据
  const handleClearAll = () => {
    if (analysisData.length === 0) {
      toast.error('没有数据可清空')
      return
    }
    
    clearResults()
    setSelectedIds([])
    toast.success('已清空所有数据')
  }

  // 复制表格数据
  const handleCopyData = () => {
    if (filteredAndSortedData.length === 0) {
      toast.error('没有数据可复制')
      return
    }

    const headers = ['网站链接', '判断结果', '判断依据', '公司信息', '邮箱信息', '分析状态']
    const rows = filteredAndSortedData.map(item => [
      item.url,
      item.result === 'Y' ? '是' : item.result === 'N' ? '否' : item.result,
      item.reason || '',
      formatCompanyInfo(item.companyInfo),
      formatEmails(item.emails),
      getStatusText(item.status)
    ])

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join('\t'))
      .join('\n')

    navigator.clipboard.writeText(csvContent).then(() => {
      toast.success('数据已复制到剪贴板')
    }).catch(() => {
      toast.error('复制失败')
    })
  }

  // 导出数据
  const handleExport = (format: 'excel' | 'csv' | 'json') => {
    if (filteredAndSortedData.length === 0) {
      toast.error('没有数据可导出')
      return
    }

    try {
      const dataToExport = filteredAndSortedData.map(item => ({
        网站地址: item.url,
        分析结果: item.result === 'Y' ? '是' : item.result === 'N' ? '否' : item.result,
        判断依据: item.reason || '',
        公司名称: item.companyInfo?.primaryName || '',
        所有公司名称: item.companyInfo?.names?.join(', ') || '',
        创始人信息: item.companyInfo?.founderNames?.join(', ') || '',
        品牌名称: item.companyInfo?.brandNames?.join(', ') || '',
        邮箱信息: formatEmails(item.emails),
        邮箱详情: item.emails && Array.isArray(item.emails) ? 
          item.emails.map(email => 
            `${email.email}${email.ownerName ? ` (${email.ownerName})` : ''}${email.source ? ` - ${email.source}` : ''}`
          ).join('; ') : '',
        分析状态: getStatusText(item.status),
        是否已爬取信息: item.hasInfoCrawled ? '是' : '否',
        创建时间: new Date(item.createdAt).toLocaleString('zh-CN'),
        更新时间: new Date(item.updatedAt).toLocaleString('zh-CN'),
        错误信息: item.error || ''
      }))

      if (format === 'excel') {
        const ws = XLSX.utils.json_to_sheet(dataToExport)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, '分析结果')
        
        // 设置列宽
        const colWidths = [
          { wch: 50 }, // 网站地址
          { wch: 10 }, // 分析结果
          { wch: 30 }, // 判断依据
          { wch: 20 }, // 公司名称
          { wch: 30 }, // 所有公司名称
          { wch: 20 }, // 创始人信息
          { wch: 20 }, // 品牌名称
          { wch: 30 }, // 邮箱信息
          { wch: 50 }, // 邮箱详情
          { wch: 12 }, // 分析状态
          { wch: 12 }, // 是否已爬取信息
          { wch: 20 }, // 创建时间
          { wch: 20 }, // 更新时间
          { wch: 30 }  // 错误信息
        ]
        ws['!cols'] = colWidths
        
        const fileName = `网站分析结果_${new Date().toISOString().slice(0, 10)}.xlsx`
        XLSX.writeFile(wb, fileName)
        toast.success('Excel文件已下载')
        
      } else if (format === 'csv') {
        const headers = Object.keys(dataToExport[0] || {})
        const csvContent = [
          headers.join(','),
          ...dataToExport.map(row => 
            headers.map(header => `"${String(row[header as keyof typeof row] || '').replace(/"/g, '""')}"`).join(',')
          )
        ].join('\n')
        
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `网站分析结果_${new Date().toISOString().slice(0, 10)}.csv`
        link.click()
        toast.success('CSV文件已下载')
        
      } else if (format === 'json') {
        const jsonContent = JSON.stringify(dataToExport, null, 2)
        const blob = new Blob([jsonContent], { type: 'application/json' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `网站分析结果_${new Date().toISOString().slice(0, 10)}.json`
        link.click()
        toast.success('JSON文件已下载')
      }
    } catch (error) {
      toast.error('导出失败')
      console.error('Export error:', error)
    }
  }

  // 开始分析（支持并发）
  const handleStartAnalysis = async () => {
    if (!config.apiKey) {
      toast.error('请先配置AI API密钥')
      return
    }

    const pendingItems = analysisData.filter(item => 
      item.status === 'waiting' || item.status === 'failed'
    )

    if (pendingItems.length === 0) {
      toast.error('没有待分析的项目')
      return
    }

    const controllers: AbortController[] = []
    setCurrentAnalysisControllers(controllers)
    setAnalyzing(true)
    setIsStopRequested(false)
    stopRequestedRef.current = false  // 确保重置停止状态
    setProgress(0, pendingItems.length)

    try {
      // 检查是否启用并发
      const concurrency = config.concurrencySettings?.enabled ? 
        (config.concurrencySettings?.maxConcurrent || 3) : 1

      // 分批处理
      for (let i = 0; i < pendingItems.length; i += concurrency) {
        if (stopRequestedRef.current) {
          console.log('Analysis stopped by user request')
          break
        }

        const batch = pendingItems.slice(i, i + concurrency)
        
        // 并发处理当前批次
        const batchPromises = batch.map(async (item) => {
          if (stopRequestedRef.current) {
            console.log(`Skipping ${item.url} due to stop request`)
            return
          }

          const controller = new AbortController()
          controllers.push(controller)

          try {
            // 检查停止状态
            if (stopRequestedRef.current) {
              updateResult(item.id, { status: 'waiting' })
              return
            }

            // 更新状态为爬取中
            updateResult(item.id, { status: 'crawling' })

            // 爬取网站内容（增强版）
            const crawlResponse = await axios.post('/api/crawl-enhanced', { 
              url: item.url,
              proxySettings: config.proxySettings,
              antiDetectionSettings: config.antiDetectionSettings
            }, {
              signal: controller.signal,
              timeout: 60000
            })
            
            // 再次检查停止状态
            if (stopRequestedRef.current) {
              updateResult(item.id, { status: 'waiting' })
              return
            }
            
            if (crawlResponse.data.error) {
              updateResult(item.id, { 
                status: 'failed', 
                result: 'ERROR',
                reason: crawlResponse.data.error,
                error: crawlResponse.data.error
              })
              return
            }

            // 检查停止状态
            if (stopRequestedRef.current) {
              updateResult(item.id, { status: 'waiting' })
              return
            }

            // 更新状态为分析中
            updateResult(item.id, { 
              status: 'analyzing',
              crawledContent: crawlResponse.data
            })

            // 使用AI分析是否为目标客户
            const analysisResponse = await axios.post('/api/analyze', {
              config,
              crawledContent: crawlResponse.data
            }, {
              signal: controller.signal,
              timeout: 30000
            })

            // 再次检查停止状态
            if (stopRequestedRef.current) {
              updateResult(item.id, { status: 'waiting' })
              return
            }

            // 使用AI提取公司信息
            const companyInfoResponse = await axios.post('/api/extract-company-info', {
              content: crawlResponse.data.content,
              config
            }, {
              signal: controller.signal,
              timeout: 30000
            })

            // 最后检查停止状态
            if (stopRequestedRef.current) {
              updateResult(item.id, { status: 'waiting' })
              return
            }

            // 更新分析结果
            updateResult(item.id, {
              status: 'completed',
              result: analysisResponse.data.result,
              reason: analysisResponse.data.reason,
              companyInfo: companyInfoResponse.data.companyInfo,
              hasInfoCrawled: false
            })

          } catch (error) {
            if (axios.isCancel(error) || stopRequestedRef.current) {
              updateResult(item.id, { status: 'waiting' })
              console.log(`Analysis cancelled for ${item.url}`)
              return
            }

            updateResult(item.id, {
              status: 'failed',
              result: 'ERROR',
              reason: '分析过程中发生错误',
              error: error instanceof Error ? error.message : '未知错误'
            })
          }
        })

        await Promise.all(batchPromises)
        setProgress(Math.min(i + concurrency, pendingItems.length), pendingItems.length)
        
        // 批次间延迟，但要检查停止状态
        if (i + concurrency < pendingItems.length && !stopRequestedRef.current) {
          const delay = config.concurrencySettings?.delayBetweenRequests || 1000
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }

      if (!stopRequestedRef.current) {
        toast.success('分析完成')
      } else {
        toast.info('分析已停止')
      }
    } catch (error) {
      if (!stopRequestedRef.current) {
        toast.error('分析过程中发生错误')
      }
    } finally {
      setAnalyzing(false)
      setIsStopRequested(false)
      stopRequestedRef.current = false
      setCurrentAnalysisControllers([])
    }
  }

  // 停止分析
  const handleStopAnalysis = () => {
    console.log('Stopping analysis...')
    setIsStopRequested(true)
    stopRequestedRef.current = true
    
    // 强制中止所有控制器
    currentAnalysisControllers.forEach(controller => {
      try {
        controller.abort()
      } catch (error) {
        console.log('Error aborting controller:', error)
      }
    })
    
    // 立即将所有进行中的任务状态重置
    analysisData.forEach(item => {
      if (item.status === 'crawling' || item.status === 'analyzing' || item.status === 'info-crawling') {
        updateResult(item.id, { status: 'waiting' })
      }
    })
    
    // 立即停止分析状态
    setAnalyzing(false)
    setCurrentAnalysisControllers([])
    
    toast.success('已停止分析')
  }

  // 爬取单个网站的详细信息
  const handleCrawlCompanyInfo = async (id: string, url: string, controller?: AbortController) => {
    try {
      // 检查停止状态
      if (stopRequestedRef.current) {
        updateResult(id, { status: 'completed' })
        return
      }

      updateResult(id, { status: 'info-crawling' })
      
      // 使用AI提取邮箱信息
      const emailResponse = await axios.post('/api/extract-emails', {
        content: analysisData.find(item => item.id === id)?.crawledContent?.content || '',
        config
      }, {
        signal: controller?.signal,
        timeout: 30000
      })

      // 再次检查停止状态
      if (stopRequestedRef.current) {
        updateResult(id, { status: 'completed' })
        return
      }

      updateResult(id, {
        status: 'completed',
        emails: emailResponse.data.emails,
        hasInfoCrawled: true
      })

      toast.success('信息爬取完成')
    } catch (error) {
      if (axios.isCancel(error) || stopRequestedRef.current) {
        updateResult(id, { status: 'completed' })
        console.log(`Info crawling cancelled for ${url}`)
        return
      }

      updateResult(id, {
        status: 'failed',
        error: error instanceof Error ? error.message : '爬取失败'
      })
      toast.error('信息爬取失败')
    }
  }

  // 一键爬取所有Y结果的信息
  const handleCrawlAllYResults = async () => {
    const yResults = analysisData.filter(item => 
      item.result === 'Y' && !item.hasInfoCrawled
    )

    if (yResults.length === 0) {
      toast.error('没有需要爬取信息的网站')
      return
    }

    if (!config.apiKey) {
      toast.error('请先配置AI API密钥')
      return
    }

    const controllers: AbortController[] = []
    setCurrentAnalysisControllers(controllers)
    setAnalyzing(true)
    setIsStopRequested(false)
    stopRequestedRef.current = false  // 确保重置停止状态

    try {
      const concurrency = config.concurrencySettings?.enabled ? 
        (config.concurrencySettings?.maxConcurrent || 3) : 1

      for (let i = 0; i < yResults.length; i += concurrency) {
        if (stopRequestedRef.current) {
          console.log('Info crawling stopped by user request')
          break
        }

        const batch = yResults.slice(i, i + concurrency)
        
        const batchPromises = batch.map(async (item) => {
          if (stopRequestedRef.current) {
            console.log(`Skipping info crawling for ${item.url} due to stop request`)
            return
          }

          const controller = new AbortController()
          controllers.push(controller)

          try {
            await handleCrawlCompanyInfo(item.id, item.url, controller)
          } catch (error) {
            if (!stopRequestedRef.current) {
              console.error('Crawl info error:', error)
            }
          }
        })

        await Promise.all(batchPromises)
        
        if (i + concurrency < yResults.length && !stopRequestedRef.current) {
          const delay = config.concurrencySettings?.delayBetweenRequests || 1000
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }

      if (!stopRequestedRef.current) {
        toast.success(`已完成 ${yResults.length} 个网站的信息爬取`)
      } else {
        toast.info('信息爬取已停止')
      }
    } catch (error) {
      if (!stopRequestedRef.current) {
        toast.error('批量爬取失败')
      }
    } finally {
      setAnalyzing(false)
      setIsStopRequested(false)
      stopRequestedRef.current = false
      setCurrentAnalysisControllers([])
    }
  }

  // 获取状态文本
  const getStatusText = (status: string): string => {
    switch (status) {
      case 'waiting': return '等待分析'
      case 'crawling': return '正在爬取'
      case 'analyzing': return '正在分析'
      case 'info-crawling': return '正在爬取信息'
      case 'completed': return '已完成'
      case 'failed': return '失败'
      default: return '未知'
    }
  }

  // 格式化邮箱信息
  const formatEmails = (emails?: any[]) => {
    if (!emails || emails.length === 0) return '无'
    
    if (emails.length === 1) {
      const email = emails[0]
      return typeof email === 'string' ? email : 
        `${email.email}${email.ownerName ? ` (${email.ownerName})` : ''}`
    }
    
    return `${emails.length} 个邮箱`
  }

  // 格式化公司信息
  const formatCompanyInfo = (companyInfo?: any) => {
    if (!companyInfo) return '无'
    
    if (typeof companyInfo === 'string') return companyInfo
    
    return companyInfo.primaryName || companyInfo.names?.[0] || '无'
  }

  // 切换展开状态
  const toggleReasonExpansion = (id: string) => {
    const newExpanded = new Set(expandedReasons)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedReasons(newExpanded)
  }

  const toggleEmailExpansion = (id: string) => {
    const newExpanded = new Set(expandedEmails)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedEmails(newExpanded)
  }

  // 停止所有分析
  const handleStopAllAnalysis = () => {
    console.log('Stopping all analysis...')
    setIsStopRequested(true)
    stopRequestedRef.current = true
    
    // 强制中止所有控制器
    currentAnalysisControllers.forEach(controller => {
      try {
        controller.abort()
      } catch (error) {
        console.log('Error aborting controller:', error)
      }
    })
    
    // 立即清空控制器数组
    setCurrentAnalysisControllers([])
    
    // 立即将所有进行中的任务状态重置为等待
    analysisData.forEach(item => {
      if (item.status === 'crawling' || item.status === 'analyzing' || item.status === 'info-crawling') {
        updateResult(item.id, { status: 'waiting' })
      }
    })
    
    // 立即停止分析状态
    setAnalyzing(false)
    
    toast.success('已强制停止所有分析任务')
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            分析结果
            <Badge variant="outline">
              {filteredAndSortedData.length} / {analysisData.length} 个网站
            </Badge>
            {(filterStatus !== 'all' || filterResult !== 'all' || searchQuery.trim()) && (
              <Badge variant="secondary" className="text-xs">
                <Filter className="h-3 w-3 mr-1" />
                已筛选
              </Badge>
            )}
          </CardTitle>
          
          <div className="flex items-center gap-2 flex-wrap">
            {/* 搜索框 */}
            <div className="flex items-center gap-2">
              <Input
                placeholder="搜索网站地址、公司名称..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
              />
            </div>

            {/* 筛选和排序控制 */}
            <div className="flex items-center gap-2 border rounded-lg p-2 bg-gray-50">
              <Filter className="h-4 w-4 text-gray-500" />
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-28 h-8 border-0 bg-transparent">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="waiting">等待分析</SelectItem>
                  <SelectItem value="crawling">正在爬取</SelectItem>
                  <SelectItem value="analyzing">正在分析</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem>
                  <SelectItem value="failed">失败</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterResult} onValueChange={setFilterResult}>
                <SelectTrigger className="w-28 h-8 border-0 bg-transparent">
                  <SelectValue placeholder="结果" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部结果</SelectItem>
                  <SelectItem value="Y">是</SelectItem>
                  <SelectItem value="N">否</SelectItem>
                  <SelectItem value="ERROR">错误</SelectItem>
                  <SelectItem value="PENDING">待分析</SelectItem>
                </SelectContent>
              </Select>

              {(filterStatus !== 'all' || filterResult !== 'all' || searchQuery.trim()) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilterStatus('all')
                    setFilterResult('all')
                    setSearchQuery('')
                  }}
                  className="h-6 px-2 text-xs"
                >
                  重置
                </Button>
              )}
            </div>

            <div className="flex items-center gap-1 border rounded-lg p-2 bg-gray-50">
              <ArrowUpDown className="h-4 w-4 text-gray-500" />
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-28 h-8 border-0 bg-transparent">
                  <SelectValue placeholder="排序" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">创建时间</SelectItem>
                  <SelectItem value="updatedAt">更新时间</SelectItem>
                  <SelectItem value="url">网站地址</SelectItem>
                  <SelectItem value="result">分析结果</SelectItem>
                  <SelectItem value="status">状态</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="h-6 w-6 p-0"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </Button>
            </div>

            {/* 表格设置 */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowTableSettings(!showTableSettings)}
            >
              <Settings className="h-4 w-4" />
            </Button>

            {/* 操作按钮 */}
            {isAnalyzing ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleStopAnalysis}
                >
                  <StopCircle className="h-4 w-4 mr-2" />
                  停止分析
                </Button>
                
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleStopAllAnalysis}
                >
                  <StopCircle className="h-4 w-4 mr-2" />
                  全部停止
                </Button>
              </div>
            ) : (
              <>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleStartAnalysis}
                  disabled={!canStartAnalysis}
                >
                  <Play className="h-4 w-4 mr-2" />
                  开始分析
                </Button>
                
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCrawlAllYResults}
                  disabled={!canCrawlAll}
                >
                  <PlayCircle className="h-4 w-4 mr-2" />
                  一键爬取信息
                </Button>
              </>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyData}
              disabled={filteredAndSortedData.length === 0}
            >
              <Copy className="h-4 w-4 mr-2" />
              复制
            </Button>

            {/* 导出菜单 */}
            <div className="relative group">
              <Button
                variant="outline"
                size="sm"
                disabled={filteredAndSortedData.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                导出
                <ChevronDown className="h-4 w-4 ml-1" />
              </Button>
              
              <div className="absolute right-0 mt-1 w-32 bg-white border rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                <button
                  type="button"
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                  onClick={() => handleExport('excel')}
                >
                  Excel (.xlsx)
                </button>
                <button
                  type="button"
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                  onClick={() => handleExport('csv')}
                >
                  CSV (.csv)
                </button>
                <button
                  type="button"
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                  onClick={() => handleExport('json')}
                >
                  JSON (.json)
                </button>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteSelected}
              disabled={selectedIds.length === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              删除选中
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              disabled={analysisData.length === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              清空
            </Button>
          </div>
        </div>

        {/* 表格设置面板 */}
        {showTableSettings && (
          <div className="mt-4 p-4 border rounded-lg bg-gray-50">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm">每页显示：</span>
                <Select value={pageSize.toString()} onValueChange={(v) => setPageSize(Number(v))}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={paginatedData.length > 0 && selectedIds.length === paginatedData.length}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>网站链接</TableHead>
                <TableHead className="w-24">判断结果</TableHead>
                <TableHead>判断依据</TableHead>
                <TableHead>公司信息</TableHead>
                <TableHead>邮箱信息</TableHead>
                <TableHead className="w-32">状态</TableHead>
                <TableHead className="w-24">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    暂无数据
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(item.id)}
                        onCheckedChange={(checked) => handleSelectItem(item.id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell>
                      <a 
                        href={item.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline max-w-xs truncate block"
                        title={item.url}
                      >
                        {item.url}
                      </a>
                    </TableCell>
                    <TableCell>{getResultBadge(item.result)}</TableCell>
                    <TableCell>
                      {item.reason && (
                        <div className="max-w-xs">
                          <div 
                            className={`${expandedReasons.has(item.id) ? '' : 'line-clamp-2'} text-sm text-gray-600`}
                          >
                            {item.reason}
                          </div>
                          {item.reason.length > 100 && (
                            <button
                              type="button"
                              onClick={() => toggleReasonExpansion(item.id)}
                              className="text-xs text-blue-600 hover:underline mt-1"
                            >
                              {expandedReasons.has(item.id) ? '收起' : '展开'}
                            </button>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.companyInfo && (
                        <div className="text-sm">
                          <div className="font-medium">{formatCompanyInfo(item.companyInfo)}</div>
                          {item.companyInfo.founderNames?.length > 0 && (
                            <div className="text-gray-500 text-xs">
                              创始人: {item.companyInfo.founderNames.join(', ')}
                            </div>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.emails && item.emails.length > 0 && (
                        <div className="text-sm">
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            <span>{formatEmails(item.emails)}</span>
                          </div>
                          {item.emails.length > 1 && (
                            <button
                              type="button"
                              onClick={() => toggleEmailExpansion(item.id)}
                              className="text-xs text-blue-600 hover:underline mt-1"
                            >
                              {expandedEmails.has(item.id) ? '收起' : '查看详情'}
                            </button>
                          )}
                          {expandedEmails.has(item.id) && (
                            <div className="mt-2 space-y-1">
                              {item.emails.map((email, idx) => (
                                <div key={idx} className="text-xs text-gray-600">
                                  {email.email}
                                  {email.ownerName && ` (${email.ownerName})`}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(item.status)}
                        <span className="text-sm">{getStatusText(item.status)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.result === 'Y' && !item.hasInfoCrawled && item.status === 'completed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCrawlCompanyInfo(item.id, item.url)}
                          disabled={isAnalyzing}
                        >
                          <Mail className="h-3 w-3" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* 分页控制 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              显示 {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, filteredAndSortedData.length)} 条，
              共 {filteredAndSortedData.length} 条
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                上一页
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  )
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                下一页
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 
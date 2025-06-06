#!/usr/bin/env node

/**
 * 系统监控脚本
 * 用于监控Next.js应用的内存使用、性能状态等
 */

const fs = require('node:fs');
const path = require('node:path');

class SystemMonitor {
  constructor() {
    this.logFile = path.join(process.cwd(), 'monitoring.log');
    this.alertThresholds = {
      memoryUsage: 500 * 1024 * 1024, // 500MB
      heapUsage: 400 * 1024 * 1024,   // 400MB
    };
  }

  // 获取内存使用情况
  getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: usage.rss,                    // 驻留集大小
      heapUsed: usage.heapUsed,          // 已使用堆内存
      heapTotal: usage.heapTotal,        // 总堆内存
      external: usage.external,          // 外部内存
      arrayBuffers: usage.arrayBuffers   // ArrayBuffer内存
    };
  }

  // 格式化字节大小
  /**
   * @param {number} bytes 
   * @returns {string}
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Number.parseFloat((bytes / (k ** i)).toFixed(2)) + ' ' + sizes[i];
  }

  // 检查内存警告
  /**
   * @param {ReturnType<SystemMonitor['getMemoryUsage']>} usage 
   * @returns {string[]}
   */
  checkMemoryAlerts(usage) {
    const alerts = [];
    
    if (usage.rss > this.alertThresholds.memoryUsage) {
      alerts.push(`高内存使用警告: RSS ${this.formatBytes(usage.rss)}`);
    }
    
    if (usage.heapUsed > this.alertThresholds.heapUsage) {
      alerts.push(`高堆内存使用警告: Heap ${this.formatBytes(usage.heapUsed)}`);
    }
    
    return alerts;
  }

  // 记录监控信息
  /**
   * @param {string} message 
   */
  logInfo(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    
    console.log(logEntry.trim());
    
    // 写入日志文件
    try {
      fs.appendFileSync(this.logFile, logEntry);
    } catch (error) {
      console.error('写入日志失败:', error instanceof Error ? error.message : String(error));
    }
  }

  // 清理旧日志
  cleanOldLogs() {
    try {
      const stats = fs.statSync(this.logFile);
      const fileSizeMB = stats.size / (1024 * 1024);
      
      // 如果日志文件超过10MB，清理旧日志
      if (fileSizeMB > 10) {
        const lines = fs.readFileSync(this.logFile, 'utf8').split('\n');
        const recentLines = lines.slice(-1000); // 保留最近1000行
        fs.writeFileSync(this.logFile, recentLines.join('\n'));
        this.logInfo('日志文件已清理，保留最近1000行记录');
      }
    } catch (error) {
      // 文件不存在或其他错误，忽略
    }
  }

  // 执行监控检查
  performCheck() {
    const usage = this.getMemoryUsage();
    const alerts = this.checkMemoryAlerts(usage);
    
    // 基本信息
    const info = [
      `内存使用: RSS=${this.formatBytes(usage.rss)}`,
      `堆内存: ${this.formatBytes(usage.heapUsed)}/${this.formatBytes(usage.heapTotal)}`,
      `外部内存: ${this.formatBytes(usage.external)}`,
      `ArrayBuffers: ${this.formatBytes(usage.arrayBuffers)}`
    ].join(' | ');
    
    this.logInfo(`系统状态: ${info}`);
    
    // 输出警告
    alerts.forEach(alert => {
      this.logInfo(`⚠️ ${alert}`);
    });
    
    // 内存使用建议
    if (alerts.length === 0) {
      this.logInfo('✅ 内存使用正常');
    } else {
      this.logInfo('💡 建议: 考虑重启应用或优化内存使用');
    }
    
    // 清理旧日志
    this.cleanOldLogs();
  }

  // 启动定期监控
  startMonitoring(intervalMinutes = 10) {
    this.logInfo(`🚀 开始系统监控，检查间隔: ${intervalMinutes} 分钟`);
    this.performCheck(); // 立即检查一次
    
    const interval = setInterval(() => {
      this.performCheck();
    }, intervalMinutes * 60 * 1000);
    
    // 优雅退出处理
    process.on('SIGINT', () => {
      this.logInfo('📝 收到退出信号，停止监控');
      clearInterval(interval);
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      this.logInfo('📝 收到终止信号，停止监控');
      clearInterval(interval);
      process.exit(0);
    });
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const monitor = new SystemMonitor();
  
  // 解析命令行参数
  const args = process.argv.slice(2);
  const intervalArg = args.find(arg => arg.startsWith('--interval='));
  const interval = intervalArg ? Number.parseInt(intervalArg.split('=')[1] || '10', 10) : 10;
  
  if (args.includes('--once')) {
    // 只执行一次检查
    monitor.performCheck();
  } else {
    // 启动持续监控
    monitor.startMonitoring(interval);
  }
}

module.exports = SystemMonitor; 
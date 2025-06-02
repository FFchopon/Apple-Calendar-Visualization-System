class StatisticsManager {
    constructor() {
        this.batchData = new Map(); // 存储多个文件的数据
        this.charts = {}; // 存储图表实例
        this.selectedWeekdays = [0, 1, 2, 3, 4, 5, 6]; // 默认选择所有星期
        this.initializeStatistics();
    }

    initializeStatistics() {
        this.setupBatchUpload();
        this.setupStatisticsControls();
        this.setupWeekdayFilter();
        this.initializeCharts();
        this.setupChartModal();
    }

    setupBatchUpload() {
        const batchUploadArea = document.getElementById('batchUploadArea');
        const batchFileInput = document.getElementById('batchFileInput');
        const fileList = document.getElementById('fileList');

        // 点击上传区域触发文件选择
        batchUploadArea.addEventListener('click', () => {
            batchFileInput.click();
        });

        // 文件选择处理
        batchFileInput.addEventListener('change', (e) => {
            this.handleBatchFiles(e.target.files);
        });

        // 拖拽上传
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            batchUploadArea.addEventListener(eventName, this.preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            batchUploadArea.addEventListener(eventName, () => {
                batchUploadArea.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            batchUploadArea.addEventListener(eventName, () => {
                batchUploadArea.classList.remove('dragover');
            }, false);
        });

        batchUploadArea.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            this.handleBatchFiles(files);
        }, false);
    }

    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    async handleBatchFiles(files) {
        const fileList = document.getElementById('fileList');
        
        for (let file of files) {
            if (!file.name.endsWith('.ics')) {
                this.showFileStatus(file.name, 'error', '不支持的文件格式');
                continue;
            }

            try {
                this.showFileStatus(file.name, 'loading', '处理中...');
                
                const content = await file.text();
                const data = this.parseICSFile(content);
                
                this.batchData.set(file.name, {
                    fileName: file.name,
                    data: data,
                    uploadTime: new Date()
                });

                this.showFileStatus(file.name, 'success', '处理完成');
                
            } catch (error) {
                console.error(`处理文件 ${file.name} 失败:`, error);
                this.showFileStatus(file.name, 'error', `处理失败: ${error.message}`);
            }
        }

        // 更新统计
        this.updateBatchStatistics();
        this.updateCharts();

        if (window.showNotification) {
            window.showNotification(`✅ 成功处理 ${this.batchData.size} 个文件！`, 'success');
        }
    }

    showFileStatus(fileName, status, message) {
        const fileList = document.getElementById('fileList');
        let fileItem = document.querySelector(`[data-filename="${fileName}"]`);
        
        if (!fileItem) {
            fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.setAttribute('data-filename', fileName);
            fileItem.innerHTML = `
                <div class="file-name">${fileName}</div>
                <div class="file-status">${message}</div>
                <button class="remove-file" onclick="statisticsManager.removeFile('${fileName}')">
                    <i class="fas fa-times"></i>
                </button>
            `;
            fileList.appendChild(fileItem);
        }

        fileItem.className = `file-item ${status}`;
        fileItem.querySelector('.file-status').textContent = message;
    }

    removeFile(fileName) {
        this.batchData.delete(fileName);
        const fileItem = document.querySelector(`[data-filename="${fileName}"]`);
        if (fileItem) {
            fileItem.remove();
        }
        this.updateBatchStatistics();
        this.updateCharts();
    }

    parseICSFile(icsContent) {
        const jcalData = ICAL.parse(icsContent);
        const comp = new ICAL.Component(jcalData);
        const events = comp.getAllSubcomponents('vevent');
        
        const calendarData = {};

        events.forEach(event => {
            const icalEvent = new ICAL.Event(event);
            const summary = icalEvent.summary || "未命名活动";
            const startDate = icalEvent.startDate.toJSDate();
            const endDate = icalEvent.endDate.toJSDate();
            const description = icalEvent.description || "";
            const location = icalEvent.location || "";
            
            const duration = (endDate - startDate) / (1000 * 60);
            
            const year = startDate.getFullYear();
            const month = (startDate.getMonth() + 1).toString().padStart(2, '0');
            const day = startDate.getDate().toString().padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            
            if (!calendarData[dateStr]) {
                calendarData[dateStr] = {
                    events: [],
                    totalDuration: 0
                };
            }
            
            calendarData[dateStr].events.push({
                duration: duration,
                summary: summary,
                description: description,
                location: location,
                startTime: startDate,
                endTime: endDate
            });
            
            calendarData[dateStr].totalDuration += duration;
        });

        return calendarData;
    }

    setupStatisticsControls() {
        const updateStatsBtn = document.getElementById('updateStats');
        updateStatsBtn.addEventListener('click', () => {
            this.updateBatchStatistics();
            this.updateCharts();
        });
    }

    setupWeekdayFilter() {
        // 在统计维度选择器后添加星期筛选器
        const timeRangeSelector = document.querySelector('#statistics-page .time-range-selector .time-range-controls');
        
        // 创建星期筛选器HTML
        const weekdayFilterHTML = `
            <div class="time-range-group weekday-filter-group">
                <label class="time-range-label">📅 星期筛选:</label>
                <div class="weekday-buttons">
                    <button class="weekday-btn active" data-weekday="1">周一</button>
                    <button class="weekday-btn active" data-weekday="2">周二</button>
                    <button class="weekday-btn active" data-weekday="3">周三</button>
                    <button class="weekday-btn active" data-weekday="4">周四</button>
                    <button class="weekday-btn active" data-weekday="5">周五</button>
                    <button class="weekday-btn active" data-weekday="6">周六</button>
                    <button class="weekday-btn active" data-weekday="0">周日</button>
                </div>
                <button class="weekday-toggle-btn" id="toggleWeekend">仅周末</button>
                <button class="weekday-toggle-btn" id="toggleWeekdays">仅工作日</button>
                <button class="weekday-toggle-btn" id="toggleAll">全选</button>
            </div>
        `;
        
        timeRangeSelector.insertAdjacentHTML('beforeend', weekdayFilterHTML);
        
        // 添加事件监听器
        this.setupWeekdayEvents();
    }

    setupWeekdayEvents() {
        // 星期按钮点击事件
        document.querySelectorAll('.weekday-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const weekday = parseInt(btn.dataset.weekday);
                
                if (btn.classList.contains('active')) {
                    btn.classList.remove('active');
                    this.selectedWeekdays = this.selectedWeekdays.filter(w => w !== weekday);
                } else {
                    btn.classList.add('active');
                    this.selectedWeekdays.push(weekday);
                }
                
                this.updateBatchStatistics();
                this.updateCharts();
            });
        });
        
        // 快捷选择按钮
        document.getElementById('toggleWeekend').addEventListener('click', (e) => {
            e.preventDefault();
            this.selectWeekdays([0, 6]); // 周六周日
        });
        
        document.getElementById('toggleWeekdays').addEventListener('click', (e) => {
            e.preventDefault();
            this.selectWeekdays([1, 2, 3, 4, 5]); // 周一到周五
        });
        
        document.getElementById('toggleAll').addEventListener('click', (e) => {
            e.preventDefault();
            this.selectWeekdays([0, 1, 2, 3, 4, 5, 6]); // 全部
        });
    }

    selectWeekdays(weekdays) {
        this.selectedWeekdays = [...weekdays];
        
        // 更新按钮状态
        document.querySelectorAll('.weekday-btn').forEach(btn => {
            const weekday = parseInt(btn.dataset.weekday);
            if (weekdays.includes(weekday)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        this.updateBatchStatistics();
        this.updateCharts();
    }

    // 检查日期是否在选中的星期范围内
    isDateInSelectedWeekdays(date) {
        return this.selectedWeekdays.includes(date.getDay());
    }

    updateBatchStatistics() {
        const batchStatsContainer = document.getElementById('batchStats');
        
        if (this.batchData.size === 0) {
            batchStatsContainer.innerHTML = `
                <div class="stat-card">
                    <div class="stat-title">
                        <i class="fas fa-info-circle stat-icon"></i>
                        提示
                    </div>
                    <div class="stat-value" style="font-size: 1rem;">请上传 ICS 文件开始分析</div>
                </div>
            `;
            return;
        }

        const stats = this.calculateBatchStatistics();
        
        batchStatsContainer.innerHTML = `
            <div class="stat-card">
                <div class="stat-title">
                    <i class="fas fa-file-alt stat-icon"></i>
                    文件数量
                </div>
                <div class="stat-value">${stats.fileCount}</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">
                    <i class="fas fa-calendar-day stat-icon"></i>
                    总活动天数
                </div>
                <div class="stat-value">${stats.totalDays}</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">
                    <i class="fas fa-tasks stat-icon"></i>
                    总事件数量
                </div>
                <div class="stat-value">${stats.totalEvents}</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">
                    <i class="fas fa-clock stat-icon"></i>
                    总活动时长
                </div>
                <div class="stat-value">${this.formatDuration(stats.totalDuration)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">
                    <i class="fas fa-chart-line stat-icon"></i>
                    平均每日时长
                </div>
                <div class="stat-value">${this.formatDuration(stats.avgDailyDuration)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">
                    <i class="fas fa-fire stat-icon"></i>
                    最长单日时长
                </div>
                <div class="stat-value">${this.formatDuration(stats.maxDailyDuration)}</div>
            </div>
        `;
    }

    calculateBatchStatistics() {
        if (this.batchData.size === 0) return {};

        let totalDuration = 0;
        let totalEvents = 0;
        let totalDays = 0;
        let maxDailyDuration = 0;
        const allDates = new Set();

        this.batchData.forEach((fileData) => {
            Object.entries(fileData.data).forEach(([dateStr, dayData]) => {
                const date = new Date(dateStr);
                
                // 只统计选中星期的数据
                if (!this.isDateInSelectedWeekdays(date)) {
                    return;
                }
                
                allDates.add(dateStr);
                totalDuration += dayData.totalDuration;
                totalEvents += dayData.events.length;
                maxDailyDuration = Math.max(maxDailyDuration, dayData.totalDuration);
            });
        });

        // 计算总天数（包括没有事件的天数）
        if (allDates.size > 0) {
            const dates = Array.from(allDates).map(d => new Date(d)).sort((a, b) => a - b);
            const startDate = dates[0];
            const endDate = dates[dates.length - 1];
            
            // 计算日期范围内选中星期的总天数
            let currentDate = new Date(startDate);
            let daysInRange = 0;
            
            while (currentDate <= endDate) {
                if (this.isDateInSelectedWeekdays(currentDate)) {
                    daysInRange++;
                }
                currentDate.setDate(currentDate.getDate() + 1);
            }
            
            totalDays = daysInRange;
        }

        const avgDailyDuration = totalDays > 0 ? totalDuration / totalDays : 0;

        return {
            fileCount: this.batchData.size,
            totalDuration,
            totalEvents,
            totalDays,
            avgDailyDuration,
            maxDailyDuration
        };
    }

    formatDuration(minutes) {
        if (minutes < 60) {
            return `${Math.round(minutes)}分钟`;
        } else {
            const hours = Math.floor(minutes / 60);
            const remainingMinutes = Math.round(minutes % 60);
            if (remainingMinutes === 0) {
                return `${hours}小时`;
            } else {
                return `${hours}小时${remainingMinutes}分钟`;
            }
        }
    }

    // 新增：专门用于图表显示的时长格式化方法
    formatDurationForChart(minutes) {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = Math.round(minutes % 60);
        
        if (hours === 0) {
            return `${remainingMinutes}分钟`;
        } else if (remainingMinutes === 0) {
            return `${hours}小时`;
        } else {
            return `${hours}小时${remainingMinutes}分钟`;
        }
    }

    // 新增：专门用于纵轴显示的格式化方法（仅显示小时，四舍五入）
    formatDurationForAxis(minutes) {
        const hours = Math.round(minutes / 60);
        return `${hours}小时`;
    }

    initializeCharts() {
        // 初始化空图表
        this.createTrendChart();
        this.createDistributionChart();
        this.createHourlyChart();
    }

    createTrendChart() {
        const ctx = document.getElementById('trendChart').getContext('2d');
        this.charts.trend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: '活动时长',
                    data: [],
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return `活动时长: ${this.formatDurationForChart(context.parsed.y)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => {
                                return this.formatDurationForAxis(value);
                            }
                        }
                    }
                }
            }
        });
    }

    createDistributionChart() {
        const ctx = document.getElementById('distributionChart').getContext('2d');
        this.charts.distribution = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [
                        '#667eea', '#f093fb', '#4ade80', '#fbbf24', 
                        '#f87171', '#8b5cf6', '#06b6d4', '#84cc16'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const label = context.label || '';
                                const value = context.parsed;
                                return `${label}: ${this.formatDurationForChart(value)}`;
                            }
                        }
                    }
                }
            }
        });
    }

    createHourlyChart() {
        const ctx = document.getElementById('hourlyChart').getContext('2d');
        this.charts.hourly = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Array.from({length: 24}, (_, i) => `${i}:00`),
                datasets: [{
                    label: '活动时长',
                    data: new Array(24).fill(0),
                    backgroundColor: 'rgba(102, 126, 234, 0.8)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return `${context.label}: ${this.formatDurationForChart(context.parsed.y)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => {
                                return this.formatDurationForAxis(value);
                            }
                        }
                    }
                }
            }
        });
    }

    updateCharts() {
        if (this.batchData.size === 0) return;

        const dimension = document.getElementById('statsDimension').value;
        const startDate = new Date(document.getElementById('statsStartDate').value);
        const endDate = new Date(document.getElementById('statsEndDate').value);

        this.updateTrendChart(dimension, startDate, endDate);
        this.updateDistributionChart(startDate, endDate);
        this.updateHourlyChart(startDate, endDate);
    }

    updateTrendChart(dimension, startDate, endDate) {
        const trendData = this.calculateTrendData(dimension, startDate, endDate);
        
        this.charts.trend.data.labels = trendData.labels;
        this.charts.trend.data.datasets[0].data = trendData.data;
        this.charts.trend.update();
    }

    calculateTrendData(dimension, startDate, endDate) {
        const data = new Map();
        
        this.batchData.forEach((fileData) => {
            Object.entries(fileData.data).forEach(([dateStr, dayData]) => {
                const date = new Date(dateStr);
                
                // 检查日期范围和星期筛选
                if (date >= startDate && date <= endDate && this.isDateInSelectedWeekdays(date)) {
                    let key;
                    switch (dimension) {
                        case 'day':
                            key = dateStr;
                            break;
                        case 'week':
                            const weekStart = new Date(date);
                            weekStart.setDate(date.getDate() - date.getDay());
                            key = weekStart.toISOString().split('T')[0];
                            break;
                        case 'month':
                            key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
                            break;
                        case 'year':
                            key = date.getFullYear().toString();
                            break;
                    }
                    
                    if (!data.has(key)) {
                        data.set(key, 0);
                    }
                    data.set(key, data.get(key) + dayData.totalDuration);
                }
            });
        });

        const sortedEntries = Array.from(data.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        
        return {
            labels: sortedEntries.map(([key]) => this.formatTrendLabel(key, dimension)),
            data: sortedEntries.map(([, value]) => Math.round(value))
        };
    }

    formatTrendLabel(key, dimension) {
        switch (dimension) {
            case 'day':
                return new Date(key).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
            case 'week':
                return `${new Date(key).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}周`;
            case 'month':
                const [year, month] = key.split('-');
                return `${year}年${parseInt(month)}月`;
            case 'year':
                return `${key}年`;
            default:
                return key;
        }
    }

    updateDistributionChart(startDate, endDate) {
        const distribution = new Map();
        
        this.batchData.forEach((fileData, fileName) => {
            // 从文件名中提取类别名称（去掉.ics后缀）
            const category = fileName.replace('.ics', '');
            let categoryDuration = 0;
            
            Object.entries(fileData.data).forEach(([dateStr, dayData]) => {
                const date = new Date(dateStr);
                
                // 检查日期范围和星期筛选
                if (date >= startDate && date <= endDate && this.isDateInSelectedWeekdays(date)) {
                    categoryDuration += dayData.totalDuration;
                }
            });
            
            if (categoryDuration > 0) {
                distribution.set(category, categoryDuration);
            }
        });

        // 按时长排序
        const sortedDistribution = Array.from(distribution.entries())
            .sort((a, b) => b[1] - a[1]);

        this.charts.distribution.data.labels = sortedDistribution.map(([category]) => category);
        this.charts.distribution.data.datasets[0].data = sortedDistribution.map(([, duration]) => Math.round(duration));
        this.charts.distribution.update();
    }

    updateHourlyChart(startDate, endDate) {
        const hourlyData = new Array(24).fill(0);
        
        this.batchData.forEach((fileData) => {
            Object.entries(fileData.data).forEach(([dateStr, dayData]) => {
                const date = new Date(dateStr);
                
                // 检查日期范围和星期筛选
                if (date >= startDate && date <= endDate && this.isDateInSelectedWeekdays(date)) {
                    dayData.events.forEach(event => {
                        const hour = event.startTime.getHours();
                        hourlyData[hour] += event.duration;
                    });
                }
            });
        });

        this.charts.hourly.data.datasets[0].data = hourlyData.map(duration => Math.round(duration));
        this.charts.hourly.update();
    }

    setupChartModal() {
        const chartModal = document.getElementById('chartModal');
        const closeBtn = document.querySelector('.chart-modal-close');
        
        // 关闭按钮事件
        closeBtn.addEventListener('click', () => {
            this.closeChartModal();
        });
        
        // 点击模态框外部关闭
        chartModal.addEventListener('click', (e) => {
            if (e.target === chartModal) {
                this.closeChartModal();
            }
        });
        
        // ESC键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && chartModal.style.display === 'block') {
                this.closeChartModal();
            }
        });
    }

    enlargeChart(chartType) {
        const chartModal = document.getElementById('chartModal');
        const chartModalTitle = document.getElementById('chartModalTitle');
        const enlargedChart = document.getElementById('enlargedChart');
        
        // 检查是否有数据
        const originalChart = this.charts[chartType];
        if (!originalChart || !originalChart.data || !originalChart.data.labels || originalChart.data.labels.length === 0) {
            if (window.showNotification) {
                window.showNotification('⚠️ 暂无数据可显示，请先上传 ICS 文件', 'error');
            }
            return;
        }
        
        // 设置标题
        const titles = {
            'trend': '时长趋势图',
            'distribution': '活动分布（按文件）',
            'hourly': '时段分析'
        };
        
        chartModalTitle.textContent = titles[chartType] || '图表详情';
        
        // 显示模态框
        chartModal.style.display = 'block';
        setTimeout(() => {
            chartModal.classList.add('show');
        }, 10);
        
        // 创建放大的图表
        this.createEnlargedChart(chartType, enlargedChart);
    }

    closeChartModal() {
        const chartModal = document.getElementById('chartModal');
        chartModal.classList.remove('show');
        setTimeout(() => {
            chartModal.style.display = 'none';
            // 销毁放大的图表实例
            if (this.enlargedChartInstance) {
                this.enlargedChartInstance.destroy();
                this.enlargedChartInstance = null;
            }
        }, 300);
    }

    createEnlargedChart(chartType, canvas) {
        // 销毁之前的图表实例
        if (this.enlargedChartInstance) {
            this.enlargedChartInstance.destroy();
        }
        
        const ctx = canvas.getContext('2d');
        const originalChart = this.charts[chartType];
        
        if (!originalChart) return;
        
        // 根据图表类型创建新的配置
        let config;
        
        if (chartType === 'trend') {
            config = {
                type: 'line',
                data: {
                    labels: [...originalChart.data.labels],
                    datasets: [{
                        label: '活动时长',
                        data: [...originalChart.data.datasets[0].data],
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        tension: 0.4,
                        fill: true,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top'
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: 'white',
                            bodyColor: 'white',
                            borderColor: '#667eea',
                            borderWidth: 1,
                            callbacks: {
                                label: (context) => {
                                    return `活动时长: ${this.formatDurationForChart(context.parsed.y)}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            display: true,
                            title: {
                                display: true,
                                text: '时间'
                            }
                        },
                        y: {
                            beginAtZero: true,
                            display: true,
                            title: {
                                display: true,
                                text: '时长'
                            },
                            ticks: {
                                callback: (value) => {
                                    return this.formatDurationForAxis(value);
                                }
                            }
                        }
                    },
                    interaction: {
                        mode: 'nearest',
                        axis: 'x',
                        intersect: false
                    }
                }
            };
        } else if (chartType === 'distribution') {
            config = {
                type: 'doughnut',
                data: {
                    labels: [...originalChart.data.labels],
                    datasets: [{
                        data: [...originalChart.data.datasets[0].data],
                        backgroundColor: [
                            '#667eea', '#f093fb', '#4ade80', '#fbbf24', 
                            '#f87171', '#8b5cf6', '#06b6d4', '#84cc16'
                        ],
                        borderWidth: 2,
                        borderColor: '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                usePointStyle: true,
                                padding: 20,
                                font: {
                                    size: 14
                                }
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: 'white',
                            bodyColor: 'white',
                            borderColor: '#667eea',
                            borderWidth: 1,
                            callbacks: {
                                label: (context) => {
                                    const label = context.label || '';
                                    const value = context.parsed;
                                    return `${label}: ${this.formatDurationForChart(value)}`;
                                }
                            }
                        }
                    }
                }
            };
        } else if (chartType === 'hourly') {
            config = {
                type: 'bar',
                data: {
                    labels: [...originalChart.data.labels],
                    datasets: [{
                        label: '活动时长',
                        data: [...originalChart.data.datasets[0].data],
                        backgroundColor: 'rgba(102, 126, 234, 0.8)',
                        borderColor: '#667eea',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top'
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: 'white',
                            bodyColor: 'white',
                            borderColor: '#667eea',
                            borderWidth: 1,
                            callbacks: {
                                label: (context) => {
                                    return `${context.label}: ${this.formatDurationForChart(context.parsed.y)}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            display: true,
                            title: {
                                display: true,
                                text: '时间段'
                            }
                        },
                        y: {
                            beginAtZero: true,
                            display: true,
                            title: {
                                display: true,
                                text: '时长'
                            },
                            ticks: {
                                callback: (value) => {
                                    return this.formatDurationForAxis(value);
                                }
                            }
                        }
                    }
                }
            };
        }
        
        // 创建新的图表实例
        this.enlargedChartInstance = new Chart(ctx, config);
    }
}

// 全局实例
let statisticsManager;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    statisticsManager = new StatisticsManager();
}); 
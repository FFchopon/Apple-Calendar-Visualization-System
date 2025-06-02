class CalendarHeatmap {
    constructor() {
        this.loadICAL();
        this.levelSchemes = {
            hourly: {
                thresholds: [60, 120, 180, 240, 300, 360], // 分钟数：1-6小时
                labels: ['≤1小时', '≤2小时', '≤3小时', '≤4小时', '≤5小时', '≤6小时', '>6小时']
            },
            halfHour: {
                thresholds: [30, 60, 90, 120, 150, 180], // 分钟数：0.5-3小时
                labels: ['≤30分钟', '≤1小时', '≤1.5小时', '≤2小时', '≤2.5小时', '≤3小时', '>3小时']
            }
        };
        this.currentLevelScheme = 'hourly';
        this.currentViewRange = 'year'; // 当前查看范围
        this.currentYear = new Date().getFullYear();
        this.currentMonth = new Date().getMonth();
        this.currentWeek = null;
        this.setupLevelSchemeSelector();
        this.updateLegend(); // 初始化图例
    }

    async loadICAL() {
        const CDN_URLS = [
            'https://cdn.jsdelivr.net/npm/ical.js@1.5.0/build/ical.min.js',
            'https://unpkg.com/ical.js@1.5.0/build/ical.min.js',
            'https://cdnjs.cloudflare.com/ajax/libs/ical.js/1.5.0/ical.min.js'
        ];

        for (const url of CDN_URLS) {
            try {
                await this.loadScript(url);
                console.log('ICAL 库加载成功');
                this.initializeCalendar();
                return;
            } catch (error) {
                console.warn(`从 ${url} 加载 ICAL 失败，尝试下一个源`);
            }
        }

        // 所有 CDN 都失败时显示错误
        this.container = document.getElementById('heatmap');
        this.container.innerHTML = `
            <div style="color: red; padding: 20px;">
                错误: ICAL 库加载失败<br>
                请检查网络连接或刷新页面重试
            </div>
        `;
    }

    loadScript(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    initializeCalendar() {
        // 检查 ICAL 是否已加载
        if (typeof ICAL === 'undefined') {
            console.error('ICAL 库未加载，请确保已引入 ical.js');
            this.container = document.getElementById('heatmap');
            this.container.innerHTML = `
                <div style="
                    color: var(--error-color); 
                    padding: 2rem; 
                    text-align: center;
                    background: rgba(255, 255, 255, 0.95);
                    border-radius: var(--radius-lg);
                    box-shadow: var(--shadow-md);
                ">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                    <div>错误: ICAL 库未加载</div>
                </div>
            `;
            return;
        }

        this.container = document.getElementById('heatmap');
        this.statsContainer = document.getElementById('stats');
        this.setupFileInput();
        
        // 直接初始化工具提示元素
        this.tooltip = document.getElementById('tooltip');
        if (!this.tooltip) {
            // 如果不存在则创建
            this.tooltip = document.createElement('div');
            this.tooltip.className = 'tooltip';
            this.tooltip.id = 'tooltip';
            document.body.appendChild(this.tooltip);
        }

        this.originalData = null; // 存储原始数据
        this.setupSearch(); // 添加搜索功能初始化
        this.setupTimeRangeControls(); // 添加时间范围控制
        this.showEventCount = true; // 默认显示事务数量
        this.setupOptions(); // 初始化选项

        // 初始化模态框
        this.monthModal = document.getElementById('monthModal');
        this.monthModalTitle = document.getElementById('monthModalTitle');
        this.monthModalCalendar = document.getElementById('monthModalCalendar');
        
        // 设置模态框关闭按钮
        const closeBtn = document.querySelector('.month-modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeMonthModal());
        }
        
        // 点击模态框外部关闭
        window.addEventListener('click', (event) => {
            if (event.target === this.monthModal) {
                this.closeMonthModal();
            }
        });

        // 初始化配色方案
        this.setupColorScheme();

        // 显示欢迎界面
        this.showWelcomeScreen();
    }

    setupTimeRangeControls() {
        const viewRange = document.getElementById('viewRange');
        const yearSelect = document.getElementById('yearSelect');
        const monthSelect = document.getElementById('monthSelect');
        const weekInput = document.getElementById('weekInput');
        const applyTimeRange = document.getElementById('applyTimeRange');

        // 监听查看范围变化
        viewRange.addEventListener('change', () => {
            this.currentViewRange = viewRange.value;
            this.updateTimeRangeVisibility();
        });

        // 监听时间选择变化
        yearSelect.addEventListener('change', () => {
            this.currentYear = parseInt(yearSelect.value);
        });

        monthSelect.addEventListener('change', () => {
            this.currentMonth = parseInt(monthSelect.value);
        });

        weekInput.addEventListener('change', () => {
            this.currentWeek = weekInput.value;
        });

        // 应用时间范围筛选
        applyTimeRange.addEventListener('click', () => {
            this.applyTimeRangeFilter();
        });

        // 设置默认周输入值
        const today = new Date();
        const year = today.getFullYear();
        const week = this.getWeekNumber(today);
        weekInput.value = `${year}-W${week.toString().padStart(2, '0')}`;
    }

    updateTimeRangeVisibility() {
        const monthSelector = document.getElementById('monthSelector');
        const weekSelector = document.getElementById('weekSelector');

        monthSelector.style.display = this.currentViewRange === 'month' ? 'flex' : 'none';
        weekSelector.style.display = this.currentViewRange === 'week' ? 'flex' : 'none';
    }

    getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }

    applyTimeRangeFilter() {
        if (!this.originalData) {
            if (window.showNotification) {
                window.showNotification('⚠️ 请先上传 ICS 文件', 'error');
            }
            return;
        }

        const filteredData = this.filterDataByTimeRange(this.originalData);
        this.renderStats(filteredData);
        this.render(filteredData);

        if (window.showNotification) {
            const eventCount = Object.values(filteredData).reduce((sum, dayData) => 
                sum + (dayData.events ? dayData.events.length : 0), 0);
            window.showNotification(`✅ 已筛选出 ${eventCount} 个事件`, 'success');
        }
    }

    filterDataByTimeRange(data) {
        const filteredData = {};

        Object.entries(data).forEach(([dateStr, dayData]) => {
            const date = new Date(dateStr);
            let includeDate = false;

            switch (this.currentViewRange) {
                case 'year':
                    includeDate = date.getFullYear() === this.currentYear;
                    break;
                case 'month':
                    includeDate = date.getFullYear() === this.currentYear && 
                                 date.getMonth() === this.currentMonth;
                    break;
                case 'week':
                    if (this.currentWeek) {
                        const [weekYear, weekNum] = this.currentWeek.split('-W');
                        const weekStart = this.getDateFromWeek(parseInt(weekYear), parseInt(weekNum));
                        const weekEnd = new Date(weekStart);
                        weekEnd.setDate(weekStart.getDate() + 6);
                        includeDate = date >= weekStart && date <= weekEnd;
                    }
                    break;
            }

            if (includeDate) {
                filteredData[dateStr] = dayData;
            }
        });

        return filteredData;
    }

    getDateFromWeek(year, week) {
        const simple = new Date(year, 0, 1 + (week - 1) * 7);
        const dow = simple.getDay();
        const ISOweekStart = simple;
        if (dow <= 4) {
            ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
        } else {
            ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
        }
        return ISOweekStart;
    }

    showWelcomeScreen() {
        this.container.innerHTML = `
            <div style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 4rem 2rem;
                background: rgba(255, 255, 255, 0.95);
                border-radius: var(--radius-lg);
                box-shadow: var(--shadow-md);
                text-align: center;
                min-height: 400px;
            ">
                <div style="font-size: 4rem; margin-bottom: 1.5rem;">📅</div>
                <h2 style="
                    color: var(--text-primary); 
                    font-size: 1.5rem; 
                    font-weight: 600; 
                    margin-bottom: 1rem;
                    margin-top: 0;
                ">
                    欢迎使用 Life 打卡日历
                </h2>
                <p style="
                    color: var(--text-secondary); 
                    font-size: 1rem; 
                    margin-bottom: 2rem;
                    max-width: 500px;
                    line-height: 1.6;
                ">
                    上传您的 ICS 日历文件，查看精美的活动热力图，追踪您的生活轨迹和时间分配。
                </p>
                <div style="
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    color: var(--text-muted);
                    font-size: 0.875rem;
                ">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fas fa-upload" style="color: var(--primary-color);"></i>
                        支持拖拽上传 ICS 文件
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fas fa-search" style="color: var(--primary-color);"></i>
                        智能搜索和筛选功能
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fas fa-palette" style="color: var(--primary-color);"></i>
                        多种配色方案可选
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fas fa-chart-bar" style="color: var(--primary-color);"></i>
                        详细的统计数据分析
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fas fa-filter" style="color: var(--primary-color);"></i>
                        按年、月、周筛选查看
                    </div>
                </div>
            </div>
        `;

        this.statsContainer.innerHTML = `
            <div class="stat-card">
                <div class="stat-title">
                    <i class="fas fa-calendar-day stat-icon"></i>
                    总活动天数
                </div>
                <div class="stat-value">-</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">
                    <i class="fas fa-tasks stat-icon"></i>
                    总事件数量
                </div>
                <div class="stat-value">-</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">
                    <i class="fas fa-clock stat-icon"></i>
                    总活动时长
                </div>
                <div class="stat-value">-</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">
                    <i class="fas fa-chart-line stat-icon"></i>
                    平均每日时长
                </div>
                <div class="stat-value">-</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">
                    <i class="fas fa-fire stat-icon"></i>
                    最长单日时长
                </div>
                <div class="stat-value">-</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">
                    <i class="fas fa-percentage stat-icon"></i>
                    活跃天数比例
                </div>
                <div class="stat-value">-</div>
            </div>
        `;
    }

    setupFileInput() {
        const fileInput = document.getElementById('icsFileInput');
        if (!fileInput) {
            console.error('找不到文件输入元素');
            return;
        }
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    }

    async handleFileSelect(event) {
        try {
            const file = event.target.files[0];
            if (!file) return;

            // 显示加载状态
            this.showLoadingState();

            const content = await file.text();
            const data = this.parseICSFile(content);
            
            // 保存原始数据
            this.originalData = data;
            this.calendarData = data;  // 同时保存当前数据
            
            // 应用当前的时间范围筛选
            const filteredData = this.filterDataByTimeRange(data);
            
            this.renderStats(filteredData);
            this.render(filteredData);

            // 显示成功通知
            if (window.showNotification) {
                const eventCount = Object.values(data).reduce((sum, dayData) => 
                    sum + (dayData.events ? dayData.events.length : 0), 0);
                window.showNotification(`✅ 成功加载 ${eventCount} 个事件！`, 'success');
            }

            // 隐藏加载状态
            this.hideLoadingState();

        } catch (error) {
            console.error('处理文件失败:', error);
            
            // 显示错误通知
            if (window.showNotification) {
                window.showNotification(`❌ 文件处理失败: ${error.message}`, 'error');
            }
            
            this.container.innerHTML = `
                <div style="
                    color: var(--error-color); 
                    padding: 2rem; 
                    text-align: center;
                    background: rgba(255, 255, 255, 0.95);
                    border-radius: var(--radius-lg);
                    box-shadow: var(--shadow-md);
                ">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                    <div>处理文件失败: ${error.message}</div>
                    <div style="margin-top: 0.5rem; font-size: 0.875rem; color: var(--text-muted);">
                        请确保上传的是有效的 ICS 格式文件
                    </div>
                </div>
            `;
            
            // 隐藏加载状态
            this.hideLoadingState();
        }
    }

    showLoadingState() {
        this.container.innerHTML = `
            <div style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 4rem 2rem;
                background: rgba(255, 255, 255, 0.95);
                border-radius: var(--radius-lg);
                box-shadow: var(--shadow-md);
                text-align: center;
            ">
                <div class="loading" style="margin-bottom: 1rem;"></div>
                <div style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">
                    正在处理文件...
                </div>
                <div style="color: var(--text-muted); font-size: 0.875rem;">
                    请稍候，正在解析您的日历数据
                </div>
            </div>
        `;
        
        this.statsContainer.innerHTML = `
            <div class="stat-card">
                <div class="stat-title">
                    <div class="loading" style="width: 16px; height: 16px;"></div>
                    加载中...
                </div>
                <div class="stat-value">-</div>
            </div>
        `;
    }

    hideLoadingState() {
        // 加载状态会在render函数中被替换，这里不需要特别处理
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
            
            // 计算活动持续时间（分钟）
            const duration = (endDate - startDate) / (1000 * 60);
            
            // 格式化日期为YYYY-MM-DD
            // 手动格式化日期以避免时区问题
            const year = startDate.getFullYear();
            const month = (startDate.getMonth() + 1).toString().padStart(2, '0');
            const day = startDate.getDate().toString().padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            
            // 为每个日期创建事件数组
            if (!calendarData[dateStr]) {
                calendarData[dateStr] = {
                    events: [],
                    totalDuration: 0, // 记录当天总时长
                    maxDuration: 0    // 保留最大时长（兼容旧代码）
                };
            }
            
            // 添加新事件
            calendarData[dateStr].events.push({
                duration: duration,
                summary: summary,
                description: description,
                location: location,
                startTime: startDate,
                endTime: endDate
            });
            
            // 更新总时长
            calendarData[dateStr].totalDuration += duration;
            
            // 更新最大持续时间（保留兼容性）
            calendarData[dateStr].maxDuration = Math.max(calendarData[dateStr].maxDuration, duration);
        });

        return calendarData;
    }

    // 根据活动时长确定颜色等级
    getColorLevel(data) {
        const totalDuration = data.totalDuration || 0;
        const thresholds = this.levelSchemes[this.currentLevelScheme].thresholds;
        
        if (totalDuration === 0) return 0;
        
        for (let i = 0; i < thresholds.length; i++) {
            if (totalDuration <= thresholds[i]) {
                return i + 1;
            }
        }
        return thresholds.length + 1;
    }

    // 计算统计数据 - 完全重写以修复计算问题
    calculateStats(data) {
        // 根据当前查看范围确定年份范围
        let targetYear = this.currentYear;
        if (this.currentViewRange === 'year') {
            // 整年查看时使用选定的年份
        } else if (this.currentViewRange === 'month') {
            // 单月查看时使用选定的年份
        } else if (this.currentViewRange === 'week') {
            // 单周查看时从周输入中获取年份
            if (this.currentWeek) {
                const [weekYear] = this.currentWeek.split('-W');
                targetYear = parseInt(weekYear);
            }
        }
        
        // 有效日期筛选
        const validDates = Object.keys(data).filter(dateStr => {
            const dayData = data[dateStr];
            const date = new Date(dateStr);
            return dayData && 
                   dayData.events && 
                   dayData.events.length > 0 && 
                   date.getFullYear() === targetYear;
        });
        
        const totalDays = validDates.length;
        let totalEvents = 0;
        let totalDuration = 0;
        let maxDailyDuration = 0;
        
        // 按月统计
        const monthlyStats = Array(12).fill(0);
        
        // 计算各项统计数据
        for (const dateStr of validDates) {
            const date = new Date(dateStr);
            if (date.getFullYear() === targetYear) {
                monthlyStats[date.getMonth()]++;
                
                const dayData = data[dateStr];
                if (dayData.events) {
                    // 累加事件数量
                    totalEvents += dayData.events.length;
                    
                    // 计算当天总时长
                    const dayTotalDuration = dayData.totalDuration || 
                                           dayData.events.reduce((sum, event) => sum + (event.duration || 0), 0);
                    totalDuration += dayTotalDuration;
                    
                    // 更新最长单日时长
                    maxDailyDuration = Math.max(maxDailyDuration, dayTotalDuration);
                }
            }
        }
        
        // 计算连续打卡记录
        let maxStreak = 0;
        
        if (validDates.length > 0) {
            const sortedDates = validDates.sort();
            const dateObjects = sortedDates.map(d => new Date(d));
            
            let currentStreak = 1;
            
            for (let i = 1; i < dateObjects.length; i++) {
                const prevDate = dateObjects[i-1];
                const currDate = dateObjects[i];
                
                const dayDiff = Math.round((currDate - prevDate) / (1000 * 60 * 60 * 24));
                
                if (dayDiff === 1) {
                    currentStreak++;
                } else {
                    maxStreak = Math.max(maxStreak, currentStreak);
                    currentStreak = 1;
                }
            }
            
            maxStreak = Math.max(maxStreak, currentStreak);
        }
        
        // 计算平均每日时长（根据查看范围调整基数）
        let totalPossibleDays = 365;
        if (this.currentViewRange === 'month') {
            const daysInMonth = new Date(targetYear, this.currentMonth + 1, 0).getDate();
            totalPossibleDays = daysInMonth;
        } else if (this.currentViewRange === 'week') {
            totalPossibleDays = 7;
        }
        
        // 使用总天数而不是有事件的天数计算平均值
        const avgDailyDuration = totalPossibleDays > 0 ? totalDuration / totalPossibleDays : 0;
        
        // 计算活跃天数比例（根据查看范围调整基数）
        const activeDaysPercentage = ((totalDays / totalPossibleDays) * 100).toFixed(1);
        
        return {
            totalDays,
            totalEvents,
            totalDuration,
            avgDailyDuration,
            maxDailyDuration,
            maxStreak,
            activeDaysPercentage,
            monthlyStats
        };
    }

    // 渲染统计数据
    renderStats(data) {
        const stats = this.calculateStats(data);
        
        // 根据查看范围调整标题
        let rangeText = '';
        switch (this.currentViewRange) {
            case 'year':
                rangeText = `${this.currentYear}年`;
                break;
            case 'month':
                rangeText = `${this.currentYear}年${this.currentMonth + 1}月`;
                break;
            case 'week':
                if (this.currentWeek) {
                    const [year, week] = this.currentWeek.split('-W');
                    rangeText = `${year}年第${week}周`;
                }
                break;
        }
        
        this.statsContainer.innerHTML = `
            <div class="stat-card">
                <div class="stat-title">
                    <i class="fas fa-calendar-day stat-icon"></i>
                    ${rangeText} 活动天数
                </div>
                <div class="stat-value">${stats.totalDays}</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">
                    <i class="fas fa-tasks stat-icon"></i>
                    ${rangeText} 事件数量
                </div>
                <div class="stat-value">${stats.totalEvents}</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">
                    <i class="fas fa-clock stat-icon"></i>
                    ${rangeText} 活动时长
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
            <div class="stat-card">
                <div class="stat-title">
                    <i class="fas fa-percentage stat-icon"></i>
                    活跃天数比例
                </div>
                <div class="stat-value">${stats.activeDaysPercentage}%</div>
            </div>
        `;
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

    // 渲染热力图
    render(data) {
        // 缓存当前数据
        this.calendarData = data;
        
        this.container.innerHTML = '';
        
        // 根据查看范围决定渲染内容
        if (this.currentViewRange === 'week') {
            this.renderWeekView(data);
        } else if (this.currentViewRange === 'month') {
            this.renderMonthView(data);
        } else {
            this.renderYearView(data);
        }
    }

    renderYearView(data) {
        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

        // 创建12个月的容器
        for (let month = 0; month < 12; month++) {
            const monthContainer = document.createElement('div');
            monthContainer.className = 'month-container';

            // 添加点击提示指示器
            const clickHint = document.createElement('div');
            clickHint.className = 'click-hint';
            monthContainer.appendChild(clickHint);
            
            // 添加提示文本
            const tooltip = document.createElement('div');
            tooltip.className = 'month-tooltip';
            tooltip.textContent = '点击空白处查看详细日历';
            monthContainer.appendChild(tooltip);

            // 添加月份标题
            const monthTitle = document.createElement('div');
            monthTitle.className = 'month-title';
            monthTitle.textContent = `${month + 1}月`;
            monthContainer.appendChild(monthTitle);
            
            // 添加星期标签
            const weekdayLabels = document.createElement('div');
            weekdayLabels.className = 'weekday-labels';
            
            for (let i = 0; i < 7; i++) {
                const label = document.createElement('div');
                label.className = 'weekday-label';
                label.textContent = weekdays[i];
                weekdayLabels.appendChild(label);
            }
            
            monthContainer.appendChild(weekdayLabels);

            // 创建月份网格
            const monthGrid = document.createElement('div');
            monthGrid.className = 'month-grid';

            // 获取当月第一天 - 确保是当前年份的月份
            const firstDay = new Date(this.currentYear, month, 1);
            
            // 获取当月天数
            const daysInMonth = new Date(this.currentYear, month + 1, 0).getDate();
            
            // 获取当月第一天是星期几 (0-6, 0表示星期日)
            const firstDayWeek = firstDay.getDay();

            // 添加空白天数
            for (let i = 0; i < firstDayWeek; i++) {
                const emptyDay = document.createElement('div');
                emptyDay.className = 'empty-day';
                monthGrid.appendChild(emptyDay);
            }

            // 添加当月所有天数
            for (let day = 1; day <= daysInMonth; day++) {
                // 使用更准确的日期创建方式
                const date = new Date(this.currentYear, month, day);
                
                // 确保使用正确的日期格式 YYYY-MM-DD
                const year = date.getFullYear();
                const monthStr = (date.getMonth() + 1).toString().padStart(2, '0');
                const dayStr = date.getDate().toString().padStart(2, '0');
                const dateStr = `${year}-${monthStr}-${dayStr}`;
                
                const dayData = data[dateStr];

                const dayElement = document.createElement('div');
                dayElement.className = 'day';
                dayElement.setAttribute('data-date', dateStr);

                if (dayData && dayData.events && dayData.events.length > 0) {
                    const level = this.getColorLevel(dayData);
                    dayElement.setAttribute('data-level', level);
                    
                    // 根据设置显示或隐藏事件数量
                    if (this.showEventCount && dayData.events.length > 1) {
                        dayElement.setAttribute('data-events-count', dayData.events.length);
                    }
                    
                    const tooltipText = this.formatEventDetails(dayData);
                    
                    // 使用事件委托来处理鼠标事件
                    dayElement.addEventListener('mouseenter', (e) => {
                        this.showTooltip(e.target, tooltipText);
                    });
                    
                    dayElement.addEventListener('mouseleave', () => {
                        this.hideTooltip();
                    });
                    
                    dayElement.addEventListener('mousemove', (e) => {
                        if (this.tooltip && this.tooltip.style.display === 'block') {
                            const x = e.clientX + 10;
                            const y = e.clientY + 10;
                            
                            // 确保提示框不会超出窗口
                            const tooltipWidth = this.tooltip.offsetWidth;
                            const tooltipHeight = this.tooltip.offsetHeight;
                            
                            if (x + tooltipWidth > window.innerWidth) {
                                this.tooltip.style.left = `${x - tooltipWidth - 20}px`;
                            } else {
                                this.tooltip.style.left = `${x}px`;
                            }
                            
                            if (y + tooltipHeight > window.innerHeight) {
                                this.tooltip.style.top = `${y - tooltipHeight - 20}px`;
                            } else {
                                this.tooltip.style.top = `${y}px`;
                            }
                        }
                    });
                } else {
                    dayElement.title = dateStr;
                }

                monthGrid.appendChild(dayElement);
            }

            monthContainer.appendChild(monthGrid);
            this.container.appendChild(monthContainer);

            // 添加点击事件，点击月份容器显示详细视图
            monthContainer.addEventListener('click', (e) => {
                // 确保点击的不是日期方块（避免与悬停事件冲突）
                if (!e.target.classList.contains('day') && 
                    !e.target.classList.contains('empty-day')) {
                    // 添加点击反馈效果
                    monthContainer.style.transform = 'translateY(-2px)';
                    setTimeout(() => {
                        monthContainer.style.transform = '';
                        this.showMonthDetail(month, this.currentYear, data);
                    }, 150);
                }
            });
        }
    }

    renderMonthView(data) {
        // 单月详细视图
        this.showMonthDetail(this.currentMonth, this.currentYear, data);
    }

    renderWeekView(data) {
        if (!this.currentWeek) return;

        const [weekYear, weekNum] = this.currentWeek.split('-W');
        const weekStart = this.getDateFromWeek(parseInt(weekYear), parseInt(weekNum));
        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

        const weekContainer = document.createElement('div');
        weekContainer.className = 'week-container';
        weekContainer.style.cssText = `
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            border-radius: var(--radius-lg);
            padding: 2rem;
            box-shadow: var(--shadow-md);
            border: 1px solid rgba(255, 255, 255, 0.2);
        `;

        const weekTitle = document.createElement('h3');
        weekTitle.textContent = `${weekYear}年第${weekNum}周`;
        weekTitle.style.cssText = `
            font-size: 1.5rem;
            font-weight: 600;
            margin-bottom: 1.5rem;
            color: var(--text-primary);
            text-align: center;
        `;
        weekContainer.appendChild(weekTitle);

        const weekGrid = document.createElement('div');
        weekGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 1rem;
        `;

        for (let i = 0; i < 7; i++) {
            const date = new Date(weekStart);
            date.setDate(weekStart.getDate() + i);
            
            const dateStr = this.formatDateStr(date);
            const dayData = data[dateStr];

            const dayContainer = document.createElement('div');
            dayContainer.style.cssText = `
                background: white;
                border-radius: var(--radius-md);
                padding: 1rem;
                min-height: 200px;
                border: 1px solid var(--border-color);
                transition: all 0.2s ease;
            `;

            const dayHeader = document.createElement('div');
            dayHeader.style.cssText = `
                font-weight: 600;
                margin-bottom: 0.5rem;
                color: var(--text-primary);
                text-align: center;
                padding-bottom: 0.5rem;
                border-bottom: 1px solid var(--border-color);
            `;
            dayHeader.textContent = `${weekdays[i]} ${date.getDate()}日`;
            dayContainer.appendChild(dayHeader);

            if (dayData && dayData.events && dayData.events.length > 0) {
                const totalDuration = dayData.totalDuration || 
                                     dayData.events.reduce((sum, event) => sum + event.duration, 0);
                
                const durationInfo = document.createElement('div');
                durationInfo.style.cssText = `
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                    margin-bottom: 0.5rem;
                    text-align: center;
                `;
                durationInfo.textContent = `总时长: ${this.formatDuration(totalDuration)}`;
                dayContainer.appendChild(durationInfo);

                dayData.events.forEach(event => {
                    const eventElement = document.createElement('div');
                    eventElement.style.cssText = `
                        background: rgba(102, 126, 234, 0.1);
                        border-left: 3px solid var(--primary-color);
                        padding: 0.5rem;
                        margin-bottom: 0.5rem;
                        border-radius: var(--radius-sm);
                        font-size: 0.875rem;
                    `;
                    
                    const startTime = event.startTime.toLocaleTimeString('zh-CN', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    });
                    
                    eventElement.innerHTML = `
                        <div style="font-weight: 500; margin-bottom: 0.25rem;">${event.summary}</div>
                        <div style="color: var(--text-muted); font-size: 0.75rem;">
                            ${startTime} · ${this.formatDuration(event.duration)}
                        </div>
                    `;
                    
                    dayContainer.appendChild(eventElement);
                });
            } else {
                const noEvents = document.createElement('div');
                noEvents.style.cssText = `
                    color: var(--text-muted);
                    text-align: center;
                    margin-top: 2rem;
                    font-style: italic;
                `;
                noEvents.textContent = '无活动';
                dayContainer.appendChild(noEvents);
            }

            weekGrid.appendChild(dayContainer);
        }

        weekContainer.appendChild(weekGrid);
        this.container.appendChild(weekContainer);
    }

    // 修改显示工具提示的方法
    showTooltip(element, text) {
        if (!this.tooltip) return;
        
        this.tooltip.innerHTML = text;  // 现在使用innerHTML而不是textContent
        this.tooltip.style.display = 'block';
        
        // 获取鼠标位置和窗口大小
        const rect = element.getBoundingClientRect();
        const tooltipWidth = this.tooltip.offsetWidth;
        const tooltipHeight = this.tooltip.offsetHeight;
        
        // 计算位置，确保工具提示不会超出窗口
        let left = rect.right + 10;  // 增加偏移距离
        let top = rect.top - 5;      // 稍微向上偏移
        
        // 如果右侧空间不足，显示在左侧
        if (left + tooltipWidth > window.innerWidth) {
            left = rect.left - tooltipWidth - 10;
        }
        
        // 如果底部空间不足，向上偏移
        if (top + tooltipHeight > window.innerHeight) {
            top = window.innerHeight - tooltipHeight - 10;
        }
        
        // 确保不会超出顶部
        if (top < 10) {
            top = 10;
        }
        
        // 设置位置
        this.tooltip.style.left = `${left}px`;
        this.tooltip.style.top = `${top}px`;
    }

    // 修改隐藏工具提示的方法
    hideTooltip() {
        if (!this.tooltip) return;
        this.tooltip.style.display = 'none';
    }

    // 添加搜索功能设置
    setupSearch() {
        const searchInput = document.getElementById('searchInput');
        const searchButton = document.getElementById('searchButton');
        const resetButton = document.getElementById('resetButton');

        if (searchButton) {
            searchButton.addEventListener('click', () => this.performSearch());
        }

        if (resetButton) {
            resetButton.addEventListener('click', () => this.resetSearch());
        }

        if (searchInput) {
            // 添加回车键搜索功能
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.performSearch();
                }
            });
        }
    }

    // 执行搜索
    performSearch() {
        const searchInput = document.getElementById('searchInput');
        if (!searchInput || !this.originalData) return;

        const searchTerm = searchInput.value.trim().toLowerCase();
        
        if (searchTerm === '') {
            this.resetSearch();
            return;
        }

        // 过滤数据 - 完全重写逻辑
        const filteredData = {};
        Object.entries(this.originalData).forEach(([date, dayData]) => {
            // 找出匹配搜索词的事件
            const matchedEvents = dayData.events.filter(event => 
                event.summary.toLowerCase().includes(searchTerm)
            );
            
            // 如果有匹配的事件，创建新的日期数据对象
            if (matchedEvents.length > 0) {
                // 计算匹配事件的总时长
                const totalDuration = matchedEvents.reduce((sum, event) => sum + event.duration, 0);
                
                // 创建新的数据对象，只包含匹配的事件
                filteredData[date] = {
                    events: matchedEvents,
                    totalDuration: totalDuration,
                    maxDuration: Math.max(...matchedEvents.map(event => event.duration))
                };
            }
        });

        // 应用时间范围筛选
        const timeFilteredData = this.filterDataByTimeRange(filteredData);

        // 重新渲染日历和统计信息
        this.renderStats(timeFilteredData);
        this.render(timeFilteredData);
    }

    // 重置搜索
    resetSearch() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = '';
        }
        
        if (this.originalData) {
            const filteredData = this.filterDataByTimeRange(this.originalData);
            this.renderStats(filteredData);
            this.render(filteredData);
        }
    }

    setupOptions() {
        const showEventCountCheckbox = document.getElementById('showEventCount');
        if (showEventCountCheckbox) {
            showEventCountCheckbox.addEventListener('change', (e) => {
                this.showEventCount = e.target.checked;
                if (this.originalData) {
                    const filteredData = this.filterDataByTimeRange(this.originalData);
                    this.render(filteredData); // 重新渲染日历
                }
            });
        }
    }

    // 显示月份详细视图 - 改进版
    showMonthDetail(month, year, data) {
        if (!this.monthModal || !this.monthModalTitle || !this.monthModalCalendar) return;
        
        // 设置标题
        const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', 
                           '7月', '8月', '9月', '10月', '11月', '12月'];
        this.monthModalTitle.textContent = `${year}年 ${monthNames[month]}`;
        
        // 清空日历内容
        this.monthModalCalendar.innerHTML = '';
        
        // 添加月份控制按钮
        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'month-controls';
        
        const prevButton = document.createElement('button');
        prevButton.className = 'month-control-button';
        prevButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>上个月';
        prevButton.addEventListener('click', () => {
            let newMonth = month - 1;
            let newYear = year;
            if (newMonth < 0) {
                newMonth = 11;
                newYear -= 1;
            }
            this.showMonthDetail(newMonth, newYear, this.originalData || data);
        });
        
        const nextButton = document.createElement('button');
        nextButton.className = 'month-control-button';
        nextButton.innerHTML = '下个月<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';
        nextButton.addEventListener('click', () => {
            let newMonth = month + 1;
            let newYear = year;
            if (newMonth > 11) {
                newMonth = 0;
                newYear += 1;
            }
            this.showMonthDetail(newMonth, newYear, this.originalData || data);
        });
        
        controlsDiv.appendChild(prevButton);
        controlsDiv.appendChild(nextButton);
        
        this.monthModalCalendar.appendChild(controlsDiv);
        
        // 创建星期标签
        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
        const weekdayLabels = document.createElement('div');
        weekdayLabels.className = 'detailed-weekday-labels';
        
        for (let i = 0; i < 7; i++) {
            const label = document.createElement('div');
            label.className = 'detailed-weekday-label';
            label.textContent = weekdays[i];
            weekdayLabels.appendChild(label);
        }
        
        this.monthModalCalendar.appendChild(weekdayLabels);
        
        // 创建日历网格
        const monthGrid = document.createElement('div');
        monthGrid.className = 'detailed-month-grid';
        
        // 获取当月第一天
        const firstDay = new Date(year, month, 1);
        // 获取当月天数
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        // 获取当月第一天是星期几
        const firstDayWeek = firstDay.getDay();
        
        // 获取今天的日期
        const today = new Date();
        const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;
        const currentDate = today.getDate();
        
        // 添加空白天数
        for (let i = 0; i < firstDayWeek; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'detailed-empty-day';
            monthGrid.appendChild(emptyDay);
        }
        
        // 添加当月所有天数
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dateStr = this.formatDateStr(date);
            const dayData = data[dateStr];
            
            const dayElement = document.createElement('div');
            dayElement.className = 'detailed-day';
            
            // 标记今天
            if (isCurrentMonth && day === currentDate) {
                dayElement.classList.add('today');
            }
            
            // 添加日期标题
            const dayHeader = document.createElement('div');
            dayHeader.className = 'detailed-day-header';
            dayHeader.textContent = day;
            dayElement.appendChild(dayHeader);
            
            // 添加事件列表
            const eventsContainer = document.createElement('div');
            eventsContainer.className = 'detailed-day-events';
            
            if (dayData && dayData.events && dayData.events.length > 0) {
                dayData.events.forEach(event => {
                    const eventElement = document.createElement('div');
                    eventElement.className = 'detailed-event';
                    
                    // 使用当前等级划分方案计算颜色等级
                    const level = this.getSingleEventColorLevel(event.duration);
                    eventElement.setAttribute('data-level', level);
                    
                    // 格式化开始时间
                    const startHour = event.startTime.getHours().toString().padStart(2, '0');
                    const startMin = event.startTime.getMinutes().toString().padStart(2, '0');
                    
                    eventElement.textContent = `${startHour}:${startMin} ${event.summary}`;
                    eventElement.title = this.formatSingleEventDetail(event);
                    
                    // 添加点击事件，显示详细信息
                    eventElement.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.showEventDetailModal(event, dateStr);
                    });
                    
                    eventsContainer.appendChild(eventElement);
                });
            }
            
            dayElement.appendChild(eventsContainer);
            monthGrid.appendChild(dayElement);
        }
        
        this.monthModalCalendar.appendChild(monthGrid);
        
        // 显示模态框
        this.monthModal.style.display = 'block';
        // 使用 setTimeout 确保转场动画效果
        setTimeout(() => {
            this.monthModal.classList.add('show');
        }, 10);
    }
    
    // 关闭月份详细视图 - 带动画效果
    closeMonthModal() {
        if (this.monthModal) {
            this.monthModal.classList.remove('show');
            setTimeout(() => {
                this.monthModal.style.display = 'none';
            }, 300); // 等待动画完成
        }
    }
    
    // 格式化日期为 YYYY-MM-DD
    formatDateStr(date) {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    // 根据单个事件的时长确定颜色等级
    getSingleEventColorLevel(duration) {
        const thresholds = this.levelSchemes[this.currentLevelScheme].thresholds;
        
        if (duration === 0) return 0;
        
        for (let i = 0; i < thresholds.length; i++) {
            if (duration <= thresholds[i]) {
                return i + 1;
            }
        }
        return thresholds.length + 1;
    }
    
    // 格式化单个事件的详细信息
    formatSingleEventDetail(event) {
        const formatTime = (date) => {
            if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
                return "未知时间";
            }
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return `${hours}:${minutes}`;
        };
        
        let details = `${event.summary}\n`;
        details += `时间: ${formatTime(event.startTime)} - ${formatTime(event.endTime)}\n`;
        details += `时长: ${Math.round(event.duration)}分钟`;
        
        if (event.location) {
            details += `\n地点: ${event.location}`;
        }
        
        if (event.description) {
            details += `\n描述: ${event.description}`;
        }
        
        return details;
    }

    // 添加事件详情弹窗
    showEventDetailModal(event, dateStr) {
        // 检查是否已经存在模态框，如果不存在则创建一个
        let eventModal = document.getElementById('eventDetailModal');
        if (!eventModal) {
            eventModal = document.createElement('div');
            eventModal.id = 'eventDetailModal';
            eventModal.className = 'event-detail-modal';
            
            const modalContent = document.createElement('div');
            modalContent.className = 'event-detail-content';
            
            const closeBtn = document.createElement('div');
            closeBtn.className = 'event-close';
            closeBtn.innerHTML = '&times;';
            closeBtn.onclick = () => this.closeEventDetailModal();
            
            modalContent.appendChild(closeBtn);
            eventModal.appendChild(modalContent);
            document.body.appendChild(eventModal);
            
            // 点击空白处关闭
            eventModal.addEventListener('click', (e) => {
                if (e.target === eventModal) {
                    this.closeEventDetailModal();
                }
            });
        }
        
        // 更新模态框内容
        const modalContent = eventModal.querySelector('.event-detail-content');
        
        // 格式化时间
        const formatTime = (date) => {
            if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
                return "未知时间";
            }
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return `${hours}:${minutes}`;
        };
        
        // 计算持续时间的文本表示
        const formatDuration = (minutes) => {
            if (this.currentLevelScheme === 'halfHour') {
                if (minutes < 60) {
                    return `${minutes}分钟`;
                } else {
                    const hours = Math.floor(minutes / 60);
                    const mins = minutes % 60;
                    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
                }
            } else {
                if (minutes < 60) {
                    return `${minutes}分钟`;
                } else {
                    const hours = Math.floor(minutes / 60);
                    const mins = minutes % 60;
                    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
                }
            }
        };
        
        const eventDate = new Date(dateStr);
        const dateOptions = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
        const dateString = eventDate.toLocaleDateString('zh-CN', dateOptions);
        
        let eventHtml = `
            <div class="event-title">${event.summary}</div>
            <div class="event-info">
                <div class="event-info-label">📅</div>
                <div class="event-info-value">${dateString}</div>
            </div>
            <div class="event-info">
                <div class="event-info-label">⏱️</div>
                <div class="event-info-value">${formatTime(event.startTime)} - ${formatTime(event.endTime)}</div>
            </div>
            <div class="event-info">
                <div class="event-info-label">⌛</div>
                <div class="event-info-value">${formatDuration(Math.round(event.duration))}</div>
            </div>
        `;
        
        if (event.location) {
            eventHtml += `
                <div class="event-info">
                    <div class="event-info-label">📍</div>
                    <div class="event-info-value">${event.location}</div>
                </div>
            `;
        }
        
        if (event.description) {
            eventHtml += `
                <div class="event-info">
                    <div class="event-info-label">📑</div>
                    <div class="event-info-value">${event.description}</div>
                </div>
            `;
        }
        
        // 设置内容
        modalContent.innerHTML = `
            <div class="event-close">&times;</div>
            ${eventHtml}
        `;
        
        // 重新绑定关闭按钮事件
        modalContent.querySelector('.event-close').onclick = () => this.closeEventDetailModal();
        
        // 显示模态框
        eventModal.style.display = 'block';
        setTimeout(() => {
            eventModal.classList.add('show');
        }, 10);
    }

    // 关闭事件详情弹窗
    closeEventDetailModal() {
        const eventModal = document.getElementById('eventDetailModal');
        if (eventModal) {
            eventModal.classList.remove('show');
            setTimeout(() => {
                eventModal.style.display = 'none';
            }, 300);
        }
    }

    // 添加配色方案切换功能
    setupColorScheme() {
        const colorSchemeSelect = document.getElementById('colorScheme');
        if (colorSchemeSelect) {
            // 设置初始值（从本地存储加载，如果有的话）
            const savedScheme = localStorage.getItem('calendarColorScheme') || 'green';
            colorSchemeSelect.value = savedScheme;
            this.applyColorScheme(savedScheme);
            
            // 监听变化
            colorSchemeSelect.addEventListener('change', (e) => {
                const scheme = e.target.value;
                this.applyColorScheme(scheme);
                // 保存到本地存储
                localStorage.setItem('calendarColorScheme', scheme);
            });
        }
    }
    
    // 应用配色方案
    applyColorScheme(scheme) {
        // 移除所有现有的配色类
        document.body.classList.remove(
            'color-scheme-green',
            'color-scheme-blue',
            'color-scheme-red',
            'color-scheme-purple',
            'color-scheme-orange',
            'color-scheme-teal',
            'color-scheme-pink',
            'color-scheme-brown',
            'color-scheme-gray'
        );
        
        // 如果不是绿色系（默认），则添加相应的配色类
        if (scheme !== 'green') {
            document.body.classList.add(`color-scheme-${scheme}`);
        }
        
        // 更新配色方案名称显示
        const schemeTitles = {
            'green': '绿色系',
            'blue': '蓝色系',
            'red': '红色系',
            'purple': '紫色系',
            'orange': '橙色系',
            'teal': '青色系',
            'pink': '粉色系',
            'brown': '棕色系',
            'gray': '灰色系'
        };
        
        // 如果需要，可以在界面上其他地方显示当前配色方案名称
        console.log(`应用配色方案: ${schemeTitles[scheme]}`);
    }

    setupLevelSchemeSelector() {
        const levelSchemeSelect = document.getElementById('levelScheme');
        levelSchemeSelect.addEventListener('change', (e) => {
            this.currentLevelScheme = e.target.value;
            this.updateLegend();
            // 如果有数据，则重新渲染
            if (this.originalData) {
                this.render(this.originalData);
            }
        });
    }

    updateLegend() {
        const labels = this.levelSchemes[this.currentLevelScheme].labels;
        const legendContainer = document.querySelector('.color-legend');
        
        // 保留"无活动"的图例
        const noActivityLegend = legendContainer.children[1];
        legendContainer.innerHTML = '<span>颜色图例：</span>';
        legendContainer.appendChild(noActivityLegend);

        // 添加新的图例
        labels.forEach((label, index) => {
            if (index === labels.length - 1) return; // 跳过最后一个（用于">X小时"）
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';
            legendItem.innerHTML = `
                <div class="legend-color" data-level="${index + 1}"></div>
                <span>${label}</span>
            `;
            legendContainer.appendChild(legendItem);
        });

        // 添加最后一个图例（>X小时）
        const lastLegendItem = document.createElement('div');
        lastLegendItem.className = 'legend-item';
        lastLegendItem.innerHTML = `
            <div class="legend-color" data-level="${labels.length}"></div>
            <span>${labels[labels.length - 1]}</span>
        `;
        legendContainer.appendChild(lastLegendItem);
    }

    // 格式化事件详情，用于悬停显示 - 添加当日总时长
    formatEventDetails(dayData) {
        try {
            const formatTime = (date) => {
                if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
                    return "未知时间";
                }
                const hours = date.getHours().toString().padStart(2, '0');
                const minutes = date.getMinutes().toString().padStart(2, '0');
                return `${hours}:${minutes}`;
            };
            
            const formatDate = (date) => {
                if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
                    return "未知日期";
                }
                const year = date.getFullYear();
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const day = date.getDate().toString().padStart(2, '0');
                return `${year}-${month}-${day}`;
            };
            
            // 格式化持续时间为"小时+分钟"格式
            const formatDuration = (minutes) => {
                if (this.currentLevelScheme === 'halfHour') {
                    if (minutes < 60) {
                        return `${Math.round(minutes)}分钟`;
                    } else {
                        const hours = Math.floor(minutes / 60);
                        const mins = Math.round(minutes % 60);
                        return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
                    }
                } else {
                    if (minutes < 60) {
                        return `${Math.round(minutes)}分钟`;
                    } else {
                        const hours = Math.floor(minutes / 60);
                        const mins = Math.round(minutes % 60);
                        return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
                    }
                }
            };

            // 获取日期（使用第一个事件的日期）
            const firstEvent = dayData.events[0];
            let details = `<div class="tooltip-date">📅 ${formatDate(firstEvent.startTime)}</div>`;
            
            // 添加当日总时长信息
            const totalDuration = dayData.totalDuration || 
                                 dayData.events.reduce((sum, event) => sum + (event.duration || 0), 0);
            
            details += `<div class="tooltip-total-duration">总时长: ${formatDuration(totalDuration)}</div>`;
            
            // 添加分隔线
            details += '<div class="tooltip-divider"></div>';
            
            // 添加所有事件的详情
            dayData.events.forEach((event, index) => {
                if (index > 0) {
                    details += '<div class="tooltip-divider"></div>'; // 添加事件间分隔线
                }
                
                details += `<div class="tooltip-title">${event.summary}</div>`;
                details += `<div class="tooltip-time">⏱️ ${formatTime(event.startTime)} - ${formatTime(event.endTime)}</div>`;
                details += `<div class="tooltip-duration">⌛ 时长: ${formatDuration(event.duration)}</div>`;
                
                if (event.location) {
                    details += `<div class="tooltip-location">📍 ${event.location}</div>`;
                }
            });
            
            return details;
        } catch (error) {
            console.error('格式化事件详情失败:', error);
            return "活动详情";
        }
    }
}

// 等待页面加载完成后再初始化
window.addEventListener('load', () => {
    const heatmap = new CalendarHeatmap();
}); 
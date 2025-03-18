class CalendarHeatmap {
    constructor() {
        // 检查 ICAL 是否已加载
        if (typeof ICAL === 'undefined') {
            console.error('ICAL 库未加载，请确保已引入 ical.js');
            this.container = document.getElementById('heatmap');
            this.container.innerHTML = '<p style="color: red;">错误: ICAL 库未加载</p>';
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

            console.log('开始读取文件...');
            const content = await file.text();
            console.log('文件内容已读取，开始解析...');
            const data = this.parseICSFile(content);
            console.log('解析完成，开始渲染...');
            
            // 保存原始数据
            this.originalData = data;
            
            this.renderStats(data);
            this.render(data);
        } catch (error) {
            console.error('处理文件失败:', error);
            this.container.innerHTML = `<p style="color: red;">处理文件失败: ${error.message}</p>`;
        }
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
        // 使用总时长而不是最大时长
        const totalDuration = data.totalDuration || 0;
        
        if (totalDuration === 0) return 0;
        if (totalDuration <= 60) return 1;  // 总时长不超过1小时
        if (totalDuration <= 120) return 2; // 总时长不超过2小时
        if (totalDuration <= 180) return 3; // 总时长不超过3小时
        return 4;                           // 总时长超过3小时
    }

    // 计算统计数据 - 完全重写以修复计算问题
    calculateStats(data) {
        const now = new Date();
        const currentYear = now.getFullYear();
        
        // 打卡天数 - 确保只计算有效数据且仅计算当年数据
        const validDates = Object.keys(data).filter(dateStr => {
            const dayData = data[dateStr];
            const date = new Date(dateStr);
            // 只计算当年且有效的运动数据
            return dayData && 
                   dayData.events.length > 0 && 
                   date.getFullYear() === currentYear;
        });
        
        console.log('有效日期数：', validDates.length);
        console.log('有效日期列表：', validDates);
        
        const totalWorkoutDays = validDates.length;
        
        // 按月统计
        const monthlyStats = Array(12).fill(0);
        
        for (const dateStr of validDates) {
            const date = new Date(dateStr);
            monthlyStats[date.getMonth()]++;
        }
        
        console.log('月度统计:', monthlyStats);
        
        // 修正平均每月打卡计算逻辑
        // 计算当前经过的月份数（包括当前月）
        const currentMonth = now.getMonth();
        const monthsElapsed = currentMonth + 1;
        
        // 只计算到目前为止的月份
        const activeMonthStats = monthlyStats.slice(0, monthsElapsed);
        const totalActiveDays = activeMonthStats.reduce((sum, count) => sum + count, 0);
        
        // 平均每月打卡天数 = 当年打卡天数 / 经过的月份数
        const avgWorkoutsPerMonth = monthsElapsed > 0 ? (totalActiveDays / monthsElapsed).toFixed(1) : 0;
        
        // 计算连续打卡记录 - 彻底重写
        let maxStreak = 0;
        
        if (validDates.length > 0) {
            // 按日期排序
            const sortedDates = validDates.sort();
            
            // 转换为日期对象数组，方便计算日期差异
            const dateObjects = sortedDates.map(d => new Date(d));
            
            // 初始化当前连续天数
            let currentStreak = 1;
            
            // 遍历所有日期，检查是否连续
            for (let i = 1; i < dateObjects.length; i++) {
                const prevDate = dateObjects[i-1];
                const currDate = dateObjects[i];
                
                // 计算日期差（以天为单位）
                const dayDiff = Math.round((currDate - prevDate) / (1000 * 60 * 60 * 24));
                
                if (dayDiff === 1) {
                    // 连续日期
                    currentStreak++;
                } else {
                    // 连续中断，重置计数
                    maxStreak = Math.max(maxStreak, currentStreak);
                    currentStreak = 1;
                }
            }
            
            // 最后一次检查，确保最后一组连续日期也被计算
            maxStreak = Math.max(maxStreak, currentStreak);
        }
        
        console.log(`最终连续打卡记录: ${maxStreak}天`);
        
        return {
            totalWorkoutDays,
            monthlyStats,
            avgWorkoutsPerMonth,
            maxStreak
        };
    }

    // 渲染统计数据
    renderStats(data) {
        const stats = this.calculateStats(data);
        this.statsContainer.innerHTML = '';
        
        // 打卡天数卡片
        const totalDaysCard = document.createElement('div');
        totalDaysCard.className = 'stat-card';
        totalDaysCard.innerHTML = `
            <div class="stat-title">总打卡天数</div>
            <div class="stat-value">${stats.totalWorkoutDays}</div>
        `;
        
        // 最长连续打卡卡片
        const streakCard = document.createElement('div');
        streakCard.className = 'stat-card';
        streakCard.innerHTML = `
            <div class="stat-title">最长连续打卡</div>
            <div class="stat-value">${stats.maxStreak}天</div>
        `;
        
        // 平均每月打卡卡片
        const avgCard = document.createElement('div');
        avgCard.className = 'stat-card';
        avgCard.innerHTML = `
            <div class="stat-title">平均每月打卡</div>
            <div class="stat-value">${stats.avgWorkoutsPerMonth}天</div>
        `;
        
        this.statsContainer.appendChild(totalDaysCard);
        this.statsContainer.appendChild(streakCard);
        this.statsContainer.appendChild(avgCard);
        
        // 添加调试选项（开发环境可以打开）
        const isDebug = false;
        if (isDebug) {
            // 创建用于显示所有被计算日期的元素
            const debugCard = document.createElement('div');
            debugCard.style.marginTop = '20px';
            debugCard.style.fontSize = '12px';
            debugCard.style.color = '#666';
            
            const validDates = Object.keys(data).filter(dateStr => {
                const dayData = data[dateStr];
                const date = new Date(dateStr);
                return dayData && dayData.events.length > 0 && date.getFullYear() === new Date().getFullYear();
            }).sort();
            
            debugCard.innerHTML = `<div>计算的有效日期 (${validDates.length}):</div>
                                    <div>${validDates.join(', ')}</div>`;
                                    
            this.statsContainer.appendChild(debugCard);
        }
    }

    // 格式化事件详情，用于悬停显示
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

            // 获取日期（使用第一个事件的日期）
            const firstEvent = dayData.events[0];
            let details = `<div class="tooltip-date">📅 ${formatDate(firstEvent.startTime)}</div>`;
            
            // 添加所有事件的详情
            dayData.events.forEach((event, index) => {
                if (index > 0) {
                    details += '<div class="tooltip-divider"></div>'; // 添加分隔线
                }
                
                details += `<div class="tooltip-title">${event.summary}</div>`;
                details += `<div class="tooltip-time">⏱️ ${formatTime(event.startTime)} - ${formatTime(event.endTime)}</div>`;
                details += `<div class="tooltip-duration">⌛ ${Math.round(event.duration)}分钟</div>`;
                
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

    // 渲染热力图
    render(data) {
        this.container.innerHTML = '';
        const now = new Date();
        const currentYear = now.getFullYear();
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
            const firstDay = new Date(currentYear, month, 1);
            
            // 获取当月天数
            const daysInMonth = new Date(currentYear, month + 1, 0).getDate();
            
            // 获取当月第一天是星期几 (0-6, 0表示星期日)
            const firstDayWeek = firstDay.getDay();
            
            console.log(`${currentYear}年${month+1}月第一天: ${firstDay.toISOString().split('T')[0]}, 星期${weekdays[firstDayWeek]}`);

            // 添加空白天数
            for (let i = 0; i < firstDayWeek; i++) {
                const emptyDay = document.createElement('div');
                emptyDay.className = 'empty-day';
                monthGrid.appendChild(emptyDay);
            }

            // 添加当月所有天数
            for (let day = 1; day <= daysInMonth; day++) {
                // 使用更准确的日期创建方式
                const date = new Date(currentYear, month, day);
                
                // 确保使用正确的日期格式 YYYY-MM-DD
                const year = date.getFullYear();
                const monthStr = (date.getMonth() + 1).toString().padStart(2, '0');
                const dayStr = date.getDate().toString().padStart(2, '0');
                const dateStr = `${year}-${monthStr}-${dayStr}`;
                
                const dayData = data[dateStr];

                const dayElement = document.createElement('div');
                dayElement.className = 'day';
                dayElement.setAttribute('data-date', dateStr);
                
                // 显示日期数字以便调试（可选）
                // dayElement.innerText = day;

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
                        this.showMonthDetail(month, currentYear, data);
                    }, 150);
                }
            });
        }
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

        // 重新渲染日历和统计信息
        this.renderStats(filteredData);
        this.render(filteredData);
    }

    // 重置搜索
    resetSearch() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = '';
        }
        
        if (this.originalData) {
            this.renderStats(this.originalData);
            this.render(this.originalData);
        }
    }

    setupOptions() {
        const showEventCountCheckbox = document.getElementById('showEventCount');
        if (showEventCountCheckbox) {
            showEventCountCheckbox.addEventListener('change', (e) => {
                this.showEventCount = e.target.checked;
                this.render(this.originalData); // 重新渲染日历
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
                    
                    // 根据事件时长设置颜色
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
        if (duration === 0) return 0;
        if (duration <= 60) return 1;   // 不超过1小时
        if (duration <= 120) return 2;  // 不超过2小时
        if (duration <= 180) return 3;  // 不超过3小时
        return 4;                        // 超过3小时
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
            if (minutes < 60) {
                return `${minutes}分钟`;
            } else {
                const hours = Math.floor(minutes / 60);
                const mins = minutes % 60;
                return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
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
                    <div class="event-info-label">地点:</div>
                    <div class="event-info-value">${event.location}</div>
                </div>
            `;
        }
        
        if (event.description) {
            eventHtml += `
                <div class="event-info">
                    <div class="event-info-label">描述:</div>
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
}

// 等待页面加载完成后再初始化
window.addEventListener('load', () => {
    const heatmap = new CalendarHeatmap();
}); 
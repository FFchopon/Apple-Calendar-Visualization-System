# 📅 现代化日历应用

一个功能丰富的现代化日历应用，支持ICS文件导入、热力图可视化和多维度统计分析。

## ✨ 主要特性

### 🎨 现代化界面设计
- **紫色渐变背景**：优雅的视觉体验
- **毛玻璃效果**：现代化卡片设计
- **流畅动画**：悬停、点击和过渡效果
- **响应式设计**：适配各种屏幕尺寸
- **Font Awesome图标**：丰富的视觉元素

### 📊 热力图日历
- **可视化活动密度**：通过颜色深浅显示每日活动强度
- **智能统计**：自动计算总时长、平均每日时长、活跃天数
- **拖拽上传**：支持拖拽ICS文件到页面
- **搜索功能**：快速查找特定日期的活动
- **时间范围筛选**：按年、月、周查看数据

### 📈 统计分析功能
- **批量文件上传**：同时处理多个ICS文件
- **多维度统计**：按天、周、月、年进行数据分析
- **四种可视化图表**：
  - 📈 **时长趋势图**：显示时间变化趋势
  - 🥧 **活动分布图**：按文件类型统计活动分布
  - 📊 **时段分析图**：分析一天中的活动模式
- **图表放大功能**：点击图表可放大查看详细信息
- **智能统计卡片**：显示关键指标和数据洞察

### 🔧 高级功能
- **工作日筛选**：可选择特定工作日进行分析
- **时间范围控制**：精确控制统计时间范围
- **文件管理**：上传文件状态显示和移除功能
- **通知系统**：成功/错误状态智能提示

## 🚀 快速开始

### 1. 下载项目
```bash
git clone [项目地址]
cd calendar
```

### 2. 启动应用
由于使用了现代Web API，需要通过HTTP服务器运行：

**使用Python（推荐）：**
```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

**使用Node.js：**
```bash
npx http-server
```

**使用Live Server（VS Code扩展）：**
- 安装Live Server扩展
- 右键点击`index.html`选择"Open with Live Server"

### 3. 访问应用
打开浏览器访问：`http://localhost:8000`

## 📖 使用指南

### 热力图日历页面

1. **上传ICS文件**：
   - 拖拽ICS文件到上传区域
   - 或点击上传区域选择文件

2. **查看热力图**：
   - 颜色越深表示当天活动越多
   - 点击日期查看详细活动信息

3. **统计信息**：
   - 查看总时长、平均每日时长、活跃天数
   - 支持按年、月、周筛选

### 统计分析页面

1. **批量上传文件**：
   - 同时选择多个ICS文件
   - 查看上传状态和进度

2. **选择统计维度**：
   - 按天：查看每日活动趋势
   - 按周：查看每周活动模式
   - 按月：查看每月活动分布
   - 按年：查看年度活动概览

3. **时间范围筛选**：
   - 选择特定年份、月份或周数
   - 统计数据自动更新

4. **图表交互**：
   - 点击图表可放大查看
   - 支持图表数据导出

## 🛠️ 技术栈

### 前端技术
- **HTML5**：语义化标记
- **CSS3**：现代样式和动画
- **JavaScript (ES6+)**：模块化开发
- **Chart.js**：数据可视化
- **Font Awesome**：图标库
- **Google Fonts**：字体支持

### 核心功能
- **ICS文件解析**：支持标准iCalendar格式
- **数据可视化**：多种图表类型
- **响应式设计**：移动端适配
- **模块化架构**：易于维护和扩展

## 📁 项目结构

```
calendar/
├── index.html          # 主页面
├── calendar.js         # 热力图日历功能
├── statistics.js       # 统计分析功能
├── README.md          # 项目说明文档
└── sample-files/      # 示例ICS文件（可选）
```

## 🎯 支持的ICS格式

应用支持标准的iCalendar (.ics) 格式文件，包括：
- **VEVENT**：事件信息
- **DTSTART/DTEND**：开始和结束时间
- **SUMMARY**：事件标题
- **DESCRIPTION**：事件描述
- **LOCATION**：事件地点

### 示例ICS格式：
```ics
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Example Corp//Example Calendar//EN
BEGIN:VEVENT
UID:example@example.com
DTSTART:20240101T090000Z
DTEND:20240101T100000Z
SUMMARY:会议
DESCRIPTION:项目讨论会议
LOCATION:会议室A
END:VEVENT
END:VCALENDAR
```

## 🔧 自定义配置

### 颜色主题
在CSS中修改CSS变量来自定义主题：
```css
:root {
    --primary-color: #8b5cf6;
    --secondary-color: #a78bfa;
    --accent-color: #c4b5fd;
    /* 更多颜色变量... */
}
```

### 统计维度
在`statistics.js`中可以添加新的统计维度或修改现有逻辑。

## 🐛 故障排除

### 常见问题

1. **文件上传失败**
   - 确保文件是有效的ICS格式
   - 检查文件大小是否过大
   - 确认浏览器支持File API

2. **图表不显示**
   - 检查是否通过HTTP服务器访问
   - 确认Chart.js库正确加载
   - 检查控制台是否有JavaScript错误

3. **样式显示异常**
   - 确认网络连接正常（外部字体和图标）
   - 检查CSS文件是否正确加载
   - 清除浏览器缓存

## 🤝 贡献指南

欢迎提交Issue和Pull Request来改进项目！

### 开发环境设置
1. Fork项目
2. 创建功能分支
3. 提交更改
4. 创建Pull Request

## 📄 许可证

本项目采用MIT许可证 - 查看[LICENSE](LICENSE)文件了解详情。

## 🙏 致谢

- [Chart.js](https://www.chartjs.org/) - 数据可视化
- [Font Awesome](https://fontawesome.com/) - 图标库
- [Google Fonts](https://fonts.google.com/) - 字体支持

---

**享受使用这个现代化日历应用！** 🎉

如有问题或建议，请随时联系或提交Issue。 
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { ChevronLeft, ChevronRight, Loader2, Calendar as CalendarIcon, AlertCircle } from 'lucide-react';

/**
 * 训练日历页面组件 - 月视图展示已练天数与追溯每日动作详情
 * 
 * @param {Object} props
 * @param {Function} props.getExerciseCNName 动作中文翻译函数 (来自 App.jsx)
 */
function CalendarScreen({ getExerciseCNName }) {
  // 1. 本地日期初始化
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth()); // 0 - 11
  
  // 状态管理
  const [loadingMonth, setLoadingMonth] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState(null);
  
  // 存当月有训练的日期集 (格式: 'YYYY-MM-DD' 字符串以适配时区匹配)
  const [activeDates, setActiveDates] = useState(new Set());
  
  // 当前选中的日期号数 (例如 15 号)
  const [selectedDate, setSelectedDate] = useState(null);
  // 选中日期的训练详情记录
  const [dayDetail, setDayDetail] = useState([]);

  // 2. 挂载及切换月份时加载当月训练标记
  useEffect(() => {
    fetchMonthWorkouts(currentYear, currentMonth);
  }, [currentYear, currentMonth]);

  /**
   * 按本地时区范围拉取当前月份包含训练的日期集合
   * 
   * @param {number} year 年份
   * @param {number} month 月份 (0-11)
   */
  const fetchMonthWorkouts = async (year, month) => {
    setLoadingMonth(true);
    setError(null);
    try {
      // 核心时区处理：
      // 使用本地时间的当月第一天 00:00:00 与下月第一天 00:00:00，转换为 ISO UTC 格式传输。
      // toISOString() 会自动将其转为相对于 UTC 的 ISO 字符串，但正好精确对应本地的时区界限！
      const startDate = new Date(year, month, 1, 0, 0, 0, 0).toISOString();
      const endDate = new Date(year, month + 1, 1, 0, 0, 0, 0).toISOString();

      // 查询当月时间范围内的所有记录（只 select created_at 优化性能）
      const { data, error: queryError } = await supabase
        .from('workouts')
        .select('created_at')
        .gte('created_at', startDate)
        .lt('created_at', endDate);

      if (queryError) throw queryError;

      // 建立去重集合，且转换时也必须以用户本地时间为准！
      const localDays = new Set();
      if (data) {
        data.forEach(row => {
          const dateObj = new Date(row.created_at);
          const y = dateObj.getFullYear();
          const m = String(dateObj.getMonth() + 1).padStart(2, '0');
          const d = String(dateObj.getDate()).padStart(2, '0');
          localDays.add(`${y}-${m}-${d}`);
        });
      }
      
      setActiveDates(localDays);

    } catch (err) {
      console.error('获取当月训练记录失败：', err);
      setError('无法拉取日历数据：' + err.message);
    } finally {
      setLoadingMonth(false);
    }
  };

  /**
   * 查询选中日期的本地 24 小时内的训练详情
   * 
   * @param {number} dayDate 选中的日期 (天号)
   */
  const fetchDayDetail = async (dayDate) => {
    setLoadingDetail(true);
    setError(null);
    setSelectedDate(dayDate);
    try {
      // 确立本地时间该天 00:00:00 至 23:59:59.999 的时间范围
      const dayStart = new Date(currentYear, currentMonth, dayDate, 0, 0, 0, 0).toISOString();
      const dayEnd = new Date(currentYear, currentMonth, dayDate + 1, 0, 0, 0, 0).toISOString();

      const { data, error: detailError } = await supabase
        .from('workouts')
        .select('*')
        .gte('created_at', dayStart)
        .lt('created_at', dayEnd)
        .order('created_at', { ascending: true }); // 按创建时间排序

      if (detailError) throw detailError;

      setDayDetail(data || []);

    } catch (err) {
      console.error('获取单日详情失败：', err);
      setError('拉取详情失败：' + err.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  // 3. 切换月份操作
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
    // 切换月份时重置选中详情
    setSelectedDate(null);
    setDayDetail([]);
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
    setSelectedDate(null);
    setDayDetail([]);
  };

  // 4. 构建月视图日历网格数据（周一作为第一天）
  const generateCalendarCells = () => {
    const cells = [];
    
    // 获取当月总天数
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
    // 获取当月第一天是周几
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    
    // 周日 index=0 ➔ 转换为 6；周一至周六 index-1
    const prefixEmptyCount = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
    
    // A. 填充上个月末尾的空白天数
    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = 0; i < prefixEmptyCount; i++) {
      const d = prevMonthDays - prefixEmptyCount + i + 1;
      cells.push({
        day: d,
        isCurrentMonth: false,
        dateStr: ''
      });
    }

    // B. 填充本月天数
    for (let i = 1; i <= totalDays; i++) {
      const mStr = String(currentMonth + 1).padStart(2, '0');
      const dStr = String(i).padStart(2, '0');
      cells.push({
        day: i,
        isCurrentMonth: true,
        dateStr: `${currentYear}-${mStr}-${dStr}`
      });
    }

    // C. 补齐下月开头天数，保证网格凑够 6 行共 42 个格子
    const suffixEmptyCount = 42 - cells.length;
    for (let i = 1; i <= suffixEmptyCount; i++) {
      cells.push({
        day: i,
        isCurrentMonth: false,
        dateStr: ''
      });
    }

    return cells;
  };

  // 5. 渲染页面
  const calendarCells = generateCalendarCells();
  const weekDays = ['一', '二', '三', '四', '五', '六', '日'];
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  return (
    <div className="calendar-screen">
      
      {/* 头部月份切换 */}
      <div className="calendar-header">
        <button type="button" className="month-nav-btn" onClick={handlePrevMonth} aria-label="上个月">
          <ChevronLeft size={20} />
        </button>
        <span className="current-month-label">
          {currentYear}年 {monthNames[currentMonth]}
        </span>
        <button type="button" className="month-nav-btn" onClick={handleNextMonth} aria-label="下个月">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="settings-error" style={{ marginBottom: '16px' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* 日历网格组件 */}
      <div className="calendar-body">
        {/* 周几标识 */}
        <div className="week-header-grid">
          {weekDays.map(d => (
            <span key={d} className="week-day-label">{d}</span>
          ))}
        </div>

        {/* 42个单元格 */}
        {loadingMonth ? (
          <div className="settings-loading" style={{ minHeight: '230px' }}>
            <Loader2 className="spinner" />
            <p>正在读取日历标记...</p>
          </div>
        ) : (
          <div className="calendar-grid">
            {calendarCells.map((cell, index) => {
              const hasWorkout = cell.isCurrentMonth && activeDates.has(cell.dateStr);
              const isSelected = cell.isCurrentMonth && selectedDate === cell.day;
              
              // 选中今日日期背景微亮
              const isToday = cell.isCurrentMonth &&
                today.getFullYear() === currentYear &&
                today.getMonth() === currentMonth &&
                today.getDate() === cell.day;

              return (
                <button
                  key={index}
                  type="button"
                  disabled={!cell.isCurrentMonth}
                  className={`calendar-cell ${!cell.isCurrentMonth ? 'inactive' : ''} ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                  onClick={() => cell.isCurrentMonth && fetchDayDetail(cell.day)}
                >
                  <span className="cell-num">{cell.day}</span>
                  {hasWorkout && (
                    <span className="cell-indicator" aria-label="当天有训练">🏋️</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 选中日期训练详情区域 */}
      <div className="calendar-detail-section" style={{ minHeight: '120px' }}>
        {selectedDate === null ? (
          <div className="detail-empty">
            <CalendarIcon size={28} />
            <p>点击上方含有 🏋️ 标记的日期查看训练详情</p>
          </div>
        ) : loadingDetail ? (
          <div className="settings-loading" style={{ minHeight: '100px' }}>
            <Loader2 className="spinner" />
            <p>正在拉取当日训练细节...</p>
          </div>
        ) : dayDetail.length === 0 ? (
          <div className="detail-empty">
            <p>当天没有训练记录</p>
          </div>
        ) : (
          <div className="detail-card-list">
            <h3 className="detail-title">
              {currentYear}年{currentMonth + 1}月{selectedDate}日 训练总结
            </h3>
            {dayDetail.map((log) => (
              <div key={log.id} className={`detail-card ${log.tier.toLowerCase()}-border`}>
                <div className="detail-card-head">
                  <span className="detail-card-title">{getExerciseCNName(log.exercise)}</span>
                  <span className={`tier-badge ${log.tier.toLowerCase()}`}>{log.tier}</span>
                </div>
                <div className="detail-card-body">
                  <div className="detail-item">
                    <span className="detail-label">完成负重</span>
                    <span className="detail-value">{log.weight_kg.toFixed(1)} <small>kg</small></span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">动作方案</span>
                    <span className="detail-value">
                      {log.tier === 'T1' ? (
                        log.planned_reps === 3 ? '5 组 × 3 次' :
                        log.planned_reps === 2 ? '6 组 × 2 次' : '10 组 × 1 次'
                      ) : log.tier === 'T2' ? (
                        log.planned_reps === 10 ? '3 组 × 10 次' :
                        log.planned_reps === 8 ? '3 组 × 8 次' : '3 组 × 6 次'
                      ) : '3 组 × 15 次'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">最后一组次数</span>
                    <span className="detail-value highlight">{log.actual_last_set_reps} <small>次</small></span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
    </div>
  );
}

export default CalendarScreen;

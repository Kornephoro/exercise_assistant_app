import { useState, useEffect } from 'react';
import { fetchWorkoutsForMonth, fetchWorkoutsForDay, deleteWorkouts } from './services/workoutService';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import WorkoutSessionSummary from './components/WorkoutSessionSummary';

/**
 * 训练日历页面组件 - 月视图展示已练天数与追溯每日动作详情
 * 完全采用 Tailwind CSS + DaisyUI 组件进行重构，并遵循系统高级设计规范
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
  const [toastMsg, setToastMsg] = useState(null);

  // 存当月有训练的日期集 (格式: 'YYYY-MM-DD' 字符串以适配时区匹配)
  const [activeDates, setActiveDates] = useState(new Set());

  // 当前选中的日期号数 (例如 15 号)
  const [selectedDate, setSelectedDate] = useState(null);
  // 选中日期的训练详情记录
  const [dayDetail, setDayDetail] = useState([]);

  // 删除训练记录
  const handleDeleteSession = async (session) => {
    const workoutIds = (session.exercises || []).map(ex => ex.id).filter(Boolean);
    if (workoutIds.length === 0) {
      setToastMsg({ type: 'error', text: '没有可删除的训练记录' });
      setTimeout(() => setToastMsg(null), 3000);
      return;
    }
    try {
      await deleteWorkouts(workoutIds);
      // 刷新当天的详情
      setDayDetail(prev => prev.filter(w => !workoutIds.includes(w.id)));
      // 如果当天没有其他记录了，清除选中
      const remaining = dayDetail.filter(w => !workoutIds.includes(w.id));
      if (remaining.length === 0) {
        // 从 activeDates 中移除此日期
        if (selectedDate) {
          const mStr = String(currentMonth + 1).padStart(2, '0');
          const dStr = String(selectedDate).padStart(2, '0');
          const dateStr = `${currentYear}-${mStr}-${dStr}`;
          setActiveDates(prev => {
            const next = new Set(prev);
            next.delete(dateStr);
            return next;
          });
          setSelectedDate(null);
        }
      }
      setToastMsg({ type: 'success', text: '训练记录已删除' });
      setTimeout(() => setToastMsg(null), 3000);
    } catch (err) {
      setToastMsg({ type: 'error', text: '删除失败：' + err.message });
      setTimeout(() => setToastMsg(null), 4000);
    }
  };

  /**
   * 按本地时区范围拉取当前月份包含训练的日期集合
   * 
   * @param {number} year 年份
   * @param {number} month 月份 (0-11)
   */
  const fetchMonthWorkouts = async (year, month) => {
    await Promise.resolve();
    setLoadingMonth(true);
    setError(null);
    try {
      // 核心时区处理：
      // 使用本地时间的当月第一天 00:00:00 与下月第一天 00:00:00，转换为 ISO UTC 格式传输。
      const startDate = new Date(year, month, 1, 0, 0, 0, 0).toISOString();
      const endDate = new Date(year, month + 1, 1, 0, 0, 0, 0).toISOString();

      // 查询当月时间范围内的所有记录
      const data = await fetchWorkoutsForMonth(startDate, endDate);

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

  // 2. 挂载及切换月份时加载当月训练标记
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMonthWorkouts(currentYear, currentMonth);
  }, [currentYear, currentMonth]);

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

      const data = await fetchWorkoutsForDay(dayStart, dayEnd);

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
    <div className="flex flex-col gap-6 animate-fadeIn">
      
      {/* 顶部标题 */}
      <div className="mb-1">
        <h2 className="text-2xl font-bold tracking-tight text-text-main dark:text-text-main-dark">
          训练日历
        </h2>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="alert-box !border-alert dark:!border-alert-dark !bg-bg-alert dark:!bg-bg-alert-dark !text-alert dark:!text-alert-dark flex items-center gap-2 text-xs border-l-4">
          <AlertCircle size={14} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 日历卡片容器 */}
      <div className="card">
        
        {/* 月份导航切换 */}
        <div className="flex items-center justify-between mb-4 select-none">
          <button
            type="button"
            className="btn btn-circle btn-ghost btn-sm text-text-secondary hover:text-text-main dark:text-text-secondary-dark dark:hover:text-text-main-dark"
            onClick={handlePrevMonth}
            aria-label="上个月"
          >
            <ChevronLeft size={20} />
          </button>
          
          <span className="text-base font-bold text-text-main dark:text-text-main-dark">
            {currentYear}年 {monthNames[currentMonth]}
          </span>
          
          <button
            type="button"
            className="btn btn-circle btn-ghost btn-sm text-text-secondary hover:text-text-main dark:text-text-secondary-dark dark:hover:text-text-main-dark"
            onClick={handleNextMonth}
            aria-label="下个月"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* 星期标头 */}
        <div className="grid grid-cols-7 gap-1 text-center mb-2 select-none">
          {weekDays.map(d => (
            <span key={d} className="text-sm font-bold text-text-secondary dark:text-text-secondary-dark py-1">
              {d}
            </span>
          ))}
        </div>

        {/* 42个单元格网格主体 */}
        {loadingMonth ? (
          <div className="flex flex-col items-center justify-center min-h-[230px] text-text-secondary dark:text-text-secondary-dark gap-3">
            <span className="loading loading-spinner text-primary loading-md"></span>
            <p className="text-xs font-semibold">读取日历标记...</p>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
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
                  onClick={() => cell.isCurrentMonth && fetchDayDetail(cell.day)}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all duration-150 select-none ${
                    !cell.isCurrentMonth
                      ? 'opacity-10 cursor-not-allowed pointer-events-none'
                      : 'cursor-pointer hover:bg-bg-hover dark:hover:bg-bg-hover-dark text-text-main dark:text-text-main-dark font-medium'
                  } ${
                    isSelected
                      ? 'ring-2 ring-primary bg-primary/10 font-extrabold text-primary'
                      : ''
                  } ${
                    isToday && !isSelected
                      ? 'border border-primary/50 bg-primary/5 font-bold'
                      : ''
                  }`}
                >
                  <span className="text-base font-bold">{cell.day}</span>
                  {hasWorkout && (
                    <span
                      className={`absolute bottom-1.5 w-1.5 h-1.5 rounded-full ${
                        isSelected ? 'bg-primary' : 'bg-primary/80 animate-pulse'
                      }`}
                      aria-label="当天有训练"
                    ></span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 选中日期训练详情区域 */}
      <div className="min-h-[120px] transition-all duration-300">
        {selectedDate === null ? (
          <div className="card flex flex-col items-center justify-center text-center gap-2 opacity-70">
            <CalendarIcon size={28} className="text-text-secondary/40 dark:text-text-secondary-dark/40" />
            <p className="text-xs text-text-secondary dark:text-text-secondary-dark font-medium">
              点击上方含有圆点标记的日期，查看当日的训练详情总结
            </p>
          </div>
        ) : loadingDetail ? (
          <div className="card flex flex-col items-center justify-center min-h-[120px] text-text-secondary dark:text-text-secondary-dark gap-3">
            <span className="loading loading-spinner text-primary loading-md"></span>
            <p className="text-xs font-semibold">正在拉取当日训练细节...</p>
          </div>
        ) : dayDetail.length === 0 ? (
          <div className="card text-center">
            <p className="text-xs text-text-secondary dark:text-text-secondary-dark font-medium">
              当天没有训练记录
            </p>
          </div>
        ) : (
          <WorkoutSessionSummary
            workouts={dayDetail}
            getExerciseCNName={getExerciseCNName}
            title={`${currentYear}年${currentMonth + 1}月${selectedDate}日 训练总结`}
            onDeleteSession={handleDeleteSession}
          />
        )}
      </div>

      {/* Toast 通知 */}
      {toastMsg && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-black/80 dark:bg-white/95 text-white dark:text-black text-xs font-bold px-4 py-2.5 rounded-full shadow-lg pointer-events-none animate-fadeIn flex items-center gap-1.5 border border-border-card/25 dark:border-border-card-dark/25">
          {toastMsg.type === 'success'
            ? <CheckCircle size={14} className="text-green-400" />
            : <AlertTriangle size={14} className="text-red-400" />}
          <span>{toastMsg.text}</span>
        </div>
      )}
    </div>
  );
}

export default CalendarScreen;

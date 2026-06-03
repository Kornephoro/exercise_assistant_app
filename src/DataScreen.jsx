import { useState } from 'react';
import OneRMStrength from './OneRMStrength';
import BodyMetrics from './BodyMetrics';
import CalendarScreen from './CalendarScreen';

const SUB_TABS = [
  { key: 'strength', label: '力量表现', icon: '💪' },
  { key: 'body', label: '身体记录', icon: '🩺' },
  { key: 'calendar', label: '训练日历', icon: '📅' },
];

function SubTabBar({ active, onChange }) {
  return (
    <div className="flex w-full bg-bg-card dark:bg-bg-card-dark border border-border-card dark:border-border-card-dark rounded-xl p-1 gap-1">
      {SUB_TABS.map(t => {
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 h-10 rounded-lg text-sm font-bold transition-all ${
              isActive
                ? 'bg-primary text-primary-content shadow-sm'
                : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-main dark:hover:text-text-main-dark'
            }`}
          >
            <span className="text-base">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function DataScreen({ getExerciseCNName, onLatestOneRmChange }) {
  const [subTab, setSubTab] = useState('strength');

  return (
    <div className="flex flex-col gap-5 animate-fadeIn">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-text-main dark:text-text-main-dark">数据</h2>
        <p className="text-base text-text-secondary dark:text-text-secondary-dark mt-1.5">管理并可视化您的身体状态与力量表现</p>
      </div>

      <SubTabBar active={subTab} onChange={setSubTab} />

      {subTab === 'strength' && <OneRMStrength onLatestChange={onLatestOneRmChange} />}
      {subTab === 'body' && <BodyMetrics />}
      {subTab === 'calendar' && <CalendarScreen getExerciseCNName={getExerciseCNName} />}
    </div>
  );
}

export default DataScreen;

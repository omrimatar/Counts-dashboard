import { useState, useMemo } from 'react';
import MetadataCard from './MetadataCard';
import AnalyticsPanel from './AnalyticsPanel';
import FilterPanel from './FilterPanel';
import PCUPanel from './PCUPanel';
import VolumeTimeSeries from './charts/VolumeTimeSeries';
import VehicleTypeChart from './charts/VehicleTypeChart';
import DirectionChart from './charts/DirectionChart';
import TurnBreakdownChart from './charts/TurnBreakdownChart';
import JunctionMap from './charts/JunctionMap';
import RawDataTable from './RawDataTable';
import AdvancedAnalysis from './AdvancedAnalysis';
import TurnMatrix from './TurnMatrix';
import HourlyHeatmap from './HourlyHeatmap';
import VCPanel from './VCPanel';
import { computeAnalytics } from '../utils/analytics';

const DEFAULT_FILTERS = {
  fromArms: [],
  toArms: [],
  vehicleTypeIds: [],
  timeRange: null,
  chartView: 'hourly',
};

export default function Dashboard({ data, onReset }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [activeTab, setActiveTab] = useState('overview');
  const [pcuMode, setPcuMode] = useState(false);
  const [pcuWeights, setPcuWeights] = useState({});
  const [armRenames, setArmRenames] = useState({});

  // Apply arm renames to produce effectiveData used everywhere
  const effectiveData = useMemo(() => ({
    ...data,
    arms: data.arms.map(arm => ({
      ...arm,
      name: armRenames[arm.id] || arm.name,
    })),
  }), [data, armRenames]);

  const hasToArm = useMemo(
    () => effectiveData.movements.some(m => m.toArm !== null),
    [effectiveData.movements]
  );

  const analytics = useMemo(
    () => computeAnalytics(effectiveData, filters, pcuMode ? pcuWeights : null),
    [effectiveData, filters, pcuMode, pcuWeights]
  );

  const handlePCUChange = (mode, weights) => {
    setPcuMode(mode);
    setPcuWeights(weights);
  };

  const handleRenameArm = (armId, newName) => {
    setArmRenames(prev => ({ ...prev, [armId]: newName }));
  };

  const TABS = [
    { id: 'overview',  label: 'Overview' },
    { id: 'junction',  label: 'Junction' },
    { id: 'advanced',  label: 'Advanced' },
    { id: 'data',      label: 'Data Table' },
  ];

  const noData = analytics && analytics.grandTotal === 0;

  return (
    <div className="dashboard">
      {/* Top bar */}
      <div className="dash-topbar">
        <span className="dash-filename">{effectiveData.meta.fileName}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" onClick={() => window.print()}>🖨 Print</button>
          <button className="btn-ghost" onClick={onReset}>← Load another file</button>
        </div>
      </div>

      {/* Always-visible: Filter + PCU */}
      <FilterPanel
        arms={effectiveData.arms}
        vehicleTypes={effectiveData.vehicleTypes}
        filters={filters}
        onChange={setFilters}
        dataStartTime={effectiveData.meta.startTime}
        dataEndTime={effectiveData.meta.endTime}
        hasToArm={hasToArm}
        onDisablePCU={() => { setPcuMode(false); setPcuWeights({}); }}
      />

      <PCUPanel
        vehicleTypes={effectiveData.vehicleTypes}
        pcuMode={pcuMode}
        pcuWeights={pcuWeights}
        onChange={handlePCUChange}
      />

      {/* No-data warning */}
      {noData && (
        <div className="no-data-banner">
          No data matches the current filters. Try adjusting the time range, arms, or vehicle types.
        </div>
      )}

      {/* Tab bar */}
      <div className="tab-bar">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="tab-content">
        {activeTab === 'overview' && (
          <>
            <MetadataCard
              meta={effectiveData.meta}
              arms={effectiveData.arms}
              filters={filters}
              armRenames={armRenames}
              onRenameArm={handleRenameArm}
            />
            <AnalyticsPanel analytics={analytics} pcuMode={pcuMode} />
            <div className="charts-grid">
              <div className="chart-full">
                <VolumeTimeSeries analytics={analytics} chartView={filters.chartView} />
              </div>
              <VehicleTypeChart analytics={analytics} />
            </div>
          </>
        )}

        {activeTab === 'junction' && (
          <>
            <div className="charts-grid">
              <DirectionChart analytics={analytics} />
              <TurnBreakdownChart analytics={analytics} />
            </div>
            {hasToArm && (
              <TurnMatrix
                data={effectiveData}
                analytics={analytics}
                filters={filters}
                pcuWeights={pcuMode ? pcuWeights : null}
              />
            )}
            <JunctionMap
              data={effectiveData}
              analytics={analytics}
              filters={filters}
              pcuWeights={pcuMode ? pcuWeights : null}
            />
          </>
        )}

        {activeTab === 'advanced' && (
          <>
            <AdvancedAnalysis analytics={analytics} />
            <HourlyHeatmap analytics={analytics} />
            <VCPanel analytics={analytics} arms={effectiveData.arms} />
          </>
        )}

        {activeTab === 'data' && (
          <RawDataTable
            data={effectiveData}
            filters={filters}
            pcuWeights={pcuMode ? pcuWeights : null}
          />
        )}
      </div>
    </div>
  );
}

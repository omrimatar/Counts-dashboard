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

  const hasToArm = useMemo(
    () => data.movements.some(m => m.toArm !== null),
    [data.movements]
  );

  const analytics = useMemo(
    () => computeAnalytics(data, filters, pcuMode ? pcuWeights : null),
    [data, filters, pcuMode, pcuWeights]
  );

  const handlePCUChange = (mode, weights) => {
    setPcuMode(mode);
    setPcuWeights(weights);
  };

  const TABS = [
    { id: 'overview',  label: 'Overview' },
    { id: 'junction',  label: 'Junction' },
    { id: 'advanced',  label: 'Advanced' },
    { id: 'data',      label: 'Data Table' },
  ];

  return (
    <div className="dashboard">
      {/* Top bar */}
      <div className="dash-topbar">
        <span className="dash-filename">{data.meta.fileName}</span>
        <button className="btn-ghost" onClick={onReset}>← Load another file</button>
      </div>

      {/* Always-visible: Filter + PCU */}
      <FilterPanel
        arms={data.arms}
        vehicleTypes={data.vehicleTypes}
        filters={filters}
        onChange={setFilters}
        dataStartTime={data.meta.startTime}
        dataEndTime={data.meta.endTime}
        hasToArm={hasToArm}
        onDisablePCU={() => { setPcuMode(false); setPcuWeights({}); }}
      />

      <PCUPanel
        vehicleTypes={data.vehicleTypes}
        pcuMode={pcuMode}
        pcuWeights={pcuWeights}
        onChange={handlePCUChange}
      />

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
            <MetadataCard meta={data.meta} arms={data.arms} />
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
            <JunctionMap
              data={data}
              analytics={analytics}
              filters={filters}
              pcuWeights={pcuMode ? pcuWeights : null}
            />
          </>
        )}

        {activeTab === 'advanced' && (
          <AdvancedAnalysis analytics={analytics} />
        )}

        {activeTab === 'data' && (
          <RawDataTable
            data={data}
            filters={filters}
            pcuWeights={pcuMode ? pcuWeights : null}
          />
        )}
      </div>
    </div>
  );
}

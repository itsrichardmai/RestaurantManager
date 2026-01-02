import { useState } from 'react'
import PropTypes from 'prop-types'
import WorkerManager from './WorkerManager'
import ShiftConfig from './ShiftConfig'
import ScheduleGenerator from './ScheduleGenerator'
import ScheduleView from './ScheduleView'
import { getWeekStart, formatWeekDate, getWeekEnd } from '../utils/scheduler'

export default function Scheduler({ businessId, businessName }) {
  const [refreshSchedule, setRefreshSchedule] = useState(0)
  const [selectedWeekOffset, setSelectedWeekOffset] = useState(0)

  const selectedWeekStart = getWeekStart(selectedWeekOffset)
  const selectedWeekEnd = getWeekEnd(selectedWeekStart)

  const weekOptions = [
    { offset: 0, label: 'This Week' },
    { offset: 1, label: 'Next Week' },
  ]

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800">{businessName}</h2>
        <p className="text-gray-500">Shift Scheduler</p>
      </div>

      <WorkerManager businessId={businessId} selectedWeekStart={selectedWeekStart} />
      <ShiftConfig businessId={businessId} />

      {/* Week Selector */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Schedule Week</h2>
          <p className="text-gray-500">Select which week to generate or view the schedule for</p>
        </div>

        <div className="flex flex-wrap justify-center gap-8" style={{ marginBottom: '60px' }}>
          {weekOptions.map(option => (
            <button
              key={option.offset}
              onClick={() => setSelectedWeekOffset(option.offset)}
              className={`px-5 py-3 rounded-lg font-medium transition-all duration-200 ${
                selectedWeekOffset === option.offset
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="text-center" style={{ marginBottom: '20px' }}>
          <div className="inline-flex items-center gap-3 bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-3 rounded-full border border-blue-200">
            <span className="text-blue-600 font-semibold">
              {formatWeekDate(selectedWeekStart)}
            </span>
            <span className="text-gray-400">—</span>
            <span className="text-blue-600 font-semibold">
              {formatWeekDate(selectedWeekEnd)}
            </span>
          </div>
        </div>
      </div>

      <ScheduleGenerator
        businessId={businessId}
        selectedWeekStart={selectedWeekStart}
        onScheduleGenerated={() => setRefreshSchedule(r => r + 1)}
      />
      <ScheduleView
        businessId={businessId}
        selectedWeekStart={selectedWeekStart}
        refreshTrigger={refreshSchedule}
      />
    </div>
  )
}

Scheduler.propTypes = {
  businessId: PropTypes.number.isRequired,
  businessName: PropTypes.string.isRequired
}

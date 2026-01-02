import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { supabase } from '../supabaseClient'
import { generateSchedule, formatWeekDate } from '../utils/scheduler'

export default function ScheduleGenerator({ businessId, selectedWeekStart, onScheduleGenerated }) {
  const [workers, setWorkers] = useState([])
  const [shifts, setShifts] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function fetchData() {
    const [workersRes, shiftsRes, rolesRes] = await Promise.all([
      supabase.from('workers').select('*').eq('business_id', businessId),
      supabase.from('shift_requirements').select('*').eq('business_id', businessId),
      supabase.from('roles').select('*').eq('business_id', businessId)
    ])

    if (workersRes.data) setWorkers(workersRes.data)
    if (shiftsRes.data) setShifts(shiftsRes.data)
    if (rolesRes.data) setRoles(rolesRes.data)
  }

  useEffect(() => {
    // Data fetching on mount is a valid use case for setState in useEffect
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData()
  }, [businessId])

  async function handleGenerate() {
    setLoading(true)
    setMessage('')

    // Delete existing schedule for this week and business
    await supabase
      .from('schedule_assignments')
      .delete()
      .eq('business_id', businessId)
      .eq('week_start_date', selectedWeekStart)

    // Generate new schedule
    const { assignments, warnings } = generateSchedule(workers, shifts, selectedWeekStart, roles)

    // Save to database (only if there are assignments)
    if (assignments.length > 0) {
      const assignmentsToInsert = assignments.map(assignment => ({
        business_id: businessId,
        worker_id: assignment.worker_id,
        day_of_week: assignment.day_of_week,
        shift_name: assignment.shift_name,
        week_start_date: assignment.week_start_date
      }))

      const { error } = await supabase
        .from('schedule_assignments')
        .insert(assignmentsToInsert)

      if (error) {
        setMessage('Error generating schedule: ' + error.message)
        setLoading(false)
        return
      }
    }

    let msg = `Schedule generated for week of ${formatWeekDate(selectedWeekStart)}!\n${assignments.length} shifts assigned.`
    if (warnings.length > 0) {
      msg += '\n\nWarnings:\n' + warnings.join('\n')
    }
    setMessage(msg)
    onScheduleGenerated() // Trigger parent to refresh

    setLoading(false)
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
      <div className="flex flex-col items-center text-center gap-4" style={{ marginBottom: '20px' }}>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Generate Schedule</h2>
          <p className="text-gray-500 mt-1">
            Create schedule for week of <span className="font-semibold text-blue-600">{formatWeekDate(selectedWeekStart)}</span>
          </p>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || workers.length === 0}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-3 rounded-lg font-semibold shadow-md hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-400 transition-all duration-200"
        >
          {loading ? 'Generating...' : 'Generate Schedule'}
        </button>
      </div>

      {message && (
        <pre className="mt-4 p-4 bg-white border border-gray-200 rounded-lg whitespace-pre-wrap text-sm">
          {message}
        </pre>
      )}
    </div>
  )
}

ScheduleGenerator.propTypes = {
  businessId: PropTypes.number.isRequired,
  selectedWeekStart: PropTypes.string.isRequired,
  onScheduleGenerated: PropTypes.func.isRequired
}

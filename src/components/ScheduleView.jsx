import { useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import { supabase } from '../supabaseClient'
import { formatTime, formatWeekDate } from '../utils/scheduler'

export default function ScheduleView({ businessId, selectedWeekStart, refreshTrigger }) {
  const [schedule, setSchedule] = useState([])
  const [workers, setWorkers] = useState({})
  const [allWorkers, setAllWorkers] = useState([])
  const [shiftRequirements, setShiftRequirements] = useState([])
  const [roles, setRoles] = useState([])
  const [shiftNotes, setShiftNotes] = useState({}) // { "day_shiftName": { id, note } }
  const [addingToShift, setAddingToShift] = useState(null) // { day, shiftName }
  const [editingNote, setEditingNote] = useState(null) // { day, shiftName }
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

  const fetchSchedule = useCallback(async () => {
    // Fetch schedule, workers, shift requirements, roles, and notes
    const [scheduleRes, workersRes, shiftsRes, rolesRes, notesRes] = await Promise.all([
      supabase
        .from('schedule_assignments')
        .select('*')
        .eq('business_id', businessId)
        .eq('week_start_date', selectedWeekStart),
      supabase.from('workers').select('*').eq('business_id', businessId),
      supabase.from('shift_requirements').select('*').eq('business_id', businessId),
      supabase.from('roles').select('*').eq('business_id', businessId),
      supabase
        .from('shift_notes')
        .select('*')
        .eq('business_id', businessId)
        .eq('week_start_date', selectedWeekStart)
    ])

    if (scheduleRes.data) setSchedule(scheduleRes.data)
    if (shiftsRes.data) setShiftRequirements(shiftsRes.data)
    if (rolesRes.data) setRoles(rolesRes.data)

    // Build notes lookup
    if (notesRes.data) {
      const notesMap = {}
      notesRes.data.forEach(note => {
        notesMap[`${note.day_of_week}_${note.shift_name}`] = note
      })
      setShiftNotes(notesMap)
    }

    // Create worker lookup map and store all workers
    if (workersRes.data) {
      setAllWorkers(workersRes.data)
      const workerMap = {}
      workersRes.data.forEach(worker => workerMap[worker.id] = worker)
      setWorkers(workerMap)
    }
  }, [businessId, selectedWeekStart])

  useEffect(() => {
    // Data fetching on dependency change is a valid use case for setState in useEffect
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSchedule()
  }, [refreshTrigger, fetchSchedule])

  // Get the date for a specific day of the week
  function getDateForDay(dayIndex) {
    const weekStart = new Date(selectedWeekStart + 'T00:00:00')
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + dayIndex)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  function getShiftsForDay(day) {
    return shiftRequirements
      .filter(shift => shift.day_of_week === day)
      .sort((a, b) => a.shift_name === 'day' ? -1 : 1) // Day shift first
  }

  // Check if a worker is a manager
  function checkIsManager(worker) {
    if (!worker) return false
    // Check legacy is_manager field first
    if (worker.is_manager === true) return true
    // Then check role
    if (roles.length > 0 && worker.role_id) {
      const role = roles.find(r => r.id === worker.role_id)
      if (role?.is_manager === true) return true
    }
    return false
  }

  function getWorkersForShift(day, shiftName) {
    const shiftWorkers = schedule
      .filter(assignment => assignment.day_of_week === day && assignment.shift_name === shiftName)
      .map(assignment => ({
        ...workers[assignment.worker_id],
        assignmentId: assignment.id
      }))
      .filter(worker => worker && worker.id) // Filter out undefined workers

    // Sort: managers first, then by skill level, then alphabetically
    const sorted = [...shiftWorkers].sort((a, b) => {
      const aIsManager = checkIsManager(a)
      const bIsManager = checkIsManager(b)

      // Managers always first
      if (aIsManager && !bIsManager) return -1
      if (!aIsManager && bIsManager) return 1

      // Then by skill level (higher first)
      const aSkill = a.skill_level || 0
      const bSkill = b.skill_level || 0
      if (bSkill !== aSkill) return bSkill - aSkill

      // Then alphabetically by name
      return (a.name || '').localeCompare(b.name || '')
    })

    return sorted
  }

  // Get role name for a worker
  function getWorkerRoleName(worker) {
    if (!roles.length) return worker.is_manager ? 'Manager' : 'Worker'
    const role = roles.find(r => r.id === worker.role_id)
    return role ? role.name : 'Unassigned'
  }

  // Check if worker's role is manager type (reuse checkIsManager)
  function isManagerRole(worker) {
    return checkIsManager(worker)
  }

  // Remove a worker from a shift
  async function removeFromShift(assignmentId) {
    const { error } = await supabase
      .from('schedule_assignments')
      .delete()
      .eq('id', assignmentId)

    if (error) {
      console.error('Error removing assignment:', error)
    } else {
      setSchedule(schedule.filter(s => s.id !== assignmentId))
    }
  }

  // Add a worker to a shift
  async function addToShift(workerId, day, shiftName) {
    // Check if worker is already assigned to this shift
    const existing = schedule.find(
      s => s.worker_id === workerId && s.day_of_week === day && s.shift_name === shiftName
    )
    if (existing) {
      setAddingToShift(null)
      return
    }

    const { data, error } = await supabase
      .from('schedule_assignments')
      .insert([{
        business_id: businessId,
        worker_id: workerId,
        day_of_week: day,
        shift_name: shiftName,
        week_start_date: selectedWeekStart
      }])
      .select()

    if (error) {
      console.error('Error adding assignment:', error)
    } else if (data) {
      setSchedule([...schedule, data[0]])
    }
    setAddingToShift(null)
  }

  // Get workers available to add (not already assigned to this shift)
  function getAvailableWorkersForShift(day, shiftName) {
    const assignedWorkerIds = schedule
      .filter(s => s.day_of_week === day && s.shift_name === shiftName)
      .map(s => s.worker_id)

    return allWorkers.filter(w => !assignedWorkerIds.includes(w.id))
  }

  // Get note for a shift
  function getShiftNote(day, shiftName) {
    const key = `${day}_${shiftName}`
    return shiftNotes[key]?.note || ''
  }

  // Save or update note for a shift
  async function saveNote(day, shiftName, noteText) {
    const key = `${day}_${shiftName}`
    const existingNote = shiftNotes[key]

    if (noteText.trim() === '') {
      // Delete note if empty
      if (existingNote) {
        await supabase.from('shift_notes').delete().eq('id', existingNote.id)
        const newNotes = { ...shiftNotes }
        delete newNotes[key]
        setShiftNotes(newNotes)
      }
    } else if (existingNote) {
      // Update existing note
      const { error } = await supabase
        .from('shift_notes')
        .update({ note: noteText })
        .eq('id', existingNote.id)

      if (!error) {
        setShiftNotes({
          ...shiftNotes,
          [key]: { ...existingNote, note: noteText }
        })
      }
    } else {
      // Create new note
      const { data, error } = await supabase
        .from('shift_notes')
        .insert([{
          business_id: businessId,
          day_of_week: day,
          shift_name: shiftName,
          week_start_date: selectedWeekStart,
          note: noteText
        }])
        .select()

      if (!error && data) {
        setShiftNotes({
          ...shiftNotes,
          [key]: data[0]
        })
      }
    }
    setEditingNote(null)
  }

  // Get consistent color for each role based on position in roles array
  function getRoleColor(worker) {
    const role = roles.find(r => r.id === worker.role_id)
    const isManager = role?.is_manager === true || worker.is_manager === true

    // Managers are always blue
    if (isManager) {
      return { bg: 'bg-blue-200', text: 'text-blue-800', border: 'border-blue-300' }
    }

    // Color palette for non-manager roles (distinct, easy to tell apart)
    const roleColors = [
      { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
      { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
      { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
      { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-300' },
      { bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-300' },
      { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-300' },
      { bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-300' },
      { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
    ]

    // Get non-manager roles sorted by name for consistent ordering
    const nonManagerRoles = roles
      .filter(r => !r.is_manager)
      .sort((a, b) => a.name.localeCompare(b.name))

    // Find the index of this role in the sorted list
    const roleIndex = nonManagerRoles.findIndex(r => r.id === worker.role_id)

    if (roleIndex >= 0) {
      return roleColors[roleIndex % roleColors.length]
    }

    // Fallback for unassigned
    return { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Weekly Schedule</h2>
        <p className="text-gray-500 mt-1">Week of <span className="font-semibold text-blue-600">{formatWeekDate(selectedWeekStart)}</span></p>
      </div>

      {schedule.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <div className="text-5xl mb-4">📅</div>
          <p className="text-lg">No schedule generated yet.</p>
          <p className="text-sm">Click &quot;Generate Schedule&quot; above to create one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-3">
          {days.map((day, dayIndex) => {
            const dayShifts = getShiftsForDay(day)
            return (
              <div key={day} className="border border-gray-200 rounded-xl bg-gray-50 overflow-hidden">
                <div className="bg-gradient-to-r from-gray-100 to-gray-50 py-3 border-b border-gray-200 text-center">
                  <h3 className="font-bold capitalize text-gray-700">
                    {day.slice(0, 3)}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">{getDateForDay(dayIndex)}</p>
                </div>
                <div className="p-2 space-y-3">
                  {dayShifts.length === 0 ? (
                    <div className="text-gray-400 text-sm italic text-center py-4">No shifts</div>
                  ) : (
                    dayShifts.map(shift => {
                      const shiftWorkers = getWorkersForShift(day, shift.shift_name)
                      return (
                        <div key={shift.id} className={`rounded-lg overflow-hidden ${shift.shift_name === 'day' ? 'bg-amber-50 border border-amber-200' : 'bg-indigo-50 border border-indigo-200'}`}>
                          <div className={`text-xs font-semibold px-3 py-2 ${shift.shift_name === 'day' ? 'bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-800' : 'bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-800'}`}>
                            {shift.shift_name === 'day' ? '☀️' : '🌙'} {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                          </div>
                          <div className="p-2">
                            {/* Workers by Role */}
                            {shiftWorkers.length > 0 ? (
                              <div className="space-y-1.5">
                                {shiftWorkers.map(worker => {
                                  const roleName = getWorkerRoleName(worker)
                                  const roleColor = getRoleColor(worker)
                                  return (
                                    <div
                                      key={worker.assignmentId}
                                      className={`flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-medium border ${roleColor.bg} ${roleColor.text} ${roleColor.border}`}
                                    >
                                      <div className="flex flex-col truncate">
                                        <span className="font-medium">{worker.name}</span>
                                        <span className="text-[10px] opacity-70">{roleName}</span>
                                      </div>
                                      <button
                                        onClick={() => removeFromShift(worker.assignmentId)}
                                        className="ml-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded px-1"
                                        title="Remove from shift"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  )
                                })}
                              </div>
                            ) : (
                              <div className="text-gray-400 text-xs italic text-center py-2">No workers</div>
                            )}

                            {/* Add Worker Button/Dropdown */}
                            {addingToShift?.day === day && addingToShift?.shiftName === shift.shift_name ? (
                              <div className="mt-2">
                                <select
                                  autoFocus
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      addToShift(parseInt(e.target.value), day, shift.shift_name)
                                    }
                                  }}
                                  onBlur={() => setAddingToShift(null)}
                                  className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                                >
                                  <option value="">Select worker...</option>
                                  {getAvailableWorkersForShift(day, shift.shift_name).map(worker => (
                                    <option key={worker.id} value={worker.id}>
                                      {worker.name} ({getWorkerRoleName(worker)})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : (
                              <button
                                onClick={() => setAddingToShift({ day, shiftName: shift.shift_name })}
                                className="mt-2 w-full text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 border border-dashed border-gray-300 hover:border-blue-400 rounded py-1 transition-colors"
                              >
                                + Add Worker
                              </button>
                            )}

                            {/* Notes Section */}
                            {editingNote?.day === day && editingNote?.shiftName === shift.shift_name ? (
                              <div className="mt-2">
                                <textarea
                                  autoFocus
                                  defaultValue={getShiftNote(day, shift.shift_name)}
                                  placeholder="Add a note..."
                                  className="w-full text-xs border border-gray-300 rounded px-2 py-1 resize-none"
                                  rows={2}
                                  onBlur={(e) => saveNote(day, shift.shift_name, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault()
                                      saveNote(day, shift.shift_name, e.target.value)
                                    }
                                    if (e.key === 'Escape') {
                                      setEditingNote(null)
                                    }
                                  }}
                                />
                              </div>
                            ) : getShiftNote(day, shift.shift_name) ? (
                              <div
                                onClick={() => setEditingNote({ day, shiftName: shift.shift_name })}
                                className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800 cursor-pointer hover:bg-yellow-100"
                                title="Click to edit note"
                              >
                                {getShiftNote(day, shift.shift_name)}
                              </div>
                            ) : (
                              <button
                                onClick={() => setEditingNote({ day, shiftName: shift.shift_name })}
                                className="mt-1 w-full text-xs text-gray-400 hover:text-yellow-600 transition-colors"
                              >
                                + Add note
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

ScheduleView.propTypes = {
  businessId: PropTypes.number.isRequired,
  selectedWeekStart: PropTypes.string.isRequired,
  refreshTrigger: PropTypes.number
}

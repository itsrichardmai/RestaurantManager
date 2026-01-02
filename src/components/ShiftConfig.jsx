import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { supabase } from '../supabaseClient'

export default function ShiftConfig({ businessId }) {
  const [shifts, setShifts] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(false)
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const shiftTypes = ['day', 'night']

  async function fetchShifts() {
    const [shiftsRes, rolesRes] = await Promise.all([
      supabase.from('shift_requirements').select('*').eq('business_id', businessId).order('day_of_week').order('shift_name'),
      supabase.from('roles').select('*').eq('business_id', businessId).order('is_manager', { ascending: false }).order('name')
    ])

    if (shiftsRes.error) console.error('Error fetching shifts:', shiftsRes.error)
    else setShifts(shiftsRes.data || [])

    if (rolesRes.data) setRoles(rolesRes.data)
  }

  useEffect(() => {
    // Data fetching on mount is a valid use case for setState in useEffect
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchShifts()
  }, [businessId])

  async function updateShift(shiftId, field, value) {
    const { error } = await supabase
      .from('shift_requirements')
      .update({ [field]: value })
      .eq('id', shiftId)

    if (error) {
      console.error('Error updating shift:', error)
    } else {
      setShifts(shifts.map(shift =>
        shift.id === shiftId ? { ...shift, [field]: value } : shift
      ))
    }
  }

  // Update role requirement for a shift
  async function updateRoleRequirement(shiftId, roleName, count) {
    const shift = shifts.find(s => s.id === shiftId)
    const currentReqs = shift.role_requirements || {}
    const newReqs = { ...currentReqs, [roleName]: count }

    // Remove roles with 0 count
    if (count === 0) {
      delete newReqs[roleName]
    }

    const { error } = await supabase
      .from('shift_requirements')
      .update({ role_requirements: newReqs })
      .eq('id', shiftId)

    if (error) {
      console.error('Error updating role requirement:', error)
    } else {
      setShifts(shifts.map(s =>
        s.id === shiftId ? { ...s, role_requirements: newReqs } : s
      ))
    }
  }

  // Get role requirement count
  function getRoleCount(shift, roleName) {
    return shift.role_requirements?.[roleName] || 0
  }

  // Get role color based on type
  function getRoleColor(role) {
    if (role.is_manager) return { bg: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-700' }
    // Use different colors for different roles
    const colors = [
      { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-700' },
      { bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-700' },
      { bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-700' },
      { bg: 'bg-pink-100', border: 'border-pink-300', text: 'text-pink-700' },
      { bg: 'bg-cyan-100', border: 'border-cyan-300', text: 'text-cyan-700' },
    ]
    const index = roles.filter(r => !r.is_manager).indexOf(role) % colors.length
    return colors[index >= 0 ? index : 0]
  }

  async function addShift(day, shiftName) {
    setLoading(true)
    // Create default role requirements based on available roles
    const defaultRoleReqs = {}
    const managerRole = roles.find(r => r.is_manager)
    if (managerRole) defaultRoleReqs[managerRole.name] = 1
    const firstNonManagerRole = roles.find(r => !r.is_manager)
    if (firstNonManagerRole) defaultRoleReqs[firstNonManagerRole.name] = 2

    const { data, error } = await supabase
      .from('shift_requirements')
      .insert([{
        business_id: businessId,
        day_of_week: day,
        shift_name: shiftName,
        start_time: shiftName === 'day' ? '09:00' : '17:00',
        end_time: shiftName === 'day' ? '17:00' : '23:00',
        role_requirements: defaultRoleReqs
      }])
      .select()

    if (error) {
      console.error('Error adding shift:', error)
    } else if (data) {
      setShifts([...shifts, data[0]])
    }
    setLoading(false)
  }

  async function deleteShift(shiftId) {
    const { error } = await supabase
      .from('shift_requirements')
      .delete()
      .eq('id', shiftId)

    if (error) {
      console.error('Error deleting shift:', error)
    } else {
      setShifts(shifts.filter(shift => shift.id !== shiftId))
    }
  }

  function getShiftsForDay(day) {
    return shifts
      .filter(shift => shift.day_of_week === day)
      .sort((a, b) => a.shift_name === 'day' ? -1 : 1) // Day shift first
  }

  function formatTime(time) {
    if (!time) return ''
    return time.substring(0, 5)
  }

  return (
    <div className="p-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Shift Requirements</h2>
        <p className="text-gray-500">Configure shifts for each day with times, managers and workers</p>
      </div>

      <div className="space-y-6">
        {days.map(day => {
          const dayShifts = getShiftsForDay(day)
          const existingShiftNames = dayShifts.map(shift => shift.shift_name)
          const availableShifts = shiftTypes.filter(type => !existingShiftNames.includes(type))

          return (
            <div key={day} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="flex justify-between items-center px-6 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                <h3 className="text-xl font-semibold text-gray-700 capitalize">{day}</h3>
                {availableShifts.length > 0 && (
                  <div className="flex gap-3">
                    {availableShifts.map(shiftType => (
                      <button
                        key={shiftType}
                        onClick={() => addShift(day, shiftType)}
                        disabled={loading}
                        className="text-sm bg-gradient-to-r from-emerald-500 to-green-500 text-white px-4 py-2 rounded-lg font-medium shadow-sm hover:from-emerald-600 hover:to-green-600 disabled:from-gray-400 disabled:to-gray-400 transition-all duration-200"
                      >
                        + Add {shiftType} shift
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4">
                {dayShifts.length === 0 ? (
                  <p className="text-gray-400 italic text-center py-4">No shifts configured</p>
                ) : (
                  <div className="space-y-4">
                    {dayShifts.map(shift => (
                      <div
                        key={shift.id}
                        className={`rounded-xl p-5 ${
                          shift.shift_name === 'day'
                            ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200'
                            : 'bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200'
                        }`}
                      >
                        <div className="flex items-center justify-center" style={{ gap: '40px' }}>
                          {/* Shift Type Badge */}
                          <div className={`flex items-center px-4 py-2 rounded-full font-semibold ${
                            shift.shift_name === 'day'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-indigo-100 text-indigo-700'
                          }`} style={{ marginRight: '20px', width: '100px', justifyContent: 'center' }}>
                            <span className="text-lg">{shift.shift_name === 'day' ? '☀️' : '🌙'}</span>
                            <span className="uppercase tracking-wide text-sm" style={{ marginLeft: '8px' }}>{shift.shift_name}</span>
                          </div>

                          {/* Start Time */}
                          <div className="flex flex-col items-center" style={{ marginRight: '20px' }}>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Start</label>
                            <input
                              type="time"
                              value={formatTime(shift.start_time)}
                              onChange={(event) => updateShift(shift.id, 'start_time', event.target.value)}
                              className="border border-gray-300 rounded-lg px-3 py-2 text-center font-medium bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            />
                          </div>

                          {/* End Time */}
                          <div className="flex flex-col items-center" style={{ marginRight: '40px' }}>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">End</label>
                            <input
                              type="time"
                              value={formatTime(shift.end_time)}
                              onChange={(event) => updateShift(shift.id, 'end_time', event.target.value)}
                              className="border border-gray-300 rounded-lg px-3 py-2 text-center font-medium bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            />
                          </div>

                          {/* Role Requirements */}
                          {roles.map(role => {
                            const colors = getRoleColor(role)
                            return (
                              <div key={role.id} className={`flex flex-col items-center px-5 py-2 ${colors.bg} rounded-lg`} style={{ marginRight: '20px' }}>
                                <label className={`text-xs font-bold ${colors.text} uppercase tracking-wide mb-2`}>{role.name}</label>
                                <input
                                  type="number"
                                  min="0"
                                  max="20"
                                  value={getRoleCount(shift, role.name)}
                                  onChange={(event) => updateRoleRequirement(shift.id, role.name, parseInt(event.target.value) || 0)}
                                  className={`w-14 border-2 ${colors.border} rounded-lg px-2 py-2 text-center font-bold ${colors.text} bg-white shadow-sm focus:ring-2 focus:outline-none transition-all`}
                                />
                              </div>
                            )
                          })}

                          {/* Remove Button */}
                          <button
                            onClick={() => deleteShift(shift.id)}
                            className="px-4 py-2 text-red-500 hover:text-white hover:bg-red-500 border border-red-300 rounded-lg text-sm font-medium transition-all duration-200"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

ShiftConfig.propTypes = {
  businessId: PropTypes.number.isRequired
}

import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { supabase } from '../supabaseClient'

export default function WorkerManager({ businessId, selectedWeekStart }) {
  const [workers, setWorkers] = useState([])
  const [scheduleAssignments, setScheduleAssignments] = useState([])
  const [shiftRequirements, setShiftRequirements] = useState([])
  const [roles, setRoles] = useState([])
  const [newRoleName, setNewRoleName] = useState('')
  const [showRoleManager, setShowRoleManager] = useState(false)
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [bulkImportText, setBulkImportText] = useState('')
  const [bulkImportStatus, setBulkImportStatus] = useState({ message: '', type: '' })
  const [newWorker, setNewWorker] = useState({
    name: '',
    skill_level: 3,
    role_id: null,
    monday_day: true,
    monday_night: true,
    tuesday_day: true,
    tuesday_night: true,
    wednesday_day: true,
    wednesday_night: true,
    thursday_day: true,
    thursday_night: true,
    friday_day: true,
    friday_night: true,
    saturday_day: true,
    saturday_night: true,
    sunday_day: true,
    sunday_night: true
  })

  // Fetch workers, schedule assignments, shift requirements, and roles
  async function fetchData() {
    const [workersRes, assignmentsRes, shiftsRes, rolesRes] = await Promise.all([
      supabase.from('workers').select('*').eq('business_id', businessId),
      supabase.from('schedule_assignments').select('*').eq('business_id', businessId).eq('week_start_date', selectedWeekStart),
      supabase.from('shift_requirements').select('*').eq('business_id', businessId),
      supabase.from('roles').select('*').eq('business_id', businessId).order('is_manager', { ascending: false }).order('name')
    ])

    if (workersRes.error) console.error('Error fetching workers:', workersRes.error)
    else setWorkers(workersRes.data || [])

    if (assignmentsRes.data) setScheduleAssignments(assignmentsRes.data)
    if (shiftsRes.data) setShiftRequirements(shiftsRes.data)
    if (rolesRes.data) {
      setRoles(rolesRes.data)
      // Set default role for new worker if not set
      if (!newWorker.role_id && rolesRes.data.length > 0) {
        const defaultRole = rolesRes.data.find(r => !r.is_manager) || rolesRes.data[0]
        setNewWorker(prev => ({ ...prev, role_id: defaultRole.id }))
      }
    }
  }

  useEffect(() => {
    // Data fetching on mount is a valid use case for setState in useEffect
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData()
  }, [businessId, selectedWeekStart])

  // Calculate total hours for a worker based on their schedule assignments
  function calculateTotalHours(workerId) {
    const workerAssignments = scheduleAssignments.filter(assignment => assignment.worker_id === workerId)

    let totalMinutes = 0
    workerAssignments.forEach(assignment => {
      const shiftReq = shiftRequirements.find(
        shift => shift.day_of_week === assignment.day_of_week && shift.shift_name === assignment.shift_name
      )
      if (shiftReq && shiftReq.start_time && shiftReq.end_time) {
        const startParts = shiftReq.start_time.split(':')
        const endParts = shiftReq.end_time.split(':')
        const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1])
        let endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1])

        // Handle overnight shifts (end time is next day)
        if (endMinutes <= startMinutes) {
          endMinutes += 24 * 60 // Add 24 hours
        }

        totalMinutes += endMinutes - startMinutes
      }
    })

    if (totalMinutes === 0) return '0h'

    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }

  // Sort workers: managers first, then by skill level (descending), then by name
  function getSortedWorkers() {
    return [...workers].sort((a, b) => {
      const aIsManager = isManagerRole(a.role_id)
      const bIsManager = isManagerRole(b.role_id)
      if (aIsManager && !bIsManager) return -1
      if (!aIsManager && bIsManager) return 1
      if (b.skill_level !== a.skill_level) return b.skill_level - a.skill_level
      return a.name.localeCompare(b.name)
    })
  }

  // Add worker
  async function addWorker(event) {
    event.preventDefault()

    const { data, error } = await supabase
      .from('workers')
      .insert([{ ...newWorker, business_id: businessId }])
      .select()

    if (error) {
      console.error('Error adding worker:', error)
    } else {
      setWorkers([...workers, data[0]])
      // Reset form
      setNewWorker({
        name: '',
        skill_level: 3,
        is_manager: false,
        monday_day: true, monday_night: true,
        tuesday_day: true, tuesday_night: true,
        wednesday_day: true, wednesday_night: true,
        thursday_day: true, thursday_night: true,
        friday_day: true, friday_night: true,
        saturday_day: true, saturday_night: true,
        sunday_day: true, sunday_night: true
      })
    }
  }

  // Delete worker
  async function deleteWorker(id) {
    const { error } = await supabase
      .from('workers')
      .delete()
      .eq('id', id)

    if (error) console.error('Error deleting worker:', error)
    else setWorkers(workers.filter(worker => worker.id !== id))
  }

  // Add new role
  async function addRole(event) {
    event.preventDefault()
    if (!newRoleName.trim()) return

    const { data, error } = await supabase
      .from('roles')
      .insert([{ name: newRoleName.trim(), is_manager: false, business_id: businessId }])
      .select()

    if (error) {
      console.error('Error adding role:', error)
    } else if (data) {
      setRoles([...roles, data[0]])
      setNewRoleName('')
    }
  }

  // Delete role
  async function deleteRole(roleId) {
    // Check if any workers have this role
    const workersWithRole = workers.filter(w => w.role_id === roleId)
    if (workersWithRole.length > 0) {
      alert(`Cannot delete role: ${workersWithRole.length} worker(s) have this role assigned.`)
      return
    }

    const { error } = await supabase
      .from('roles')
      .delete()
      .eq('id', roleId)

    if (error) {
      console.error('Error deleting role:', error)
    } else {
      setRoles(roles.filter(r => r.id !== roleId))
    }
  }

  // Update worker skill level
  async function updateWorkerSkill(workerId, skillLevel) {
    const { error } = await supabase
      .from('workers')
      .update({ skill_level: skillLevel })
      .eq('id', workerId)

    if (error) {
      console.error('Error updating worker skill:', error)
    } else {
      setWorkers(workers.map(worker =>
        worker.id === workerId ? { ...worker, skill_level: skillLevel } : worker
      ))
    }
  }

  // Update worker role
  async function updateWorkerRole(workerId, roleId) {
    const { error } = await supabase
      .from('workers')
      .update({ role_id: roleId })
      .eq('id', workerId)

    if (error) {
      console.error('Error updating worker role:', error)
    } else {
      setWorkers(workers.map(worker =>
        worker.id === workerId ? { ...worker, role_id: roleId } : worker
      ))
    }
  }

  // Get role name by id
  function getRoleName(roleId) {
    const role = roles.find(r => r.id === roleId)
    return role ? role.name : 'Unassigned'
  }

  // Check if role is manager type
  function isManagerRole(roleId) {
    const role = roles.find(r => r.id === roleId)
    return role ? role.is_manager : false
  }

  // Bulk import workers from text (format: name|role per line)
  async function bulkImportWorkers() {
    setBulkImportStatus({ message: '', type: '' })

    const lines = bulkImportText.trim().split('\n').filter(line => line.trim())
    if (lines.length === 0) {
      setBulkImportStatus({ message: 'Please enter at least one worker', type: 'error' })
      return
    }

    const workersToAdd = []
    const newRolesToCreate = []
    const errors = []

    // Parse each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      const parts = line.split('|').map(part => part.trim())

      if (parts.length < 1 || !parts[0]) {
        errors.push(`Line ${i + 1}: Invalid format`)
        continue
      }

      const workerName = parts[0]
      const roleName = parts[1] || null

      // Find or prepare to create role
      let roleId = null
      if (roleName) {
        const existingRole = roles.find(r => r.name.toLowerCase() === roleName.toLowerCase())
        if (existingRole) {
          roleId = existingRole.id
        } else {
          // Check if we already plan to create this role
          if (!newRolesToCreate.find(r => r.name.toLowerCase() === roleName.toLowerCase())) {
            newRolesToCreate.push({ name: roleName })
          }
        }
      }

      workersToAdd.push({ name: workerName, roleName, roleId })
    }

    // Create new roles first
    let updatedRoles = [...roles]
    if (newRolesToCreate.length > 0) {
      const { data: createdRoles, error: roleError } = await supabase
        .from('roles')
        .insert(newRolesToCreate.map(r => ({ name: r.name, is_manager: false, business_id: businessId })))
        .select()

      if (roleError) {
        setBulkImportStatus({ message: `Error creating roles: ${roleError.message}`, type: 'error' })
        return
      }

      updatedRoles = [...roles, ...createdRoles]
      setRoles(updatedRoles)
    }

    // Now assign role IDs to workers that needed new roles
    const workersData = workersToAdd.map(worker => {
      let roleId = worker.roleId
      if (!roleId && worker.roleName) {
        const role = updatedRoles.find(r => r.name.toLowerCase() === worker.roleName.toLowerCase())
        roleId = role ? role.id : null
      }
      // Use first non-manager role as default if no role specified
      if (!roleId) {
        const defaultRole = updatedRoles.find(r => !r.is_manager) || updatedRoles[0]
        roleId = defaultRole ? defaultRole.id : null
      }

      return {
        name: worker.name,
        skill_level: 3,
        role_id: roleId,
        business_id: businessId,
        monday_day: true, monday_night: true,
        tuesday_day: true, tuesday_night: true,
        wednesday_day: true, wednesday_night: true,
        thursday_day: true, thursday_night: true,
        friday_day: true, friday_night: true,
        saturday_day: true, saturday_night: true,
        sunday_day: true, sunday_night: true
      }
    })

    // Insert all workers
    const { data: insertedWorkers, error: insertError } = await supabase
      .from('workers')
      .insert(workersData)
      .select()

    if (insertError) {
      setBulkImportStatus({ message: `Error adding workers: ${insertError.message}`, type: 'error' })
      return
    }

    setWorkers([...workers, ...insertedWorkers])
    setBulkImportText('')
    setBulkImportStatus({
      message: `Successfully imported ${insertedWorkers.length} worker(s)${newRolesToCreate.length > 0 ? ` and created ${newRolesToCreate.length} new role(s)` : ''}`,
      type: 'success'
    })
  }

  // Toggle availability for day/shift combination
  async function toggleAvailability(workerId, day, shiftType) {
    const columnName = `${day}_${shiftType}`
    const worker = workers.find(worker => worker.id === workerId)
    const newValue = !worker[columnName]

    const { error } = await supabase
      .from('workers')
      .update({ [columnName]: newValue })
      .eq('id', workerId)

    if (error) {
      console.error('Error updating availability:', error)
    } else {
      setWorkers(workers.map(worker =>
        worker.id === workerId ? { ...worker, [columnName]: newValue } : worker
      ))
    }
  }

  const sortedWorkers = getSortedWorkers()

  // Get shifts grouped by day - returns array of { day, shifts: ['day', 'night'] }
  function getShiftColumns() {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    const columns = []

    days.forEach(day => {
      const dayShifts = shiftRequirements
        .filter(shift => shift.day_of_week === day)
        .map(shift => shift.shift_name)
        .sort((a, b) => a === 'day' ? -1 : 1) // day before night

      if (dayShifts.length > 0) {
        columns.push({ day, shifts: dayShifts })
      }
    })

    return columns
  }

  // Get day abbreviation
  function getDayAbbrev(day) {
    const abbrevs = {
      monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
      thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun'
    }
    return abbrevs[day]
  }

  const shiftColumns = getShiftColumns()

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800">Worker Management</h2>
        <p className="text-gray-500 mt-1">Add staff members and manage their availability</p>
        <div className="flex gap-3 justify-center mt-4">
          <button
            onClick={() => setShowRoleManager(!showRoleManager)}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all"
          >
            {showRoleManager ? 'Hide Roles' : 'Manage Roles'}
          </button>
          <button
            onClick={() => setShowBulkImport(!showBulkImport)}
            className="px-4 py-2 text-emerald-600 hover:text-emerald-800 border border-emerald-300 rounded-lg hover:bg-emerald-50 transition-all"
          >
            {showBulkImport ? 'Hide Bulk Import' : 'Bulk Import'}
          </button>
        </div>
      </div>

      {/* Role Manager */}
      {showRoleManager && (
        <div className="mb-8 p-6 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Manage Roles</h3>
          <div className="flex flex-wrap gap-3 mb-4">
            {roles.map(role => (
              <div key={role.id} className={`flex items-center gap-2 px-4 py-2 rounded-lg ${role.is_manager ? 'bg-amber-100 border border-amber-300' : 'bg-white border border-gray-300'}`}>
                <span className="font-medium">{role.name}</span>
                {role.is_manager && <span className="text-xs text-amber-600">(Manager)</span>}
                {!role.is_manager && (
                  <button
                    onClick={() => deleteRole(role.id)}
                    className="text-red-500 hover:text-red-700 ml-2"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <form onSubmit={addRole} className="flex gap-3 max-w-md">
            <input
              type="text"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="New role name..."
              className="w-48 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
            <button
              type="submit"
              className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 font-medium transition-all"
            >
              Add Role
            </button>
          </form>
        </div>
      )}

      {/* Bulk Import Panel */}
      {showBulkImport && (
        <div className="mb-8 p-6 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Bulk Import Workers</h3>
          <p className="text-sm text-gray-600 mb-4">
            Paste your worker list below. Format: <code className="bg-white px-2 py-1 rounded text-emerald-700">name|role</code> (one per line)
          </p>
          <p className="text-xs text-gray-500 mb-4">
            Example:<br />
            <code className="bg-white px-2 py-1 rounded block mt-1">
              John Smith|Server<br />
              Jane Doe|Bartender<br />
              Mike Johnson|Cook
            </code>
          </p>
          <textarea
            value={bulkImportText}
            onChange={(e) => setBulkImportText(e.target.value)}
            placeholder="John Smith|Server&#10;Jane Doe|Bartender&#10;Mike Johnson|Cook"
            rows={6}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono text-sm"
          />
          {bulkImportStatus.message && (
            <div className={`mt-3 px-4 py-2 rounded-lg text-sm ${
              bulkImportStatus.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
            }`}>
              {bulkImportStatus.message}
            </div>
          )}
          <button
            onClick={bulkImportWorkers}
            className="mt-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-2.5 rounded-lg hover:from-emerald-700 hover:to-teal-700 font-semibold shadow-md transition-all"
          >
            Import Workers
          </button>
        </div>
      )}

      {/* Add Worker Form */}
      <form onSubmit={addWorker} className="mb-8 p-6 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-gray-200">
        <div className="flex gap-6 items-end flex-wrap">
          <div style={{ width: '200px' }}>
            <label className="block text-sm font-semibold mb-2 text-gray-700">Name</label>
            <input
              type="text"
              value={newWorker.name}
              onChange={(event) => setNewWorker({...newWorker, name: event.target.value})}
              required
              placeholder="Worker name..."
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
          </div>
          <div style={{ width: '100px' }}>
            <label className="block text-sm font-semibold mb-2 text-gray-700">Skill</label>
            <select
              value={newWorker.skill_level}
              onChange={(event) => setNewWorker({...newWorker, skill_level: parseInt(event.target.value)})}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white cursor-pointer"
            >
              {[1,2,3,4,5].map(level => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>
          <div style={{ width: '140px' }}>
            <label className="block text-sm font-semibold mb-2 text-gray-700">Role</label>
            <select
              value={newWorker.role_id || ''}
              onChange={(event) => setNewWorker({...newWorker, role_id: parseInt(event.target.value)})}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white cursor-pointer"
            >
              {roles.map(role => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-2.5 rounded-lg hover:from-blue-700 hover:to-indigo-700 font-semibold shadow-md transition-all">
            Add Worker
          </button>
        </div>
      </form>

      {/* Workers Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 border" rowSpan="2">Name</th>
              <th className="px-4 py-2 border" rowSpan="2">Skill</th>
              <th className="px-4 py-2 border" rowSpan="2">Role</th>
              <th className="px-4 py-2 border" rowSpan="2">Week Hours</th>
              {shiftColumns.map(({ day, shifts }) => (
                <th key={day} className="px-2 py-1 border text-center" colSpan={shifts.length}>
                  {getDayAbbrev(day)}
                </th>
              ))}
              <th className="px-4 py-2 border" rowSpan="2">Actions</th>
            </tr>
            <tr>
              {shiftColumns.map(({ day, shifts }) => (
                shifts.map(shiftType => (
                  <th key={`${day}-${shiftType}`} className={`px-2 py-1 border text-xs ${shiftType === 'day' ? 'bg-amber-100' : 'bg-indigo-100'}`}>
                    {shiftType === 'day' ? '☀️' : '🌙'}
                  </th>
                ))
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedWorkers.map(worker => (
              <tr key={worker.id} className={`hover:bg-gray-50 ${isManagerRole(worker.role_id) ? 'bg-amber-50' : ''}`}>
                <td className="px-4 py-2 border font-medium text-center">{worker.name}</td>
                <td className="px-4 py-2 border text-center">
                  <div className="flex justify-center gap-0.5">
                    {[1, 2, 3, 4, 5].map(level => (
                      <button
                        key={level}
                        onClick={() => updateWorkerSkill(worker.id, level)}
                        className={`text-lg hover:scale-125 transition-transform ${
                          level <= worker.skill_level ? 'text-amber-500' : 'text-gray-300'
                        }`}
                        title={`Set skill to ${level}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2 border text-center">
                  <select
                    value={worker.role_id || ''}
                    onChange={(e) => updateWorkerRole(worker.id, parseInt(e.target.value))}
                    className={`px-3 py-1 rounded-lg text-sm font-medium border-0 cursor-pointer ${
                      isManagerRole(worker.role_id)
                        ? 'bg-amber-200 text-amber-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {roles.map(role => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2 border text-center font-medium">
                  {calculateTotalHours(worker.id)}
                </td>
                {shiftColumns.map(({ day, shifts }) => (
                  shifts.map(shiftType => {
                    const columnName = `${day}_${shiftType}`
                    return (
                      <td key={`${day}-${shiftType}`} className="px-2 py-2 border text-center">
                        <button
                          onClick={() => toggleAvailability(worker.id, day, shiftType)}
                          className={`text-xl ${worker[columnName] ? 'text-green-600' : 'text-red-400'}`}
                        >
                          {worker[columnName] ? '✓' : '✗'}
                        </button>
                      </td>
                    )
                  })
                ))}
                <td className="px-4 py-2 border text-center">
                  <button
                    onClick={() => deleteWorker(worker.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

WorkerManager.propTypes = {
  businessId: PropTypes.number.isRequired,
  selectedWeekStart: PropTypes.string.isRequired
}

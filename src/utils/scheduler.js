// Get Monday of current week
export function getCurrentWeekStart() {
  const today = new Date()
  const day = today.getDay()
  const diff = today.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
  const monday = new Date(today.setDate(diff))
  return monday.toISOString().split('T')[0] // YYYY-MM-DD
}

// Get Monday of a week offset from current week (0 = current, 1 = next week, etc.)
export function getWeekStart(weekOffset = 0) {
  const today = new Date()
  const day = today.getDay()
  const diff = today.getDate() - day + (day === 0 ? -6 : 1) + (weekOffset * 7)
  const monday = new Date(today)
  monday.setDate(diff)
  return monday.toISOString().split('T')[0] // YYYY-MM-DD
}

// Format date for display (e.g., "Dec 30, 2024")
export function formatWeekDate(dateString) {
  const date = new Date(dateString + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Get end of week (Sunday) from Monday date
export function getWeekEnd(mondayDateString) {
  const monday = new Date(mondayDateString + 'T00:00:00')
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return sunday.toISOString().split('T')[0]
}

// Format time for display (handles both "HH:MM:SS" and "HH:MM")
export function formatTime(time) {
  if (!time) return ''
  return time.substring(0, 5)
}

// Main scheduling algorithm - handles role-based requirements per shift
export function generateSchedule(workers, shiftRequirements, weekStartDate, roles = []) {
  const assignments = []
  const warnings = []

  // Process high-priority days first (Fri, Sat, Sun) to ensure best workers are assigned
  const days = ['friday', 'saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday']
  const highPriorityDays = ['friday', 'saturday', 'sunday']

  // Helper to get worker's role name
  function getWorkerRoleName(worker) {
    if (!roles.length) return worker.is_manager ? 'Manager' : 'Worker' // Fallback
    const role = roles.find(r => r.id === worker.role_id)
    return role ? role.name : 'Unassigned'
  }

  // Helper to check if worker's role is a manager type
  function isManagerRole(worker) {
    if (!roles.length) return worker.is_manager === true // Fallback
    const role = roles.find(r => r.id === worker.role_id)
    return role ? role.is_manager : false
  }

  // Track how many shifts each person has been assigned (for fairness)
  const shiftCounts = {}
  workers.forEach(worker => shiftCounts[worker.id] = 0)

  // Group shift requirements by day, then process each shift
  days.forEach(day => {
    const isHighPriority = highPriorityDays.includes(day)
    const dayShifts = shiftRequirements.filter(shift => shift.day_of_week === day)

    if (dayShifts.length === 0) return

    // Process each shift for the day
    dayShifts.forEach(shiftRequirement => {
      const roleRequirements = shiftRequirement.role_requirements || {}
      const availabilityColumn = `${day}_${shiftRequirement.shift_name}`

      // Process each role requirement
      Object.entries(roleRequirements).forEach(([roleName, requiredCount]) => {
        if (requiredCount <= 0) return

        // Find workers with this role who are available
        const availableWorkers = workers.filter(worker => {
          const workerRoleName = getWorkerRoleName(worker)
          const isAvailable = worker[availabilityColumn] === true
          return workerRoleName === roleName && isAvailable
        })

        if (availableWorkers.length < requiredCount) {
          warnings.push(
            `${day} (${shiftRequirement.shift_name}): Only ${availableWorkers.length} ${roleName}(s) available, need ${requiredCount}`
          )
        }

        // Score workers: prioritize by skill level
        const scoredWorkers = availableWorkers.map(worker => ({
          ...worker,
          score: isHighPriority
            ? (worker.skill_level * 5) - (shiftCounts[worker.id] * 0.3)
            : (worker.skill_level * 2) - (shiftCounts[worker.id] * 0.5)
        }))

        scoredWorkers.sort((a, b) => b.score - a.score)

        const numToAssign = Math.min(requiredCount, scoredWorkers.length)

        for (let i = 0; i < numToAssign; i++) {
          const worker = scoredWorkers[i]
          assignments.push({
            worker_id: worker.id,
            worker_name: worker.name,
            role_name: roleName,
            is_manager: isManagerRole(worker),
            day_of_week: day,
            shift_name: shiftRequirement.shift_name,
            start_time: shiftRequirement.start_time,
            end_time: shiftRequirement.end_time,
            week_start_date: weekStartDate
          })
          shiftCounts[worker.id]++
        }
      })
    })
  })

  return { assignments, warnings }
}

import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useBusiness } from '../contexts/BusinessContext'
import Scheduler from './Scheduler'

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const { businesses, selectedBusiness, setSelectedBusiness, addBusiness, deleteBusiness, loading } = useBusiness()
  const [activeTab, setActiveTab] = useState('scheduler')
  const [showAddBusiness, setShowAddBusiness] = useState(false)
  const [newBusinessName, setNewBusinessName] = useState('')
  const [addingBusiness, setAddingBusiness] = useState(false)

  async function handleAddBusiness(e) {
    e.preventDefault()
    if (!newBusinessName.trim()) return

    setAddingBusiness(true)
    const { error } = await addBusiness(newBusinessName.trim())
    if (error) {
      alert('Error adding business: ' + error.message)
    } else {
      setNewBusinessName('')
      setShowAddBusiness(false)
    }
    setAddingBusiness(false)
  }

  async function handleDeleteBusiness(businessId, businessName) {
    if (!confirm(`Are you sure you want to delete "${businessName}"? This will delete all associated data.`)) {
      return
    }
    const { error } = await deleteBusiness(businessId)
    if (error) {
      alert('Error deleting business: ' + error.message)
    }
  }

  const tabs = [
    { id: 'scheduler', label: 'Scheduler', icon: '📅' },
    { id: 'hours', label: 'Calculate Hours', icon: '⏱️' },
    { id: 'sales', label: 'Sales Report', icon: '📊' }
  ]

  // Show business selection if no business selected
  if (!loading && businesses.length === 0) {
    return (
      <div className="min-h-screen bg-gray-100">
        <header className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 shadow-lg">
          <div className="container mx-auto flex justify-between items-center">
            <h1 className="text-2xl font-bold">Restaurant Manager</h1>
            <div className="flex items-center gap-4">
              <span className="text-blue-100">{user?.email}</span>
              <button
                onClick={signOut}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </header>

        <div className="container mx-auto py-12">
          <div className="max-w-md mx-auto bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="text-6xl mb-4">🏪</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome!</h2>
            <p className="text-gray-500 mb-6">Add your first business to get started</p>

            <form onSubmit={handleAddBusiness} className="space-y-4">
              <input
                type="text"
                value={newBusinessName}
                onChange={(e) => setNewBusinessName(e.target.value)}
                placeholder="Business name..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
              <button
                type="submit"
                disabled={addingBusiness || !newBusinessName.trim()}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-400 transition-all"
              >
                {addingBusiness ? 'Adding...' : 'Add Business'}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg">
        <div className="container mx-auto">
          {/* Top bar */}
          <div className="flex justify-between items-center p-4">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold">Restaurant Manager</h1>

              {/* Business selector */}
              <div className="flex items-center gap-2">
                <select
                  value={selectedBusiness?.id || ''}
                  onChange={(e) => {
                    const business = businesses.find(b => b.id === parseInt(e.target.value))
                    setSelectedBusiness(business)
                  }}
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/50"
                >
                  {businesses.map(business => (
                    <option key={business.id} value={business.id} className="text-gray-800">
                      {business.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => setShowAddBusiness(true)}
                  className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                  title="Add business"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-blue-100">{user?.email}</span>
              <button
                onClick={signOut}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* Navigation tabs */}
          <div className="flex gap-1 px-4 pb-0">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 rounded-t-lg font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-gray-100 text-gray-800'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto py-6">
        {activeTab === 'scheduler' && selectedBusiness && (
          <Scheduler businessId={selectedBusiness.id} businessName={selectedBusiness.name} />
        )}

        {activeTab === 'hours' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="text-6xl mb-4">⏱️</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Calculate Hours</h2>
            <p className="text-gray-500">Coming soon - Track and calculate employee work hours</p>
          </div>
        )}

        {activeTab === 'sales' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Sales Report</h2>
            <p className="text-gray-500">In progress - View and analyze sales data</p>
          </div>
        )}
      </main>

      {/* Add Business Modal */}
      {showAddBusiness && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Add New Business</h3>
            <form onSubmit={handleAddBusiness} className="space-y-4">
              <input
                type="text"
                value={newBusinessName}
                onChange={(e) => setNewBusinessName(e.target.value)}
                placeholder="Business name..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddBusiness(false)
                    setNewBusinessName('')
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingBusiness || !newBusinessName.trim()}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-400 transition-all"
                >
                  {addingBusiness ? 'Adding...' : 'Add'}
                </button>
              </div>
            </form>

            {/* List existing businesses with delete option */}
            {businesses.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-500 mb-3">Your Businesses</h4>
                <div className="space-y-2">
                  {businesses.map(business => (
                    <div key={business.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-gray-700">{business.name}</span>
                      <button
                        onClick={() => handleDeleteBusiness(business.id, business.name)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

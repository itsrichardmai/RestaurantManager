import { createContext, useContext, useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { supabase } from '../supabaseClient'
import { useAuth } from './AuthContext'

const BusinessContext = createContext({})

export function useBusiness() {
  return useContext(BusinessContext)
}

export function BusinessProvider({ children }) {
  const { user } = useAuth()
  const [businesses, setBusinesses] = useState([])
  const [selectedBusiness, setSelectedBusiness] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      fetchBusinesses()
    } else {
      setBusinesses([])
      setSelectedBusiness(null)
      setLoading(false)
    }
  }, [user])

  async function fetchBusinesses() {
    setLoading(true)
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching businesses:', error)
    } else {
      setBusinesses(data || [])
      // Auto-select first business if none selected
      if (data?.length > 0 && !selectedBusiness) {
        setSelectedBusiness(data[0])
      }
    }
    setLoading(false)
  }

  async function addBusiness(name) {
    const { data, error } = await supabase
      .from('businesses')
      .insert([{ name, user_id: user.id }])
      .select()

    if (error) {
      return { error }
    }

    if (data) {
      setBusinesses([data[0], ...businesses])
      setSelectedBusiness(data[0])
    }
    return { data }
  }

  async function deleteBusiness(businessId) {
    const { error } = await supabase
      .from('businesses')
      .delete()
      .eq('id', businessId)

    if (error) {
      return { error }
    }

    const updatedBusinesses = businesses.filter(b => b.id !== businessId)
    setBusinesses(updatedBusinesses)

    if (selectedBusiness?.id === businessId) {
      setSelectedBusiness(updatedBusinesses[0] || null)
    }
    return { error: null }
  }

  const value = {
    businesses,
    selectedBusiness,
    setSelectedBusiness,
    loading,
    addBusiness,
    deleteBusiness,
    refreshBusinesses: fetchBusinesses
  }

  return (
    <BusinessContext.Provider value={value}>
      {children}
    </BusinessContext.Provider>
  )
}

BusinessProvider.propTypes = {
  children: PropTypes.node.isRequired
}

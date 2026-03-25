'use client'

import { useState, useRef, useCallback } from 'react'

export interface PlaceSuggestion {
  placeId: string
  name: string
  address: string
  fullText: string
}

export interface SelectedLocation {
  placeId: string
  name: string
  address: string
  lat: number
  lng: number
  radius: number
}

export interface SelectedBusiness {
  placeId: string
  name: string
  address: string
  website: string
  rating: number | null
  reviewCount: number | null
  category: string
}

export function usePlaceSearch() {
  const [locationQuery, setLocationQuery] = useState('')
  const [locationSuggestions, setLocationSuggestions] = useState<PlaceSuggestion[]>([])
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)

  const [businessQuery, setBusinessQuery] = useState('')
  const [businessSuggestions, setBusinessSuggestions] = useState<PlaceSuggestion[]>([])
  const [selectedBusiness, setSelectedBusiness] = useState<SelectedBusiness | null>(null)
  const [businessLoading, setBusinessLoading] = useState(false)

  const locationTimer = useRef<NodeJS.Timeout | null>(null)
  const businessTimer = useRef<NodeJS.Timeout | null>(null)

  const searchLocations = useCallback((query: string) => {
    setLocationQuery(query)
    if (locationTimer.current) clearTimeout(locationTimer.current)
    if (query.length < 2) {
      setLocationSuggestions([])
      return
    }
    locationTimer.current = setTimeout(async () => {
      setLocationLoading(true)
      try {
        const res = await fetch('/api/places/autocomplete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, searchType: 'location' }),
        })
        const data = await res.json()
        setLocationSuggestions(data.suggestions || [])
      } catch {
        setLocationSuggestions([])
      } finally {
        setLocationLoading(false)
      }
    }, 300)
  }, [])

  const selectLocation = useCallback(async (suggestion: PlaceSuggestion) => {
    setLocationSuggestions([])
    setLocationQuery(suggestion.name + (suggestion.address ? ', ' + suggestion.address : ''))
    try {
      const res = await fetch('/api/places/details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId: suggestion.placeId, fetchingLocation: true }),
      })
      const data = await res.json()
      if (data.place?.lat) {
        setSelectedLocation({
          placeId: suggestion.placeId,
          name: suggestion.name,
          address: suggestion.address,
          lat: data.place.lat,
          lng: data.place.lng,
          radius: data.place.radius,
        })
      }
    } catch {
      setSelectedLocation({
        placeId: suggestion.placeId,
        name: suggestion.name,
        address: suggestion.address,
        lat: 0,
        lng: 0,
        radius: 50000,
      })
    }
  }, [])

  const searchBusinesses = useCallback((query: string) => {
    setBusinessQuery(query)
    if (businessTimer.current) clearTimeout(businessTimer.current)
    if (query.length < 2) {
      setBusinessSuggestions([])
      return
    }
    businessTimer.current = setTimeout(async () => {
      setBusinessLoading(true)
      try {
        const res = await fetch('/api/places/autocomplete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            searchType: 'business',
            lat: selectedLocation?.lat || undefined,
            lng: selectedLocation?.lng || undefined,
            radius: selectedLocation?.radius || undefined,
          }),
        })
        const data = await res.json()
        setBusinessSuggestions(data.suggestions || [])
      } catch {
        setBusinessSuggestions([])
      } finally {
        setBusinessLoading(false)
      }
    }, 300)
  }, [selectedLocation])

  const selectBusiness = useCallback(async (suggestion: PlaceSuggestion): Promise<SelectedBusiness | null> => {
    setBusinessSuggestions([])
    setBusinessQuery(suggestion.name)
    try {
      const res = await fetch('/api/places/details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId: suggestion.placeId, fetchingLocation: false }),
      })
      const data = await res.json()
      if (data.place) {
        const business: SelectedBusiness = {
          placeId: suggestion.placeId,
          name: data.place.name || suggestion.name,
          address: data.place.address || suggestion.address,
          website: data.place.website || '',
          rating: data.place.rating,
          reviewCount: data.place.reviewCount,
          category: data.place.category || '',
        }
        setSelectedBusiness(business)
        return business
      }
    } catch {
      const business: SelectedBusiness = {
        placeId: suggestion.placeId,
        name: suggestion.name,
        address: suggestion.address,
        website: '',
        rating: null,
        reviewCount: null,
        category: '',
      }
      setSelectedBusiness(business)
      return business
    }
    return null
  }, [])

  const clearLocation = useCallback(() => {
    setSelectedLocation(null)
    setLocationQuery('')
    setBusinessQuery('')
    setBusinessSuggestions([])
    setSelectedBusiness(null)
  }, [])

  const clearBusiness = useCallback(() => {
    setSelectedBusiness(null)
    setBusinessQuery('')
  }, [])

  return {
    locationQuery, locationSuggestions, selectedLocation, locationLoading,
    searchLocations, selectLocation, clearLocation,
    businessQuery, businessSuggestions, selectedBusiness, businessLoading,
    searchBusinesses, selectBusiness, clearBusiness,
  }
}

'use client'

import { useEffect } from 'react'
import { Loader } from 'lucide-react'
import { usePlaceSearch, SelectedBusiness } from '@/lib/use-place-search'

interface BusinessPlaceSearchProps {
  onSelect: (business: SelectedBusiness) => void
}

export default function BusinessPlaceSearch({
  onSelect,
}: BusinessPlaceSearchProps) {
  const {
    locationQuery, locationSuggestions, selectedLocation,
    locationLoading, searchLocations, selectLocation, clearLocation,
    businessQuery, businessSuggestions, selectedBusiness,
    businessLoading, searchBusinesses, selectBusiness,
  } = usePlaceSearch()

  useEffect(() => {
    if (selectedBusiness) {
      onSelect(selectedBusiness)
    }
  }, [selectedBusiness, onSelect])

  return (
    <div className="space-y-4">
      {/* STEP 1 — Location */}
      {!selectedLocation && (
        <div className="relative">
          <label
            className="block text-sm font-medium mb-1"
            style={{ color: '#191654', fontFamily: 'DM Sans, sans-serif' }}
          >
            Where is your business located?
          </label>
          <div className="relative">
            <input
              type="text"
              value={locationQuery}
              onChange={(e) => searchLocations(e.target.value)}
              placeholder="City, region, or country..."
              className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
              style={{ borderColor: '#e5e7eb' }}
              autoComplete="off"
            />
            {locationLoading && (
              <div className="absolute right-3 top-3">
                <Loader size={14} className="animate-spin" style={{ color: '#9ca3af' }} />
              </div>
            )}
          </div>
          {locationSuggestions.length > 0 && (
            <div
              className="absolute top-full left-0 right-0 z-50 bg-white border rounded-xl shadow-lg mt-1 overflow-hidden"
              style={{ borderColor: '#e5e7eb' }}
            >
              {locationSuggestions.map((s) => (
                <button
                  key={s.placeId}
                  type="button"
                  onClick={() => selectLocation(s)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-0"
                  style={{ borderColor: '#f3f4f6' }}
                >
                  <p className="text-sm font-medium" style={{ color: '#191654' }}>📍 {s.name}</p>
                  {s.address && <p className="text-xs" style={{ color: '#9ca3af' }}>{s.address}</p>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STEP 2 — Business search */}
      {selectedLocation && !selectedBusiness && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span
              className="text-xs px-3 py-1.5 rounded-full font-medium flex items-center gap-1.5"
              style={{ backgroundColor: 'rgba(67,198,172,0.12)', color: '#43C6AC' }}
            >
              📍 {selectedLocation.name}
              <button
                type="button"
                onClick={clearLocation}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#43C6AC', fontSize: 16, lineHeight: 1 }}
              >
                ×
              </button>
            </span>
          </div>
          <div className="relative">
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: '#191654', fontFamily: 'DM Sans, sans-serif' }}
            >
              Search for your business
            </label>
            <div className="relative">
              <input
                type="text"
                value={businessQuery}
                onChange={(e) => searchBusinesses(e.target.value)}
                placeholder="Start typing your business name..."
                className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                style={{ borderColor: '#e5e7eb' }}
                autoComplete="off"
                autoFocus
              />
              {businessLoading && (
                <div className="absolute right-3 top-3">
                  <Loader size={14} className="animate-spin" style={{ color: '#9ca3af' }} />
                </div>
              )}
            </div>
            {businessSuggestions.length > 0 && (
              <div
                className="absolute top-full left-0 right-0 z-50 bg-white border rounded-xl shadow-lg mt-1 overflow-hidden"
                style={{ borderColor: '#e5e7eb' }}
              >
                {businessSuggestions.map((s) => (
                  <button
                    key={s.placeId}
                    type="button"
                    onClick={() => selectBusiness(s)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-0"
                    style={{ borderColor: '#f3f4f6' }}
                  >
                    <p className="text-sm font-medium" style={{ color: '#191654' }}>{s.name}</p>
                    <p className="text-xs" style={{ color: '#9ca3af' }}>{s.address}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      query,
      searchType = 'business',
      lat,
      lng,
      radius,
    }: {
      query: string
      searchType?: 'location' | 'business'
      lat?: number
      lng?: number
      radius?: number
    } = body

    const apiKey = process.env.GOOGLE_PLACES_API_KEY
    if (!apiKey) {
      return Response.json({ suggestions: [] })
    }

    if (!query || query.trim().length < 2) {
      return Response.json({ suggestions: [] })
    }

    const includedPrimaryTypes = searchType === 'location'
      ? [
          'locality',
          'administrative_area_level_1',
          'administrative_area_level_2',
          'country',
        ]
      : ['establishment']

    const locationBias = (
      searchType === 'business' && lat && lng && radius
    ) ? {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: radius,
      }
    } : undefined

    const requestBody: Record<string, unknown> = {
      input: query.trim(),
      includedPrimaryTypes,
    }

    if (locationBias) {
      requestBody.locationBias = locationBias
    }

    const res = await fetch(
      'https://places.googleapis.com/v1/places:autocomplete',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(5000),
      }
    )

    if (!res.ok) {
      console.error('Places autocomplete error:', res.status)
      return Response.json({ suggestions: [] })
    }

    const data = await res.json()

    const suggestions = (data.suggestions || [])
      .slice(0, 6)
      .map((s: {
        placePrediction?: {
          placeId?: string
          text?: { text?: string }
          structuredFormat?: {
            mainText?: { text?: string }
            secondaryText?: { text?: string }
          }
        }
      }) => ({
        placeId: s.placePrediction?.placeId || '',
        name: s.placePrediction?.structuredFormat?.mainText?.text
          || s.placePrediction?.text?.text || '',
        address: s.placePrediction?.structuredFormat?.secondaryText?.text || '',
        fullText: s.placePrediction?.text?.text || '',
      }))
      .filter((s: { placeId: string; name: string }) => s.placeId && s.name)

    return Response.json({ suggestions })
  } catch (err) {
    console.error('Places autocomplete error:', err)
    return Response.json({ suggestions: [] })
  }
}

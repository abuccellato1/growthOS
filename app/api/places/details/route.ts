import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      placeId,
      fetchingLocation = false,
    }: {
      placeId: string
      fetchingLocation?: boolean
    } = body

    const apiKey = process.env.GOOGLE_PLACES_API_KEY
    if (!apiKey || !placeId) {
      return Response.json({ place: null })
    }

    const fieldMask = fetchingLocation
      ? [
          'id',
          'displayName',
          'formattedAddress',
          'location',
          'addressComponents',
        ].join(',')
      : [
          'id',
          'displayName',
          'formattedAddress',
          'websiteUri',
          'rating',
          'userRatingCount',
          'primaryTypeDisplayName',
          'types',
        ].join(',')

    const res = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}`,
      {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': fieldMask,
        },
        signal: AbortSignal.timeout(5000),
      }
    )

    if (!res.ok) {
      console.error('Places details error:', res.status)
      return Response.json({ place: null })
    }

    const data = await res.json()

    if (fetchingLocation) {
      return Response.json({
        place: {
          placeId: data.id,
          name: data.displayName?.text || '',
          address: data.formattedAddress || '',
          lat: data.location?.latitude || null,
          lng: data.location?.longitude || null,
          radius: deriveRadius(data.types || []),
        }
      })
    }

    return Response.json({
      place: {
        placeId: data.id,
        name: data.displayName?.text || '',
        address: data.formattedAddress || '',
        website: data.websiteUri || '',
        rating: data.rating || null,
        reviewCount: data.userRatingCount || null,
        category: data.primaryTypeDisplayName?.text || '',
        types: data.types || [],
      }
    })
  } catch (err) {
    console.error('Places details error:', err)
    return Response.json({ place: null })
  }
}

function deriveRadius(types: string[]): number {
  if (types.includes('country')) return 500000
  if (types.includes('administrative_area_level_1')) return 200000
  if (types.includes('administrative_area_level_2')) return 80000
  if (types.includes('locality')) return 30000
  if (types.includes('sublocality')) return 10000
  return 50000
}

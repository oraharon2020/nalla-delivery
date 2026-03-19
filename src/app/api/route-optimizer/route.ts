import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Delivery {
  id: string;
  address: string;
}

interface DistanceMatrixElement {
  distance: { value: number; text: string };
  duration: { value: number; text: string };
  status: string;
}

interface DistanceMatrixRow {
  elements: DistanceMatrixElement[];
}

interface DistanceMatrixResponse {
  rows: DistanceMatrixRow[];
  status: string;
  error_message?: string;
}

// Nearest neighbor algorithm for route optimization
function findOptimalRoute(distanceMatrix: number[][], startIndex: number = 0): number[] {
  const n = distanceMatrix.length;
  const visited = new Set<number>();
  const route: number[] = [startIndex];
  visited.add(startIndex);

  let current = startIndex;

  while (visited.size < n) {
    let nearestDistance = Infinity;
    let nearestIndex = -1;

    for (let i = 0; i < n; i++) {
      if (!visited.has(i) && distanceMatrix[current][i] < nearestDistance) {
        nearestDistance = distanceMatrix[current][i];
        nearestIndex = i;
      }
    }

    if (nearestIndex !== -1) {
      route.push(nearestIndex);
      visited.add(nearestIndex);
      current = nearestIndex;
    }
  }

  return route;
}

// 2-opt improvement for better route
function twoOptImprove(route: number[], distanceMatrix: number[][]): number[] {
  let improved = true;
  let bestRoute = [...route];

  while (improved) {
    improved = false;
    for (let i = 1; i < bestRoute.length - 1; i++) {
      for (let j = i + 1; j < bestRoute.length; j++) {
        const newRoute = twoOptSwap(bestRoute, i, j);
        if (calculateRouteCost(newRoute, distanceMatrix) < calculateRouteCost(bestRoute, distanceMatrix)) {
          bestRoute = newRoute;
          improved = true;
        }
      }
    }
  }

  return bestRoute;
}

function twoOptSwap(route: number[], i: number, j: number): number[] {
  const newRoute = route.slice(0, i);
  const reversed = route.slice(i, j + 1).reverse();
  return newRoute.concat(reversed, route.slice(j + 1));
}

function calculateRouteCost(route: number[], distanceMatrix: number[][]): number {
  let cost = 0;
  for (let i = 0; i < route.length - 1; i++) {
    cost += distanceMatrix[route[i]][route[i + 1]];
  }
  return cost;
}

export async function POST(request: NextRequest) {
  try {
    const { deliveries } = await request.json() as { deliveries: Delivery[] };

    if (!deliveries || deliveries.length < 2) {
      return NextResponse.json({ 
        success: false, 
        error: 'צריך לפחות 2 משלוחים לאופטימיזציה' 
      });
    }

    // Get Google Maps API key from settings
    const { data: settings } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'google_maps_api_key')
      .single();

    const apiKey = settings?.value;

    if (!apiKey) {
      // Fallback: return deliveries in original order if no API key
      return NextResponse.json({
        success: true,
        optimizedOrder: deliveries.map(d => d.id),
        message: 'אין מפתח Google Maps - המשלוחים נשמרו בסדר הנוכחי'
      });
    }

    // Prepare addresses for Google Maps API
    const addresses = deliveries.map(d => encodeURIComponent(d.address + ', ישראל'));
    const originsStr = addresses.join('|');
    const destinationsStr = addresses.join('|');

    // Call Google Distance Matrix API
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originsStr}&destinations=${destinationsStr}&key=${apiKey}&language=he`
    );

    const data: DistanceMatrixResponse = await response.json();

    if (data.status !== 'OK') {
      console.error('Google Maps API error:', data);
      return NextResponse.json({
        success: false,
        error: data.error_message || 'שגיאה בשירות המפות'
      });
    }

    // Build distance matrix
    const n = deliveries.length;
    const distanceMatrix: number[][] = [];

    for (let i = 0; i < n; i++) {
      const row: number[] = [];
      for (let j = 0; j < n; j++) {
        const element = data.rows[i].elements[j];
        if (element.status === 'OK') {
          row.push(element.distance.value);
        } else {
          // If no route found, use a large distance
          row.push(i === j ? 0 : 999999999);
        }
      }
      distanceMatrix.push(row);
    }

    // Find optimal route using nearest neighbor + 2-opt improvement
    let optimalRoute = findOptimalRoute(distanceMatrix, 0);
    optimalRoute = twoOptImprove(optimalRoute, distanceMatrix);

    // Map back to delivery IDs
    const optimizedOrder = optimalRoute.map(index => deliveries[index].id);

    // Calculate total distance
    const totalDistance = calculateRouteCost(optimalRoute, distanceMatrix);
    const totalDistanceKm = (totalDistance / 1000).toFixed(1);

    return NextResponse.json({
      success: true,
      optimizedOrder,
      totalDistance: `${totalDistanceKm} ק"מ`,
      message: `המסלול מותאם - סה"כ ${totalDistanceKm} ק"מ`
    });

  } catch (error) {
    console.error('Route optimization error:', error);
    return NextResponse.json({
      success: false,
      error: 'שגיאה באופטימיזציית המסלול'
    });
  }
}

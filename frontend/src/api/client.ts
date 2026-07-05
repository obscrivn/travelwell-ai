import { Recommendation, Facility } from '../App';

export interface RunParams {
  location: string;
  timeWindow: string;
  budgetSelection: string;
  hasYmca: boolean;
  showersReq: boolean;
  parkingReq: boolean;
  poolPref: boolean;
  treadmillPref: boolean;
}

// Baseline mock templates to enrich LLM response
const BASE_RECS = {
  ymca: {
    id: 'ymca_chicago',
    name: 'Downtown Chicago YMCA',
    address: '30 S Michigan Ave, Chicago, IL 60603',
    phone: '+1 (312) 269-0500',
    website: 'https://www.ymcachicago.org',
    rating: 4.5,
    amenities: ['pool', 'treadmill', 'showers', 'lockers'],
    emoji_badges: ['🏊 Pool', '🏃 Treadmill', '🚿 Showers', '🔒 Lockers'],
    pricing: {
      access_type: 'membership_reciprocity',
      cost: 0.0,
      pass_detail: 'Free access with national YMCA membership'
    },
    hours: {
      open: '06:00 AM',
      close: '10:00 PM',
      warning: null,
      pool_hours: '06:30 AM - 08:30 PM'
    },
    distance: {
      value_miles: 0.5,
      walking_time_minutes: 10,
      transit_time_minutes: 4,
      description: '0.5 miles'
    },
    reviews_summary: 'Clean facility, features an indoor lap pool and modern treadmills. Showers are clean, lockers available.',
    crowd_warning: 'Moderate crowd expected between 5:30 PM and 7:30 PM.',
    recommendation_metadata: {
      best_for: 'YMCA members looking for free lap swimming and gym access in the Loop.',
      limitations: 'Can become moderately busy during standard post-work rush hours.'
    }
  },
  ffc: {
    id: 'ffc_union',
    name: 'Fitness Formula Club (FFC) Union Station',
    address: '444 W Jackson Blvd, Chicago, IL 60606',
    phone: '+1 (312) 906-9900',
    website: 'https://ffc.com/clubs/union-station',
    rating: 4.7,
    amenities: ['pool', 'treadmill', 'showers', 'lockers', 'towels'],
    emoji_badges: ['🏊 Pool', '🏃 Treadmill', '🚿 Showers', '🔒 Lockers', '🧺 Towels'],
    pricing: {
      access_type: 'day_pass',
      cost: 20.0,
      pass_detail: '$20 guest pass available with local registration'
    },
    hours: {
      open: '05:00 AM',
      close: '09:00 PM',
      warning: null,
      pool_hours: '06:00 AM - 08:00 PM'
    },
    distance: {
      value_miles: 0.9,
      walking_time_minutes: 18,
      transit_time_minutes: 6,
      description: '0.9 miles'
    },
    reviews_summary: 'Premium club, excellent saline pool, top-tier treadmills, and high-end locker room facilities.',
    crowd_warning: 'Low crowding expected in the evening.',
    recommendation_metadata: {
      best_for: 'Premium workout experience with a high-end saline pool and excellent locker room facilities.',
      limitations: 'Price sits exactly at the maximum user budget limit.'
    }
  },
  planet_fitness: {
    id: 'planet_fitness_dt',
    name: 'Planet Fitness Downtown',
    address: '26 N Halsted St, Chicago, IL 60661',
    phone: '+1 (312) 207-1010',
    website: 'https://www.planetfitness.com',
    rating: 4.1,
    amenities: ['treadmill', 'showers', 'lockers'],
    emoji_badges: ['🏃 Treadmill', '🚿 Showers', '🔒 Lockers'],
    pricing: {
      access_type: 'day_pass',
      cost: 10.0,
      pass_detail: '$10 day pass'
    },
    hours: {
      open: '00:00 AM',
      close: '11:59 PM',
      warning: null,
      pool_hours: null
    },
    distance: {
      value_miles: 1.2,
      walking_time_minutes: 22,
      transit_time_minutes: 7,
      description: '1.2 miles'
    },
    reviews_summary: 'Very cheap, open 24 hours. Good selection of treadmills. No pool.',
    crowd_warning: 'Moderate crowd expected.',
    recommendation_metadata: {
      best_for: 'Late-night treadmill runs on a low budget.',
      limitations: 'No pool (violates primary preference) and is located furthest from coordinates.'
    }
  }
};

export async function runConciergeStream(
  params: RunParams,
  onEvent: (event: any) => void,
  onTextUpdate: (text: string) => void
): Promise<string> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
  
  const userId = `user_${Math.random().toString(36).substring(2, 9)}`;
  const sessionId = `session_${Math.random().toString(36).substring(2, 9)}`;
  
  const reqAmenities = [];
  if (params.showersReq) reqAmenities.push("showers");
  if (params.parkingReq) reqAmenities.push("free parking");
  
  const prefAmenities = [];
  if (params.poolPref) prefAmenities.push("indoor pool");
  if (params.treadmillPref) prefAmenities.push("treadmill");
  
  const membershipText = params.hasYmca ? "I have a YMCA membership" : "I do not have any memberships";
  const budgetText = params.budgetSelection === "none" ? "no budget limit" : params.budgetSelection === "free" ? "a budget of $0 (free only)" : `a budget of $${params.budgetSelection}`;
  
  const prompt = `I am at ${params.location}. I need to find a gym with ${reqAmenities.join(" and ")} between ${params.timeWindow}. ${membershipText}, and ${budgetText}. My preferred amenities are ${prefAmenities.join(", ")}.`;

  const response = await fetch(`${baseUrl}/run_sse`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      app_name: 'app',
      user_id: userId,
      session_id: sessionId,
      new_message: {
        role: 'user',
        parts: [{ text: prompt }]
      },
      streaming: true
    })
  });

  if (!response.ok) {
    throw new Error(`Concierge backend error: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullText = '';

  if (!reader) {
    throw new Error('No body reader available');
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim().startsWith('data: ')) {
        try {
          const rawData = JSON.parse(line.trim().substring(6));
          onEvent(rawData);
          if (rawData.content && rawData.content.parts) {
            for (const part of rawData.content.parts) {
              if (part.text) {
                fullText += part.text;
                onTextUpdate(fullText);
              }
            }
          }
        } catch (e) {
          // ignore parse errors for partial lines
        }
      }
    }
  }

  return fullText;
}

export function parseMarkdownToRecommendations(markdown: string): Recommendation[] {
  const cards = markdown.split(/### Recommendation Card:/gi);
  const recommendations: Recommendation[] = [];
  let rank = 1;

  for (const card of cards) {
    if (!card.trim()) continue;

    const lines = card.split('\n');
    const firstLine = lines[0].trim();
    if (!firstLine) continue;

    const facilityName = firstLine.replace(/^[#\s:]+/, '').trim();
    
    let distanceStr = '';
    let priceStr = '';
    let eligibilityStr = 'Fits Your Criteria';
    let matchQualityStr = 'Excellent Match';
    let rationale = '';

    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.includes('- distance') || lower.includes('- travel time')) {
        distanceStr = line.split(':')[1]?.trim() || '';
      } else if (lower.includes('- price:')) {
        priceStr = line.split(':')[1]?.trim() || '';
      } else if (lower.includes('- eligibility status:')) {
        eligibilityStr = line.split(':')[1]?.trim() || 'Fits Your Criteria';
      } else if (lower.includes('- match quality:')) {
        matchQualityStr = line.split(':')[1]?.trim() || 'Excellent Match';
      } else if (lower.includes('- recommendation rationale:')) {
        rationale = line.split(':')[1]?.trim() || '';
      } else if (lower.includes('- **recommendation rationale**:')) {
        rationale = line.split(':')[1]?.trim() || '';
      }
    }

    const cleanEligibility = eligibilityStr.replace(/[\[\]]/g, '').trim();
    const cleanMatchQuality = matchQualityStr.replace(/[\[\]]/g, '').trim();

    let baseFacility: Facility;
    const nameLower = facilityName.toLowerCase();
    if (nameLower.includes('ymca')) {
      baseFacility = BASE_RECS.ymca as any;
    } else if (nameLower.includes('ffc') || nameLower.includes('formula')) {
      baseFacility = BASE_RECS.ffc as any;
    } else {
      baseFacility = BASE_RECS.planet_fitness as any;
    }

    let cost = baseFacility.pricing.cost;
    if (priceStr.toLowerCase().includes('free') || priceStr.includes('$0')) {
      cost = 0;
    } else {
      const priceMatch = priceStr.match(/\$(\d+)/);
      if (priceMatch) {
        cost = parseFloat(priceMatch[1]);
      }
    }

    let walkingTime = baseFacility.distance.walking_time_minutes;
    const walkMatch = distanceStr.match(/(\d+)\s*min/);
    if (walkMatch) {
      walkingTime = parseInt(walkMatch[1]);
    }

    const facility: Facility = {
      ...baseFacility,
      name: facilityName,
      pricing: {
        ...baseFacility.pricing,
        cost,
        pass_detail: priceStr || baseFacility.pricing.pass_detail
      },
      distance: {
        ...baseFacility.distance,
        walking_time_minutes: walkingTime,
        description: distanceStr || baseFacility.distance.description
      }
    };

    const isFree = cost === 0;
    const card_summary = `✓ ${isFree ? 'Free' : `$${cost}`} • ${walkingTime}-minute walk • Open until 10 PM`;

    recommendations.push({
      facility,
      rank,
      match_quality: (cleanMatchQuality || 'Excellent Match') as any,
      eligibility_status: (cleanEligibility || 'Fits Your Criteria') as any,
      recommendation_reason: rationale || 'Recommended by TravelWell AI based on preferences.',
      card_summary,
      badge_subtitle: rank === 1 ? 'Highest overall score' : rank === 2 ? 'Highest rating' : 'Lowest paid guest pass'
    });

    rank++;
  }

  return recommendations;
}

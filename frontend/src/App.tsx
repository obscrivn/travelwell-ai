import React, { useState } from 'react';
import { runConciergeStream, parseMarkdownToRecommendations } from './api/client';
import './App.css';
import { 
  Sparkles, 
  AlertTriangle,
  Calendar,
  Activity,
  Check,
  MapPin,
  ExternalLink,
  Phone,
  Clock,
  Compass
} from 'lucide-react';

export interface Facility {
  id: string;
  name: string;
  address: string;
  phone: string;
  website: string;
  rating: number;
  amenities: string[];
  emoji_badges: string[];
  pricing: {
    access_type: string;
    cost: number;
    pass_detail: string;
  };
  hours: {
    open: string;
    close: string;
    warning: string | null;
    pool_hours: string | null;
  };
  distance: {
    value_miles: number;
    walking_time_minutes: number;
    transit_time_minutes: number;
    description: string;
  };
  reviews_summary: string;
  crowd_warning: string | null;
  recommendation_metadata: {
    best_for: string;
    limitations: string;
  };
}

export interface Recommendation {
  facility: Facility;
  rank: number;
  match_quality: 'Excellent Match' | 'Good Alternative' | 'Limited Match';
  recommendation_reason: string;
  eligibility_status: 'Fits Your Criteria' | 'Alternative' | 'Rejected';
  card_summary: string;
  badge_subtitle: string;
}

const USER_FACILITIES_ELIGIBLE: Recommendation[] = [
  {
    rank: 1,
    match_quality: 'Excellent Match',
    eligibility_status: 'Fits Your Criteria',
    recommendation_reason: 'Chosen because it is fully covered by your YMCA membership reciprocity, features an indoor lap pool and modern treadmills, and is a convenient 10-minute walk.',
    card_summary: '✓ Free with your YMCA membership • 10-minute walk • Open until 10 PM',
    badge_subtitle: 'Highest overall score',
    facility: {
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
    }
  },
  {
    rank: 2,
    match_quality: 'Excellent Match',
    eligibility_status: 'Fits Your Criteria',
    recommendation_reason: 'A premium option that meets all your preferences and constraints, including both an indoor pool and treadmills. Saline pool is top-tier.',
    card_summary: '✓ High rating • 18-minute walk • Open until 9 PM',
    badge_subtitle: 'Highest rating',
    facility: {
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
    }
  },
  {
    rank: 3,
    match_quality: 'Good Alternative',
    eligibility_status: 'Fits Your Criteria',
    recommendation_reason: 'A budget-friendly option that meets your treadmill and shower requirements and is open 24 hours. Does not have an indoor pool.',
    card_summary: '✓ Lowest paid day pass • 22-minute walk • Open 24h',
    badge_subtitle: 'Lowest paid guest pass',
    facility: {
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
        pass_detail: '$10 day pass for non-members'
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
  }
];

const USER_FACILITIES_IMPOSSIBLE: Recommendation[] = [
  {
    rank: 1,
    match_quality: 'Limited Match',
    eligibility_status: 'Alternative',
    recommendation_reason: 'Budget Cap Exceeded: Day pass cost of $10.0 exceeds your budget limit. It does meet your treadmill and shower preferences.',
    card_summary: '✓ 22-minute walk • Exceeds $5 budget cap',
    badge_subtitle: 'Lowest paid guest pass',
    facility: {
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
      reviews_summary: 'Clean, cheap, open 24/7.',
      crowd_warning: 'Moderate crowd expected.',
      recommendation_metadata: {
        best_for: 'Standard treadmills.',
        limitations: 'Day pass is $10, which exceeds the budget limit.'
      }
    }
  },
  {
    rank: 2,
    match_quality: 'Limited Match',
    eligibility_status: 'Alternative',
    recommendation_reason: 'Budget Cap Exceeded: Day pass cost of $25.0 exceeds your budget limit. It includes an indoor pool, showers, and is a short 10-minute walk.',
    card_summary: '✓ 10-minute walk • Exceeds $5 budget cap',
    badge_subtitle: 'Pool & Treadmills included',
    facility: {
      id: 'ymca_chicago',
      name: 'Downtown Chicago YMCA',
      address: '30 S Michigan Ave, Chicago, IL 60603',
      phone: '+1 (312) 269-0500',
      website: 'https://www.ymcachicago.org',
      rating: 4.5,
      amenities: ['pool', 'treadmill', 'showers', 'lockers'],
      emoji_badges: ['🏊 Pool', '🏃 Treadmill', '🚿 Showers', '🔒 Lockers'],
      pricing: {
        access_type: 'day_pass',
        cost: 25.0,
        pass_detail: '$25 day pass without membership'
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
      reviews_summary: 'Great loop gym, standard guest policies apply.',
      crowd_warning: 'Moderate crowd expected.',
      recommendation_metadata: {
        best_for: 'Loop gym access.',
        limitations: 'Price is over the requested budget.'
      }
    }
  }
];

export default function App() {
  // Input fields
  const [location, setLocation] = useState("Downtown Chicago");
  const [budgetSelection, setBudgetSelection] = useState("20");
  const [hasYmca, setHasYmca] = useState(true);
  const [timeWindow, setTimeWindow] = useState("6:00 PM - 9:00 PM");
  
  // Required
  const [showersReq, setShowersReq] = useState(true);
  const [parkingReq, setParkingReq] = useState(false);

  // Preferred
  const [poolPref, setPoolPref] = useState(true);
  const [treadmillPref, setTreadmillPref] = useState(true);

  // Search execution status
  const [isSearching, setIsSearching] = useState(false);
  const [currentStageIndex, setCurrentStageIndex] = useState(-1);
  const [showResults, setShowResults] = useState(false);
  const [noOptionSatisfiesConstraints, setNoOptionSatisfiesConstraints] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [selectedRecId, setSelectedRecId] = useState<string>("");
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Premium Vertical Timeline Stages
  const timelineStages = [
    { 
      icon: "🧠", 
      title: "Understood your trip", 
      sentence: "Parsed location, time window, budget, membership, and preferences.",
      emoji: "🏃"
    },
    { 
      icon: "📍", 
      title: "Found nearby facilities", 
      sentence: "Located fitness options near Downtown Chicago.",
      emoji: "🏊"
    },
    { 
      icon: "🔑", 
      title: "Checked access", 
      sentence: "Compared day passes, YMCA reciprocity, and budget fit.",
      emoji: "💪"
    },
    { 
      icon: "🏊", 
      title: "Verified amenities", 
      sentence: "Checked pool, treadmill, showers, lockers, towels, and parking.",
      emoji: "🏃"
    },
    { 
      icon: "⭐", 
      title: "Ranked options", 
      sentence: "Compared distance, cost, rating, and amenity match.",
      emoji: "🏆"
    },
    { 
      icon: "🚗", 
      title: "Estimated travel", 
      sentence: "Calculated walking and driving times.",
      emoji: "🚴"
    },
    { 
      icon: "🛡️", 
      title: "Validated constraints", 
      sentence: "Applied the Policy & Validation Layer before showing results.",
      emoji: "🛡️"
    }
  ];

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSearching(true);
    setCurrentStageIndex(0);
    setShowResults(false);
    setNoOptionSatisfiesConstraints(false);
    setIsDemoMode(false);

    const animateStages = async () => {
      for (let i = 0; i < timelineStages.length; i++) {
        setCurrentStageIndex(i);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    };

    const runBackendStream = async () => {
      try {
        const fullMarkdownText = await runConciergeStream({
          location,
          timeWindow,
          budgetSelection,
          hasYmca,
          showersReq,
          parkingReq,
          poolPref,
          treadmillPref
        }, (event) => {
          if (event.author === 'research_intelligence') {
            setCurrentStageIndex(prev => Math.min(Math.max(prev, 1), 3));
          } else if (event.author === 'ranking_itinerary') {
            setCurrentStageIndex(prev => Math.min(Math.max(prev, 4), 5));
          } else if (event.author === 'policy_validation') {
            setCurrentStageIndex(6);
          }
        }, () => {});

        const parsed = parseMarkdownToRecommendations(fullMarkdownText);
        if (parsed && parsed.length > 0) {
          setRecommendations(parsed);
          setSelectedRecId(parsed[0].facility.id);
          const hasImpossible = parsed.some(r => r.eligibility_status === 'Rejected' || r.eligibility_status === 'Alternative');
          setNoOptionSatisfiesConstraints(hasImpossible);
          setIsDemoMode(false);
        } else {
          throw new Error("No recommendations parsed");
        }
      } catch (err) {
        console.error("Backend concierge unavailable, falling back to static demo:", err);
        setIsDemoMode(true);
        await animateStages();
        if (budgetSelection === "free" || budgetSelection === "10" || !hasYmca) {
          setNoOptionSatisfiesConstraints(true);
          setRecommendations(USER_FACILITIES_IMPOSSIBLE);
          setSelectedRecId(USER_FACILITIES_IMPOSSIBLE[0].facility.id);
        } else {
          setRecommendations(USER_FACILITIES_ELIGIBLE);
          setSelectedRecId(USER_FACILITIES_ELIGIBLE[0].facility.id);
        }
      }
    };

    await Promise.all([
      runBackendStream(),
      new Promise(resolve => setTimeout(resolve, 1500))
    ]);

    setIsSearching(false);
    setShowResults(true);
  };

  const selectedRec = recommendations.find(r => r.facility.id === selectedRecId);

  const getPhotoUrl = (id: string) => {
    if (id === 'ymca_chicago') return 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?auto=format&fit=crop&w=400&q=80';
    if (id === 'ffc_union') return 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&w=400&q=80';
    return 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=400&q=80';
  };

  const getRankBadgeClass = (rank: number) => {
    if (rank === 1) return "quality-badge best";
    if (rank === 2) return "quality-badge alternative";
    return "quality-badge value";
  };

  const getRankLabel = (rank: number) => {
    if (rank === 1) return "🏆 Best Match";
    if (rank === 2) return "⭐ Premium Club";
    return "💰 Lowest Paid Pass";
  };

  return (
    <div className="app-container">
      
      {/* 1. TOP NAV */}
      <header className="top-nav">
        <div className="brand-section">
          <div className="brand-logo">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="brand-name">TravelWell AI</div>
            <div className="brand-tagline">Intelligent workout concierge on the road</div>
          </div>
        </div>
      </header>

      {/* 2. HERO GREETING */}
      <section className="hero">
        <div className="concierge-summary-card" style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '12px 16px', borderRadius: '8px', fontSize: '0.85rem', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <span>👋</span>
          <span><strong>Hello! I am your AI Fitness Concierge.</strong> Please make your selections below and I will find exactly where you can work out on your trip.</span>
        </div>
        <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '4px 0 0 0' }}>Find matches that fit your active memberships, travel schedule, and facility checklists.</p>
      </section>

      {/* 3. DASHBOARD GRID (3 Columns: Form, Map, Vertical Workflow) */}
      <div className="dashboard-grid">
        
        {/* Left Card: Trip Planner Form */}
        <div className="white-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
            <Sparkles className="w-4 h-4 text-blue-600" />
            <h2 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>Configure Wellness Search</h2>
          </div>

          <form onSubmit={handleSearchSubmit}>
            <div className="form-group">
              <label>Location coordinates</label>
              <input 
                type="text" 
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="form-input" 
                placeholder="Hotel, coordinates, or city..."
              />
            </div>

            <div className="form-group">
              <label>Available travel window</label>
              <input 
                type="text" 
                value={timeWindow}
                onChange={(e) => setTimeWindow(e.target.value)}
                className="form-input" 
                placeholder="e.g. 6:00 PM - 9:00 PM"
              />
            </div>

            {/* Clickable Budget Chips */}
            <div className="form-group">
              <label>Pass Budget Cap</label>
              <div className="budget-chips-container">
                <button
                  type="button"
                  onClick={() => setBudgetSelection("none")}
                  className={`budget-chip ${budgetSelection === "none" ? 'active' : ''}`}
                >
                  No limit
                </button>
                <button
                  type="button"
                  onClick={() => setBudgetSelection("free")}
                  className={`budget-chip ${budgetSelection === "free" ? 'active' : ''}`}
                >
                  Free only
                </button>
                <button
                  type="button"
                  onClick={() => setBudgetSelection("10")}
                  className={`budget-chip ${budgetSelection === "10" ? 'active' : ''}`}
                >
                  Under $10
                </button>
                <button
                  type="button"
                  onClick={() => setBudgetSelection("20")}
                  className={`budget-chip ${budgetSelection === "20" ? 'active' : ''}`}
                >
                  Under $20
                </button>
                <button
                  type="button"
                  onClick={() => setBudgetSelection("30")}
                  className={`budget-chip ${budgetSelection === "30" ? 'active' : ''}`}
                >
                  Under $30
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>YMCA RECIPROCITY</label>
              <div className="pills-container">
                <button
                  type="button"
                  onClick={() => setHasYmca(true)}
                  className={`toggle-btn ${hasYmca ? 'active' : ''}`}
                >
                  {hasYmca && <Check className="w-3.5 h-3.5" />}
                  Active Member
                </button>
                <button
                  type="button"
                  onClick={() => setHasYmca(false)}
                  className={`toggle-btn ${!hasYmca ? 'active' : ''}`}
                >
                  {!hasYmca && <Check className="w-3.5 h-3.5" />}
                  No YMCA
                </button>
              </div>
            </div>

            {/* Required Preferences */}
            <div className="form-group">
              <label>Required Constraints</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowersReq(!showersReq)}
                  className={`toggle-btn ${showersReq ? 'active' : ''}`}
                >
                  {showersReq && <Check className="w-3.5 h-3.5" />}
                  🚿 Showers
                </button>
                <button
                  type="button"
                  onClick={() => setParkingReq(!parkingReq)}
                  className={`toggle-btn ${parkingReq ? 'active' : ''}`}
                >
                  {parkingReq && <Check className="w-3.5 h-3.5" />}
                  🅿️ Free parking
                </button>
              </div>
            </div>

            {/* Preferred Preferences */}
            <div className="form-group" style={{ marginBottom: '10px' }}>
              <label>Preferred Amenities</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setPoolPref(!poolPref)}
                  className={`toggle-btn ${poolPref ? 'active' : ''}`}
                >
                  {poolPref && <Check className="w-3.5 h-3.5" />}
                  🏊 Indoor pool
                </button>
                <button
                  type="button"
                  onClick={() => setTreadmillPref(!treadmillPref)}
                  className={`toggle-btn ${treadmillPref ? 'active' : ''}`}
                >
                  {treadmillPref && <Check className="w-3.5 h-3.5" />}
                  🏃 Treadmill
                </button>
              </div>
            </div>

            {/* Summary Box */}
            <div className="summary-box" style={{ marginBottom: '10px' }}>
              <strong>Selections Summary:</strong><br />
              📍 {location} | Budget: {budgetSelection === "none" ? "No limit" : budgetSelection === "free" ? "Free" : `Under $${budgetSelection}`} | YMCA: {hasYmca ? "Yes" : "No"} | 
              Constraints: {[showersReq ? "Showers" : null, parkingReq ? "Free Parking" : null, poolPref ? "Pool" : null, treadmillPref ? "Treadmill" : null].filter(Boolean).join(", ") || "None"}
            </div>

            <button type="submit" className="btn-submit">
              {isSearching ? 'Orchestrating...' : '🔍 Find My Workout'}
            </button>
          </form>
        </div>

        {/* Middle Card: Fake Map Panel */}
        <div className="white-card" style={{ padding: '12px', position: 'relative' }}>
          <div className="map-visual">
            <svg className="w-full h-full" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} viewBox="0 0 800 450" preserveAspectRatio="none">
              <defs>
                <pattern id="grid-dots" width="30" height="30" patternUnits="userSpaceOnUse">
                  <circle cx="1.5" cy="1.5" r="1.2" fill="rgba(37, 99, 235, 0.04)" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid-dots)" />

              {/* Street grids with text labels */}
              <path d="M 120 0 L 120 450" stroke="#e2e8f0" strokeWidth="5" />
              <path d="M 330 0 L 330 450" stroke="#e2e8f0" strokeWidth="5" />
              <path d="M 640 0 L 640 450" stroke="#e2e8f0" strokeWidth="5" />
              <path d="M 0 160 L 800 160" stroke="#e2e8f0" strokeWidth="5" />
              <path d="M 0 320 L 800 320" stroke="#e2e8f0" strokeWidth="5" />

              <text x="128" y="40" fill="#94a3b8" fontSize="9" fontWeight="bold">Halsted St</text>
              <text x="338" y="40" fill="#94a3b8" fontSize="9" fontWeight="bold">Jackson Blvd</text>
              <text x="648" y="40" fill="#94a3b8" fontSize="9" fontWeight="bold">Michigan Ave</text>
              <text x="20" y="152" fill="#94a3b8" fontSize="9" fontWeight="bold">Wacker Dr</text>
              <text x="20" y="312" fill="#94a3b8" fontSize="9" fontWeight="bold">State St</text>

              {/* Walking Radius Circles from starting hotel */}
              <circle cx="450" cy="220" r="120" fill="none" stroke="rgba(37, 99, 235, 0.05)" strokeWidth="1" strokeDasharray="4,4" />
              <text x="450" y="335" fill="#94a3b8" fontSize="8" textAnchor="middle">10 min walk radius</text>
              <circle cx="450" cy="220" r="230" fill="none" stroke="rgba(37, 99, 235, 0.03)" strokeWidth="1" strokeDasharray="4,4" />
              <text x="450" y="442" fill="#94a3b8" fontSize="8" textAnchor="middle">20 min walk radius</text>

              {/* Travel routes to gyms: Blue for selected, Gray for alternatives */}
              {showResults && recommendations.map((rec) => {
                const isSelected = rec.facility.id === selectedRecId;
                const pathD = rec.facility.id === 'ymca_chicago' 
                  ? "M 450 220 L 640 220 L 640 280" 
                  : rec.facility.id === 'ffc_union'
                    ? "M 450 220 L 330 220 L 330 300"
                    : "M 450 220 L 120 220 L 120 180";
                return (
                  <path 
                    key={rec.facility.id}
                    d={pathD} 
                    fill="none" 
                    stroke={isSelected ? "#2563eb" : "#cbd5e1"} 
                    strokeWidth={isSelected ? "4.5" : "2.5"} 
                    strokeDasharray={isSelected ? "none" : "5,5"}
                    opacity={isSelected ? "1" : "0.6"}
                  />
                );
              })}

              {/* Starting hotel pin */}
              <circle cx="450" cy="220" r="7" fill="#ef4444" stroke="#ffffff" strokeWidth="2.5" />
              <text x="450" y="202" fill="#1e293b" fontSize="9" fontWeight="bold" textAnchor="middle">📍 Your Hotel</text>
            </svg>

            {/* Pins directly with names attached */}
            {showResults && recommendations.map((rec) => {
              const isSelected = rec.facility.id === selectedRecId;
              const position = rec.facility.id === 'ymca_chicago' 
                ? { left: '640px', top: '280px' } 
                : rec.facility.id === 'ffc_union'
                  ? { left: '330px', top: '300px' }
                  : { left: '120px', top: '180px' };

              const pinLabel = rec.rank === 1 ? "🏆 YMCA" : rec.rank === 2 ? "② FFC" : "③ Planet Fitness";

              return (
                <div 
                  key={rec.facility.id}
                  onClick={() => setSelectedRecId(rec.facility.id)}
                  style={{
                    position: 'absolute',
                    left: position.left,
                    top: position.top,
                    transform: 'translate(-50%, -100%)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    zIndex: isSelected ? 12 : 5
                  }}
                >
                  {/* Small Walk/Drive travel bubble */}
                  <div style={{
                    background: isSelected ? '#1e3a8a' : '#475569',
                    color: '#ffffff',
                    fontSize: '0.58rem',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    marginBottom: '2px',
                    whiteSpace: 'nowrap'
                  }}>
                    🚶{rec.facility.distance.walking_time_minutes}m / 🚗{rec.facility.distance.transit_time_minutes}m
                  </div>

                  <div style={{
                    background: isSelected ? '#2563eb' : '#ffffff',
                    color: isSelected ? '#ffffff' : '#1e293b',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: '4px',
                    border: isSelected ? '1px solid #2563eb' : '1px solid #cbd5e1',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    whiteSpace: 'nowrap'
                  }}>
                    {pinLabel}
                  </div>
                </div>
              );
            })}

            {/* Map Legend */}
            <div className="map-legend">
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '99px', background: '#ef4444', display: 'inline-block' }} />
                <span>Hotel</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <span style={{ width: '12px', height: '2px', background: '#2563eb', display: 'inline-block' }} />
                <span>Selected Route</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <span style={{ width: '12px', height: '0px', borderBottom: '2px dashed #cbd5e1', display: 'inline-block' }} />
                <span>Alternative</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Card: AI Concierge Premium Vertical Timeline */}
        <div className="white-card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div>
            <h2 style={{ fontSize: '0.9rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>AI Concierge</h2>
            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>How I found your recommendation</div>
          </div>

          <div className="timeline-container-v" style={{ marginTop: '8px' }}>
            <div className="timeline-line-v" />

            {timelineStages.map((stage, idx) => {
              const isCurrent = idx === currentStageIndex;
              const isPassed = idx < currentStageIndex || showResults;
              
              let statusClass = 'waiting';
              if (isPassed) {
                statusClass = 'complete';
              } else if (isCurrent) {
                statusClass = 'active';
              }

              return (
                <div key={idx} className={`timeline-item-v ${statusClass}`}>
                  {/* Left node timeline circle/dot */}
                  <div className={`timeline-dot-v ${statusClass}`} />

                  {/* Header Row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, fontSize: '0.725rem', color: isPassed ? '#1e293b' : '#64748b' }}>
                    <span>{stage.icon}</span>
                    <span>{stage.title}</span>
                    {isPassed && <span style={{ color: '#10b981', fontSize: '0.65rem', marginLeft: '4px' }}>✓</span>}
                    {isCurrent && (
                      <span className="playful-runner">
                        {stage.emoji}
                      </span>
                    )}
                  </div>

                  {/* Status subtext sentence */}
                  <div style={{ fontSize: '0.625rem', color: isPassed ? '#475569' : '#94a3b8', lineHeight: '1.25' }}>
                    {stage.sentence}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* AI Concierge Summary Banner */}
      {showResults && selectedRec && (
        <div className="concierge-summary-card">
          <strong>💡 AI Recommendation Details:</strong> I found {recommendations.length} spaces matching your selections.
          {selectedRec.rank === 1 ? (
            <span> <strong>{selectedRec.facility.name}</strong> is currently your top match because it {selectedRec.facility.pricing.cost === 0 ? "provides free access" : `costs $${selectedRec.facility.pricing.cost}`}, is only a {selectedRec.facility.distance.walking_time_minutes}-minute walk away, and satisfies your requirements.</span>
          ) : (
            <span> You selected <strong>{selectedRec.facility.name}</strong> (Choice #{selectedRec.rank}) which is located {selectedRec.facility.distance.walking_time_minutes} minutes walk away and has a guest pass cost of ${selectedRec.facility.pricing.cost}.</span>
          )}
        </div>
      )}

      {/* 5. RECOMMENDATIONS GRID */}
      {!showResults && !isSearching && (
        <div className="white-card" style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b', marginBottom: '20px' }}>
          <Compass className="w-8 h-8 text-blue-500" style={{ margin: '0 auto 12px auto' }} />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>No Workout Plan Loaded</h3>
          <p style={{ fontSize: '0.8rem', margin: 0 }}>
            Tell TravelWell where you'll be and what kind of workout you need.
          </p>
        </div>
      )}

      {showResults && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {isDemoMode ? (
            <div className="white-card" style={{ background: '#fef3c7', borderColor: '#fde68a', color: '#92400e', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Using demo data because the live concierge service is unavailable.</span>
              <span style={{ marginLeft: 'auto', background: '#d97706', color: '#fff', fontSize: '0.625rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>Demo fallback data</span>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
              <span style={{ background: '#10b981', color: '#fff', fontSize: '0.625rem', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>✨ Live agent result</span>
            </div>
          )}

          {noOptionSatisfiesConstraints && (
            <div className="white-card" style={{ background: '#fef2f2', borderColor: '#fee2e2', color: '#b91c1c', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>No option satisfies all mandatory constraints. Showing closest alternatives.</span>
            </div>
          )}

          <div className="recommendations-grid">
            {recommendations.map((rec) => {
              const isSelected = rec.facility.id === selectedRecId;
              const badgeSymbol = getRankLabel(rec.rank);
              const badgeClass = getRankBadgeClass(rec.rank);

              return (
                <div
                  key={rec.facility.id}
                  onClick={() => setSelectedRecId(rec.facility.id)}
                  className={`rec-card ${isSelected ? 'selected' : ''}`}
                >
                  {/* Photo Cover Area with bottom gradient overlay */}
                  <div className="photo-area" style={{ backgroundImage: `url(${getPhotoUrl(rec.facility.id)})` }}>
                    <div className="photo-gradient" />
                  </div>

                  <div className="rec-card-body">
                    {/* Badge Column (badge on top, explanation below it) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-start' }}>
                      <span className={badgeClass}>{badgeSymbol}</span>
                      <span style={{ fontSize: '0.65rem', color: '#64748b', fontStyle: 'italic', paddingLeft: '4px' }}>
                        {rec.badge_subtitle}
                      </span>
                    </div>

                    {/* Facility Name Block */}
                    <div>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '4px 0', color: '#0f172a' }}>
                        {rec.facility.name}
                      </h3>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {rec.facility.address}
                      </div>
                    </div>

                    {/* Metrics Row (Free is highlighted) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', padding: '6px 0', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.58rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Rating</div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>⭐ {rec.facility.rating}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.58rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Travel</div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>🚶 {rec.facility.distance.walking_time_minutes}m</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.58rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Day Pass</div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: rec.facility.pricing.cost === 0 ? '#10b981' : '#334155' }}>
                          {rec.facility.pricing.cost === 0 ? "FREE Reciprocity" : `$${rec.facility.pricing.cost}`}
                        </div>
                      </div>
                    </div>

                    {/* Amenities Row */}
                    <div>
                      <div className="amenity-chips">
                        {rec.facility.emoji_badges.map((badge, i) => (
                          <span key={i} className="amenity-chip-item">{badge}</span>
                        ))}
                      </div>
                    </div>

                    {/* Operational Status Row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', fontWeight: 700, color: '#2563eb' }}>
                      <span>🟢 Open now • until {rec.facility.hours.close}</span>
                    </div>

                    {/* Card Concierge summary line at the bottom */}
                    <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '6px', fontSize: '0.68rem', color: '#475569', fontWeight: 500 }}>
                      {rec.card_summary}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. EXPANDED COMPACT TWO-COLUMN SELECTED FACILITY DETAIL VIEW */}
      {showResults && selectedRec && (
        <div className="white-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', paddingBottom: '8px', borderBottom: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '1.2rem' }}>{selectedRec.rank === 1 ? "🏆" : selectedRec.rank === 2 ? "🥈" : "💰"}</span>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
              Selected Facility: {selectedRec.facility.name}
            </h2>
          </div>

          <div className="detail-columns">
            
            {/* Left: Policy Check & rationale */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <h3 style={{ fontSize: '0.8rem', fontWeight: 800, margin: 0 }}>Policy Check</h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div className={`satisfied-chip ${selectedRec.facility.amenities.includes('pool') ? 'yes' : 'no'}`}>
                    <span>{selectedRec.facility.amenities.includes('pool') ? '✅' : '❌'}</span>
                    <span>Indoor pool</span>
                  </div>
                  <div className={`satisfied-chip ${selectedRec.facility.amenities.includes('treadmill') ? 'yes' : 'no'}`}>
                    <span>{selectedRec.facility.amenities.includes('treadmill') ? '✅' : '❌'}</span>
                    <span>Treadmill</span>
                  </div>
                  <div className={`satisfied-chip ${selectedRec.facility.amenities.includes('showers') ? 'yes' : 'no'}`}>
                    <span>{selectedRec.facility.amenities.includes('showers') ? '✅' : '❌'}</span>
                    <span>Showers</span>
                  </div>
                  <div className={`satisfied-chip ${selectedRec.facility.amenities.includes('parking') ? 'yes' : 'no'}`}>
                    <span>{selectedRec.facility.amenities.includes('parking') ? '✅' : '❌'}</span>
                    <span>Free parking {!selectedRec.facility.amenities.includes('parking') && "(not identified in facility data)"}</span>
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '0.78rem', color: '#475569', lineHeight: '1.4' }}>
                <strong>Concierge Details:</strong> {selectedRec.recommendation_reason}
              </div>

              {/* Contact Information block */}
              <div>
                <strong style={{ fontSize: '0.78rem', color: '#0f172a', display: 'block', marginBottom: '6px' }}>Contact Information</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  <div className="info-btn" style={{ cursor: 'default' }}>
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    <span>{selectedRec.facility.address}</span>
                  </div>
                  <a href={`tel:${selectedRec.facility.phone}`} className="info-btn">
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call ({selectedRec.facility.phone})</span>
                  </a>
                  <a href={selectedRec.facility.website} target="_blank" rel="noreferrer" className="info-btn">
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Website</span>
                  </a>
                  <button className="info-btn" onClick={() => alert(`Navigating to ${selectedRec.facility.name}`)}>
                    <Compass className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Open in Maps</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Visit Information */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <Calendar className="w-4 h-4 text-blue-600" />
                <h3 style={{ fontSize: '0.8rem', fontWeight: 800, margin: 0 }}>Visit Information</h3>
              </div>

              <div className="schedule-timeline" style={{ fontSize: '0.78rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock className="w-4 h-4 text-blue-500" />
                  <div>
                    <strong>Hours Status:</strong> Open now • until {selectedRec.facility.hours.close}
                  </div>
                </div>

                {selectedRec.facility.hours.pool_hours && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.9rem' }}>🏊</span>
                    <div>
                      <strong>Pool Schedule:</strong> {selectedRec.facility.hours.pool_hours}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.9rem' }}>⏱️</span>
                  <div>
                    <strong>Estimated Visit Duration:</strong> 90 - 120 minutes recommended.
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.9rem' }}>🚗</span>
                  <div>
                    <strong>Travel Times:</strong> {selectedRec.facility.distance.walking_time_minutes} min walk / {selectedRec.facility.distance.transit_time_minutes} min drive ({selectedRec.facility.distance.description} walk).
                  </div>
                </div>

                {selectedRec.facility.crowd_warning && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fffbeb', border: '1px solid #fef3c7', padding: '6px 10px', borderRadius: '8px', color: '#b45309', fontWeight: 600 }}>
                    <span>⚠️</span>
                    <div>
                      <strong>Crowd warning:</strong> {selectedRec.facility.crowd_warning}
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

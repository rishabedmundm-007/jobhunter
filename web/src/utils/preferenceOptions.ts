export interface Option {
  value: string
  label: string
}

export const JOB_ROLE_OPTIONS: Option[] = [
  { value: 'software_engineer', label: 'Software Engineer' },
  { value: 'frontend_developer', label: 'Frontend Developer' },
  { value: 'backend_developer', label: 'Backend Developer' },
  { value: 'fullstack_developer', label: 'Full Stack Developer' },
  { value: 'mobile_developer', label: 'Mobile Developer (iOS/Android)' },
  { value: 'devops_engineer', label: 'DevOps Engineer' },
  { value: 'site_reliability_engineer', label: 'Site Reliability Engineer (SRE)' },
  { value: 'cloud_engineer', label: 'Cloud Engineer' },
  { value: 'cloud_architect', label: 'Cloud / Solutions Architect' },
  { value: 'data_engineer', label: 'Data Engineer' },
  { value: 'data_scientist', label: 'Data Scientist' },
  { value: 'data_analyst', label: 'Data Analyst' },
  { value: 'machine_learning_engineer', label: 'Machine Learning Engineer' },
  { value: 'qa_engineer', label: 'QA Engineer / SDET' },
  { value: 'security_engineer', label: 'Security Engineer' },
  { value: 'systems_administrator', label: 'Systems Administrator' },
  { value: 'network_engineer', label: 'Network Engineer' },
  { value: 'database_administrator', label: 'Database Administrator (DBA)' },
  { value: 'business_analyst', label: 'Business Analyst' },
  { value: 'product_manager', label: 'Product Manager' },
  { value: 'project_manager', label: 'Project Manager / Scrum Master' },
  { value: 'ui_ux_designer', label: 'UI/UX Designer' },
  { value: 'it_support', label: 'IT Support / Help Desk' },
  { value: 'engineering_manager', label: 'Engineering Manager' },
]

export const EXPERIENCE_LEVEL_OPTIONS: Option[] = [
  { value: 'entry', label: 'Entry Level (0–2 years)' },
  { value: 'mid', label: 'Mid Level (3–5 years)' },
  { value: 'senior', label: 'Senior Level (6+ years)' },
]

export const EMPLOYMENT_TYPE_OPTIONS: Option[] = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'w2', label: 'W2 Contract' },
  { value: 'c2c', label: 'Corp-to-Corp (C2C)' },
]

export const WORK_MODE_OPTIONS: Option[] = [
  { value: 'onsite', label: 'On-site' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'remote', label: 'Remote' },
]

export const SPONSORSHIP_OPTIONS: Option[] = [
  { value: 'citizen_or_gc', label: 'No sponsorship needed (U.S. Citizen / Green Card)' },
  { value: 'h4_ead', label: 'No sponsorship needed (H4-EAD)' },
  { value: 'needs_h1b', label: 'Requires H-1B sponsorship or transfer' },
]

// Major U.S. metropolitan areas the job search radiates outward from.
export const METRO_OPTIONS: Option[] = [
  { value: 'new_york_ny', label: 'New York, NY' },
  { value: 'los_angeles_ca', label: 'Los Angeles, CA' },
  { value: 'chicago_il', label: 'Chicago, IL' },
  { value: 'dallas_tx', label: 'Dallas–Fort Worth, TX' },
  { value: 'houston_tx', label: 'Houston, TX' },
  { value: 'washington_dc', label: 'Washington, DC' },
  { value: 'philadelphia_pa', label: 'Philadelphia, PA' },
  { value: 'miami_fl', label: 'Miami, FL' },
  { value: 'atlanta_ga', label: 'Atlanta, GA' },
  { value: 'boston_ma', label: 'Boston, MA' },
  { value: 'phoenix_az', label: 'Phoenix, AZ' },
  { value: 'san_francisco_ca', label: 'San Francisco Bay Area, CA' },
  { value: 'san_jose_ca', label: 'San Jose / Silicon Valley, CA' },
  { value: 'detroit_mi', label: 'Detroit, MI' },
  { value: 'seattle_wa', label: 'Seattle, WA' },
  { value: 'minneapolis_mn', label: 'Minneapolis–St. Paul, MN' },
  { value: 'san_diego_ca', label: 'San Diego, CA' },
  { value: 'tampa_fl', label: 'Tampa, FL' },
  { value: 'denver_co', label: 'Denver, CO' },
  { value: 'baltimore_md', label: 'Baltimore, MD' },
  { value: 'st_louis_mo', label: 'St. Louis, MO' },
  { value: 'orlando_fl', label: 'Orlando, FL' },
  { value: 'charlotte_nc', label: 'Charlotte, NC' },
  { value: 'san_antonio_tx', label: 'San Antonio, TX' },
  { value: 'portland_or', label: 'Portland, OR' },
  { value: 'austin_tx', label: 'Austin, TX' },
  { value: 'pittsburgh_pa', label: 'Pittsburgh, PA' },
  { value: 'sacramento_ca', label: 'Sacramento, CA' },
  { value: 'las_vegas_nv', label: 'Las Vegas, NV' },
  { value: 'cincinnati_oh', label: 'Cincinnati, OH' },
  { value: 'kansas_city_mo', label: 'Kansas City, MO' },
  { value: 'columbus_oh', label: 'Columbus, OH' },
  { value: 'indianapolis_in', label: 'Indianapolis, IN' },
  { value: 'cleveland_oh', label: 'Cleveland, OH' },
  { value: 'nashville_tn', label: 'Nashville, TN' },
  { value: 'raleigh_nc', label: 'Raleigh–Durham, NC' },
  { value: 'salt_lake_city_ut', label: 'Salt Lake City, UT' },
  { value: 'milwaukee_wi', label: 'Milwaukee, WI' },
  { value: 'jacksonville_fl', label: 'Jacksonville, FL' },
  { value: 'richmond_va', label: 'Richmond, VA' },
  { value: 'memphis_tn', label: 'Memphis, TN' },
  { value: 'oklahoma_city_ok', label: 'Oklahoma City, OK' },
  { value: 'hartford_ct', label: 'Hartford, CT' },
  { value: 'new_orleans_la', label: 'New Orleans, LA' },
  { value: 'buffalo_ny', label: 'Buffalo, NY' },
  { value: 'albuquerque_nm', label: 'Albuquerque, NM' },
  { value: 'tucson_az', label: 'Tucson, AZ' },
  { value: 'fresno_ca', label: 'Fresno, CA' },
  { value: 'omaha_ne', label: 'Omaha, NE' },
  { value: 'louisville_ky', label: 'Louisville, KY' },
]

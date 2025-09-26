export type ClinicMetrics = {
  clinic_id: string | null;
  clinic_name: string | null;
  score: number | null;
  rank: number | null;
  competitors: number | null;
  synergy: number | null;
  detractors: number | null;
  population: number | null;
  median_income: number | null;
  window_days: number | null;
  slots_available: number | null;
  total_slots_offered: number | null;
  slots_booked: number | null;
  fill_rate_pct: number | null;
  lead_time_hours_to_next_available: number | null;
  appointment_lead_time_hours: number | null;
  avg_lead_time_hours: number | null;
  available_pct_peak: number | null;
  available_pct_offpeak: number | null;
  peak_definition_text: string | null;
  total_appointment_types: number | null;
  pet_types_available: string | null;
  total_pets_supported: number | null;
  snapshot_ingested_at: string | null;
  city: string | null;
  state: string | null;
  full_address: string | null;
  website_url: string | null;
  phone_number: string | null;
  bms_system: string | null;
  doctor_count: number | null;
};

export type ClinicFeature = {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: ClinicMetrics;
};

export type ClinicFeatureCollection = {
  type: 'FeatureCollection';
  features: ClinicFeature[];
};

import { createClient } from '@supabase/supabase-js';

const GeobaseUrl = process.env.NEXT_PUBLIC_Geobase_URL!;
const GeobaseKey = process.env.NEXT_PUBLIC_Geobase_ANON_KEY!;

export const Geobase = createClient(GeobaseUrl, GeobaseKey);


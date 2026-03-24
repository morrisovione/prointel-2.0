// ════════════════════════════════════════════════
//  PROINTEL 2.0 — supabase.js
//  Configuración y conexión con Supabase
// ════════════════════════════════════════════════

const SUPABASE_URL     = "https://xcipcclwatrgwvezvqsu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjaXBjY2x3YXRyZ3d2ZXp2cXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMzk0NTEsImV4cCI6MjA4OTgxNTQ1MX0.70gsByeT0AFTPoN-qP3T6zU8fC5kvlMFgPGgA9dcSYg";

// Usamos el objeto global que expone el CDN de Supabase
const { createClient } = supabase;

// Creamos el cliente y lo exponemos como window.supabase
// para que app.js lo pueda usar sin errores de referencia
window.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("PROINTEL 2.0 ✓ — Conexión con Supabase establecida.");

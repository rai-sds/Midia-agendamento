// Conexão com seu projeto Supabase (global)
const supabaseUrl = "https://qqafsnipdwmnqejddqsm.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxYWZzbmlwZHdtbnFlamRkcXNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0NTU4NjUsImV4cCI6MjA3NjAzMTg2NX0.lj7nuV2u6p1HzHA4nz3rcnlUm3yoUS2iEORiFrcsSS4";

// Cria o cliente Supabase e expõe como global
window.supabase = supabase.createClient(supabaseUrl, supabaseKey);

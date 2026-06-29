import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://hconlmrrerltnmryzdll.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhjb25sbXJyZXJsdG5tcnl6ZGxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0ODQ4NDIsImV4cCI6MjA5ODA2MDg0Mn0.uZfnUonT1eN06yyLhDWaYXe8qzoNLC2gJ6EPB8pkoGI";
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('Transaksi')
    .select('*')
    .eq('Metode', 'Pesanan Online')
    .order('Waktu', { ascending: false })
    .limit(5);

  if (error) console.error("Error:", error);
  else console.log("Recent Pesanan Online:", data);
}

check();

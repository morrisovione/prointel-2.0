// supabase.js - Instancia global de Supabase
const SUPABASE_URL = 'https://tqqijdztibhudqeyxgjn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxcWlqZHp0aWJodWRxZXl4Z2puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjc5MjkxOTgsImV4cCI6MjA0MzUwNTE5OH0.vt1BkJ3RNJgGfZJKVwQVY56hqzn0dPr8yMQzAKGiCXw';

window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
console.log('✅ Supabase inicializado');
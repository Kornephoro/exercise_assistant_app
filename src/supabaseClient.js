import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lciflmremkrqcgwtqmrt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjaWZsbXJlbWtycWNnd3RxbXJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNjQxNzMsImV4cCI6MjA5NTg0MDE3M30.EFIIz2rAVzlhrgqZzkb6q1GLQuPH61oiSGTi2t_LqOk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

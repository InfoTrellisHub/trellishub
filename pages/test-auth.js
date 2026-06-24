const { supabase } = require('../lib/supabase');

async function runAuthTests() {
  if (!supabase) {
    console.error('Supabase anon client is null — check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.');
    process.exit(1);
  }

  // 1. Sign up test
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: 'testuser@example.com',
    password: 'StrongPassword123!'
  });

  if (signUpError) {
    console.error('Sign-up error:', signUpError.message);
  } else {
    console.log('Sign-up success:', signUpData);
  }

  // 2. Sign in test
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: 'testuser@example.com',
    password: 'StrongPassword123!'
  });

  if (signInError) {
    console.error('Sign-in error:', signInError.message);
  } else {
    console.log('Sign-in success:', signInData);
  }
}

runAuthTests();

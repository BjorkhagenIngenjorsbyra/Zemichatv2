-- Fix: GRANT for update_user_profile with new 2-argument signature
GRANT EXECUTE ON FUNCTION update_user_profile(TEXT, TEXT) TO authenticated;

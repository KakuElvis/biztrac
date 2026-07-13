import { isSupabaseConfigured, supabase } from "../lib/supabase.js";

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured. Add the project URL and anon key to .env.");
  }

  return supabase;
}

export async function getSession() {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await requireSupabase().auth.getSession();
  if (error) throw error;
  return data.session;
}

export function subscribeToAuthChanges(callback) {
  if (!isSupabaseConfigured) return () => {};

  const {
    data: { subscription },
  } = requireSupabase().auth.onAuthStateChange((event, session) => callback(session, event));

  return () => subscription.unsubscribe();
}

export async function signUpWithBusiness({
  businessName,
  businessPhone,
  businessEmail,
  location,
  ownerName,
  ownerEmail,
  password,
}) {
  const { data, error } = await requireSupabase().auth.signUp({
    email: ownerEmail,
    password,
    options: {
      data: {
        full_name: ownerName,
        business_name: businessName,
        business_phone: businessPhone,
        business_email: businessEmail,
        business_location: location,
      },
    },
  });

  if (error) throw error;
  return data;
}

export async function signIn({ email, password }) {
  const { data, error } = await requireSupabase().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function sendPasswordReset(email) {
  const { error } = await requireSupabase().auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  if (error) throw error;
}

export async function updatePassword(password) {
  const { error } = await requireSupabase().auth.updateUser({ password });
  if (error) throw error;
}

export async function signOut() {
  if (!isSupabaseConfigured) return;

  const { error } = await requireSupabase().auth.signOut();
  if (error) throw error;
}

export async function getWorkspace(userId) {
  const { data, error } = await requireSupabase()
    .from("business_members")
    .select("role, businesses(id, name, phone, email, location, logo_url, currency)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.businesses) return null;

  return {
    role: data.role,
    business: data.businesses,
  };
}

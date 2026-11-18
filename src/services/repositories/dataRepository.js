import { supabaseRepository } from "./supabaseRepository.js";

export function getRepository() {
  return supabaseRepository;
}

export { supabaseRepository };

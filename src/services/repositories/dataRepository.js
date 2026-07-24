import { demoRepository } from "./demoRepository.js";
import { supabaseRepository } from "./supabaseRepository.js";

export function getRepository(isDemo) {
  return isDemo ? demoRepository : supabaseRepository;
}

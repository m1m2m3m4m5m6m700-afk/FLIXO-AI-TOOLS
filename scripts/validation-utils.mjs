export const CANONICAL_LOCALES = ['ar','en','es','fr','de','ru','zh','hi','id','ur','ja','pt','it','ko','nl','pl','tr','vi','th','sv'];

export function failValidation(message) {
  console.error(`Validation gate failed: ${message}`);
  process.exit(1);
}

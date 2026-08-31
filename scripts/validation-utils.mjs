export const CANONICAL_LOCALES = ['ar','en','es','fr','de','hi','id','it','ja','ko','ms','nl','pl','pt','ru','sv','th','tr','uk','vi'];

export function failValidation(message) {
  console.error(`Validation gate failed: ${message}`);
  process.exit(1);
}

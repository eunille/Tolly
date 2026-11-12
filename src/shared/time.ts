// Clock reads live here, outside components, so render stays pure for the React Compiler.
export const nowMs = () => Date.now();

export function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

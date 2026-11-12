// Web preview only. Browsers have no keychain, so values (including the Autosweep password) sit in
// localStorage on this computer. The web build is for looking at the UI; never ship it to users.
const store = () => (typeof localStorage === 'undefined' ? null : localStorage); // undefined during server render

export const kvGet = async (key: string) => store()?.getItem(`toll.${key}`) ?? null;
export const kvSet = async (key: string, value: string) => store()?.setItem(`toll.${key}`, value);
export const kvDelete = async (key: string) => store()?.removeItem(`toll.${key}`);

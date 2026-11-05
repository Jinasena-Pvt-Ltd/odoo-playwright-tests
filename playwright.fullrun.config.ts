import base from './playwright.config';
export default { ...base, reporter: [['list'], ...((base.reporter as any[]) ?? [])] };

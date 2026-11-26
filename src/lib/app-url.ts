export const getAppUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");

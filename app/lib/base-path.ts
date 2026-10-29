// The path under which the whole app is served, without a trailing slash. This is the only place
// that names it: routing, asset URLs, cookies and emailed links all derive from this constant.
export const BASE_PATH = "/verhandlungstermin-finder";

// Better Auth's endpoints, which the "api/auth/*" route serves under BASE_PATH.
export const AUTH_BASE_PATH = `${BASE_PATH}/api/auth`;

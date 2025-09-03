export const ENV = {
  GATEWAY_URL: process.env.GATEWAY_URL || "http://localhost:3000",
  // No secrets in containers; runs receive short-lived gateway tokens in future tasks
};

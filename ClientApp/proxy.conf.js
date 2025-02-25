const { env } = require('process');

const target = env.ASPNETCORE_HTTPS_PORT ? `http://localhost:${env.ASPNETCORE_HTTPS_PORT}` :
env.ASPNETCORE_URLS ? env.ASPNETCORE_URLS.split(';')[0] : 'http://localhost:54509';

const path = "/proxy_path/*";
const proxy = "/proxy_path/";

const pathRewrite = {};
pathRewrite["^" + proxy.slice(0, -1)] = "";

const configs = {
  context: [
    "/images/**",
    "/files/**",
    "/api/**",
    "/api/*",
  ],

  target: "target",
  secure: false,
  changeOrigin: true,
  pathRewrite,
  logLevel: "debug"
}

const PROXY_CONFIG = {};
PROXY_CONFIG[path] = configs;
module.exports = PROXY_CONFIG;


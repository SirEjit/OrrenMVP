export const config = {
  server: {
    host: '0.0.0.0',
    port: parseInt(process.env.PORT || '5000', 10),
  },
  xrpl: {
    server: process.env.XRPL_SERVER || 'wss://s1.ripple.com',
  },
  cache: {
    maxSize: 100,
    ttlMs: 5000,
  },
} as const;

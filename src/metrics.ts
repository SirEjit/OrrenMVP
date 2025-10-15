import { FastifyInstance } from "fastify";

let quotesTotal = 0;
let winsTotal = 0;
let latencies: number[] = [];
let improvements: number[] = [];

/** recorders */
export function recordQuoteLatency(ms: number) { latencies.push(ms); if (latencies.length > 2000) latencies.shift(); }
export function recordWin(netOut: number, nativeOut?: number) {
  quotesTotal++;
  if (nativeOut && netOut >= nativeOut) winsTotal++;
}
export function recordImprovement(bps?: number) {
  if (bps !== undefined && Number.isFinite(bps)) {
    improvements.push(bps);
    if (improvements.length > 2000) improvements.shift();
  }
}

function median(a: number[]) {
  if (a.length === 0) return 0;
  const b = [...a].sort((x,y)=>x-y);
  const mid = Math.floor(b.length/2);
  return b.length%2 ? b[mid] : (b[mid-1]+b[mid])/2;
}

export async function registerMetricsRoute(app: FastifyInstance) {
  app.get("/metrics", async (req, reply) => {
    const hitRatio = 0; // plug your cache stats here if you track them
    const winRatio = quotesTotal ? winsTotal / quotesTotal : 0;
    const medLatency = median(latencies);
    const medImprovement = median(improvements);

    const lines = [
      `# HELP orren_quote_latency_ms Median quote latency`,
      `# TYPE orren_quote_latency_ms gauge`,
      `orren_quote_latency_ms ${medLatency}`,
      `# HELP orren_cache_hit_ratio Cache hit ratio`,
      `# TYPE orren_cache_hit_ratio gauge`,
      `orren_cache_hit_ratio ${hitRatio}`,
      `# HELP orren_native_win_ratio Fraction of quotes where net_out >= native_out`,
      `# TYPE orren_native_win_ratio gauge`,
      `orren_native_win_ratio ${winRatio}`,
      `# HELP orren_improvement_bps_median Median improvement in bps (gross)`,
      `# TYPE orren_improvement_bps_median gauge`,
      `orren_improvement_bps_median ${medImprovement}`
    ];
    reply.header("content-type", "text/plain");
    return lines.join("\n") + "\n";
  });
}

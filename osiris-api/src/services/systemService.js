const os = require("os");

class SystemService {
  static getSystemInfo() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsagePercent = Number(((usedMem / totalMem) * 100).toFixed(2));

    const cpus = os.cpus();
    const cpuModel = cpus[0]?.model || "Generic CPU";
    const cpuCores = cpus.length;

    // Calculate approximate CPU load from core idle/total times
    let idleTime = 0;
    let totalTime = 0;
    for (const core of cpus) {
      for (const type in core.times) {
        totalTime += core.times[type];
      }
      idleTime += core.times.idle;
    }
    const cpuUsagePercent = Number(
      (((totalTime - idleTime) / (totalTime || 1)) * 100).toFixed(2),
    );

    return {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      uptime_seconds: Math.floor(os.uptime()),
      cpu: {
        model: cpuModel,
        cores: cpuCores,
        usage_percent: cpuUsagePercent,
      },
      memory: {
        total_mb: Math.round(totalMem / (1024 * 1024)),
        free_mb: Math.round(freeMem / (1024 * 1024)),
        used_mb: Math.round(usedMem / (1024 * 1024)),
        usage_percent: memUsagePercent,
      },
      node_version: process.version,
    };
  }
}

module.exports = SystemService;

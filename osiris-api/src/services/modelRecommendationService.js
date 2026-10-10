const SystemService = require("./systemService");

class ModelRecommendationService {
  static evaluateModels(models, options = {}) {
    const sysInfo = SystemService.getSystemInfo();
    const totalRamMb = options.target_ram_mb || sysInfo.memory.total_mb;
    const freeRamMb = options.target_free_ram_mb || sysInfo.memory.free_mb;
    const targetTask = (options.task || "").toLowerCase();

    const evaluated = models.map((model) => {
      const ramReq = model.ram_requirement || 2048;
      let compatibility = "unsupported";
      let fitScore = 0;

      if (ramReq <= freeRamMb * 0.85) {
        compatibility = "optimal";
        fitScore = 100;
      } else if (ramReq <= totalRamMb * 0.75) {
        compatibility = "compatible";
        fitScore = 70;
      } else if (ramReq <= totalRamMb) {
        compatibility = "heavy";
        fitScore = 40;
      } else {
        compatibility = "unsupported";
        fitScore = 10;
      }

      // Bonus score if model tags match desired task
      if (targetTask && model.tags) {
        if (model.tags.toLowerCase().includes(targetTask)) {
          fitScore += 25;
        }
      }

      return {
        id_model: model.id_model,
        name: model.name,
        provider: model.provider,
        size: model.size,
        ram_requirement: ramReq,
        tags: model.tags,
        download_url: model.download_url,
        compatibility,
        fit_score: fitScore,
      };
    });

    // Sort by fit_score descending, then ram_requirement ascending
    evaluated.sort((a, b) => b.fit_score - a.fit_score || a.ram_requirement - b.ram_requirement);

    const supported = evaluated.filter((m) => m.compatibility !== "unsupported");
    const primaryRecommendation = supported.length > 0 ? supported[0] : null;

    return {
      hardware_snapshot: {
        total_ram_mb: totalRamMb,
        free_ram_mb: freeRamMb,
        cpu_cores: sysInfo.cpu.cores,
      },
      task_filter: targetTask || "all",
      primary_recommendation: primaryRecommendation,
      recommendations: evaluated,
    };
  }
}

module.exports = ModelRecommendationService;

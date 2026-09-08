/**
 * Validates agent creation/update data
 */
function validateAgent(data, isUpdate = false) {
  const { name, objective, system_prompt } = data;

  // Name validation
  if (!isUpdate && (!name || typeof name !== "string" || !name.trim())) {
    return "Agent name is required and must be a valid string.";
  }

  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      return "Agent name must be a valid non-empty string.";
    }

    if (name.trim().length < 3) {
      return "Agent name must be at least 3 characters long.";
    }

    if (name.trim().length > 255) {
      return "Agent name must not exceed 255 characters.";
    }
  }

  // Objective validation
  if (!isUpdate && (!objective || typeof objective !== "string" || !objective.trim())) {
    return "Agent objective is required and must be a valid string.";
  }

  if (objective !== undefined) {
    if (typeof objective !== "string" || !objective.trim()) {
      return "Agent objective must be a valid non-empty string.";
    }

    if (objective.trim().length < 10) {
      return "Agent objective must be at least 10 characters long.";
    }
  }

  // System prompt validation
  if (!isUpdate && (!system_prompt || typeof system_prompt !== "string" || !system_prompt.trim())) {
    return "Agent system prompt is required and must be a valid string.";
  }

  if (system_prompt !== undefined) {
    if (typeof system_prompt !== "string" || !system_prompt.trim()) {
      return "Agent system prompt must be a valid non-empty string.";
    }

    if (system_prompt.trim().length < 10) {
      return "Agent system prompt must be at least 10 characters long.";
    }
  }

  return null;
}

/**
 * Validates agent execution input
 */
function validateExecutionInput(input) {
  if (!input || typeof input !== "string" || !input.trim()) {
    return "Execution input is required and must be a valid string.";
  }

  if (input.trim().length < 1) {
    return "Execution input cannot be empty.";
  }

  if (input.trim().length > 10000) {
    return "Execution input must not exceed 10000 characters.";
  }

  return null;
}

module.exports = {
  validateAgent,
  validateExecutionInput,
};

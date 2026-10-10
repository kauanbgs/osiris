CREATE DATABASE osiris;

USE osiris;

CREATE TABLE `user` (
    id_user INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL
);

CREATE TABLE ai_model (
    id_model INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(100),
    size INT,
    status VARCHAR(50) NOT NULL,
    download_url TEXT,
    description TEXT,
    ram_requirement INT,
    tags VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO ai_model (name, provider, size, status, download_url, description, ram_requirement, tags) VALUES
('SmolLM2 1.7B Instruct', 'HuggingFace', 1200, 'available',
 'https://huggingface.co/bartowski/SmolLM2-1.7B-Instruct-GGUF/resolve/main/SmolLM2-1.7B-Instruct-Q4_K_M.gguf',
 'Extremely lightweight model for basic tasks and quick responses', 4096, 'lightweight,chat,fast'),

('Qwen2.5 Coder 1.5B Instruct', 'Alibaba', 1100, 'available',
 'https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF/resolve/main/qwen2.5-coder-1.5b-instruct-q4_k_m.gguf',
 'Lightweight model specialized in code generation and completion', 4096, 'code,lightweight,fast'),

('Qwen2.5 1.5B Instruct', 'Alibaba', 1100, 'available',
 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
 'Fast and compact general-purpose chat model', 4096, 'chat,lightweight,fast'),

('Llama 3.2 1B Instruct', 'Meta', 800, 'available',
 'https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf',
 'Compact Meta model for lightweight local inference', 4096, 'chat,lightweight,meta'),

('Llama 3.2 3B Instruct', 'Meta', 2200, 'available',
 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
 'Balanced Meta model with good quality-to-size ratio', 8192, 'chat,balanced,meta'),

('Phi-3.5 Mini Instruct', 'Microsoft', 2400, 'available',
 'https://huggingface.co/bartowski/Phi-3.5-mini-instruct-GGUF/resolve/main/Phi-3.5-mini-instruct-Q4_K_M.gguf',
 'Microsoft reasoning model with strong analytical capabilities', 8192, 'reasoning,balanced,microsoft'),

('Qwen2.5 3B Instruct', 'Alibaba', 2200, 'available',
 'https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf',
 'General-purpose balanced model for diverse tasks', 8192, 'chat,balanced,general'),

('Qwen2.5 Coder 3B Instruct', 'Alibaba', 2200, 'available',
 'https://huggingface.co/Qwen/Qwen2.5-Coder-3B-Instruct-GGUF/resolve/main/qwen2.5-coder-3b-instruct-q4_k_m.gguf',
 'Intermediate code model with enhanced programming capabilities', 8192, 'code,balanced,programming'),

('DeepSeek R1 Distill Qwen 1.5B', 'DeepSeek', 1100, 'available',
 'https://huggingface.co/bartowski/DeepSeek-R1-Distill-Qwen-1.5B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf',
 'Lightweight reasoning model distilled from DeepSeek R1', 4096, 'reasoning,lightweight,deepseek'),

('DeepSeek R1 Distill Qwen 7B', 'DeepSeek', 4700, 'available',
 'https://huggingface.co/bartowski/DeepSeek-R1-Distill-Qwen-7B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-7B-Q4_K_M.gguf',
 'Advanced reasoning model with deep analytical capabilities', 16384, 'reasoning,advanced,deepseek'),

('Mistral 7B Instruct v0.3', 'Mistral AI', 4700, 'available',
 'https://huggingface.co/bartowski/Mistral-7B-Instruct-v0.3-GGUF/resolve/main/Mistral-7B-Instruct-v0.3-Q4_K_M.gguf',
 'High-capacity general model with excellent instruction following', 16384, 'chat,advanced,powerful'),

('Gemma 2 2B Instruct', 'Google', 1800, 'available',
 'https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf',
 'Compact Google model with balanced performance', 6144, 'chat,compact,google');

CREATE TABLE permission (
    id_permission INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT
);

CREATE TABLE tool (
    id_tool INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    type VARCHAR(50),
    active BOOLEAN NOT NULL
);

CREATE TABLE file (
    id_file INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    path VARCHAR(500) NOT NULL,
    extension VARCHAR(50),
    size INT NOT NULL,
    hash VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL
);

CREATE TABLE agent (
    id_agent INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    objective TEXT NOT NULL,
    execution_log VARCHAR(50) NOT NULL,
    system_prompt TEXT NOT NULL,
    fk_id_user INT,
    fk_id_model INT,
    FOREIGN KEY (fk_id_user)
        REFERENCES `user`(id_user)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    FOREIGN KEY (fk_id_model)
        REFERENCES ai_model(id_model)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE TABLE workflows (
    id_workflow INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(255) NOT NULL,
    fk_id_user INT,
    FOREIGN KEY (fk_id_user)
        REFERENCES `user`(id_user)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE TABLE chat (
    id_chat INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    fk_id_user INT,
    FOREIGN KEY (fk_id_user)
        REFERENCES `user`(id_user)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE TABLE node (
    id_node INT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    priority INT NOT NULL,
    fk_id_agent INT,
    fk_id_workflow INT,
    FOREIGN KEY (fk_id_agent)
        REFERENCES agent(id_agent)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    FOREIGN KEY (fk_id_workflow)
        REFERENCES workflows(id_workflow)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE TABLE connection (
    id_connection INT AUTO_INCREMENT PRIMARY KEY,
    fk_id_node_origin INT NOT NULL,
    fk_id_node_destination INT NOT NULL,
    FOREIGN KEY (fk_id_node_origin)
        REFERENCES node(id_node)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    FOREIGN KEY (fk_id_node_destination)
        REFERENCES node(id_node)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE TABLE agent_memory (
    id_memory INT AUTO_INCREMENT PRIMARY KEY,
    content TEXT NOT NULL,
    importance INT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    fk_id_agent INT,
    FOREIGN KEY (fk_id_agent)
        REFERENCES agent(id_agent)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE TABLE user_memory (
    id_memory INT AUTO_INCREMENT PRIMARY KEY,
    content TEXT NOT NULL,
    importance INT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    fk_id_user INT,
    FOREIGN KEY (fk_id_user)
        REFERENCES `user`(id_user)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE TABLE configuration (
    id_configuration INT AUTO_INCREMENT PRIMARY KEY,
    fk_id_user INT NOT NULL,
    `key` VARCHAR(255) NOT NULL,
    value TEXT,
    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (fk_id_user)
        REFERENCES `user`(id_user)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE TABLE user_permission (
    id_user_permission INT AUTO_INCREMENT PRIMARY KEY,
    fk_id_user INT,
    fk_id_permission INT,
    FOREIGN KEY (fk_id_user)
        REFERENCES `user`(id_user)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    FOREIGN KEY (fk_id_permission)
        REFERENCES permission(id_permission)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE TABLE model_installation (
    id_installation INT AUTO_INCREMENT PRIMARY KEY,
    installation_status VARCHAR(50),
    local_path VARCHAR(500),
    download_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fk_id_model INT,
    FOREIGN KEY (fk_id_model)
        REFERENCES ai_model(id_model)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE TABLE api_key (
    id_api_key INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    api_key TEXT NOT NULL,
    fk_id_user INT NOT NULL,
    FOREIGN KEY (fk_id_user)
        REFERENCES `user`(id_user)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE TABLE tool_agent (
    id_tool_agent INT AUTO_INCREMENT PRIMARY KEY,
    fk_id_tool INT,
    fk_id_agent INT,
    FOREIGN KEY (fk_id_tool)
        REFERENCES tool(id_tool)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    FOREIGN KEY (fk_id_agent)
        REFERENCES agent(id_agent)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE TABLE agent_permission (
    id_agent_permission INT AUTO_INCREMENT PRIMARY KEY,
    fk_id_agent INT,
    fk_id_permission INT,
    FOREIGN KEY (fk_id_agent)
        REFERENCES agent(id_agent)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    FOREIGN KEY (fk_id_permission)
        REFERENCES permission(id_permission)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE TABLE file_agent (
    id_agent_file INT AUTO_INCREMENT PRIMARY KEY,
    fk_id_file INT,
    fk_id_agent INT,
    FOREIGN KEY (fk_id_file)
        REFERENCES file(id_file)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    FOREIGN KEY (fk_id_agent)
        REFERENCES agent(id_agent)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE TABLE file_workflow (
    id_file_workflow INT AUTO_INCREMENT PRIMARY KEY,
    fk_id_file INT,
    fk_id_workflow INT,
    FOREIGN KEY (fk_id_file)
        REFERENCES file(id_file)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    FOREIGN KEY (fk_id_workflow)
        REFERENCES workflows(id_workflow)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE TABLE messages (
    id_message INT AUTO_INCREMENT PRIMARY KEY,
    type ENUM('user', 'assistant', 'system', 'tool') NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fk_id_chat INT,
    fk_id_model INT,
    FOREIGN KEY (fk_id_chat)
        REFERENCES chat(id_chat)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    FOREIGN KEY (fk_id_model)
        REFERENCES ai_model(id_model)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE TABLE file_chat (
    id_chat_file INT AUTO_INCREMENT PRIMARY KEY,
    fk_id_chat INT,
    fk_id_file INT,
    FOREIGN KEY (fk_id_chat)
        REFERENCES chat(id_chat)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    FOREIGN KEY (fk_id_file)
        REFERENCES file(id_file)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE TABLE usage_metrics (
    id_metric INT AUTO_INCREMENT PRIMARY KEY,
    input_tokens INT,
    output_tokens INT,
    response_time INT,
    cpu_usage DECIMAL(10,2),
    ram_usage DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fk_id_chat INT,
    fk_id_model INT NOT NULL,
    fk_id_agent INT,
    fk_id_user INT NOT NULL,
    FOREIGN KEY (fk_id_chat)
        REFERENCES chat(id_chat)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    FOREIGN KEY (fk_id_model)
        REFERENCES ai_model(id_model)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    FOREIGN KEY (fk_id_agent)
        REFERENCES agent(id_agent)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    FOREIGN KEY (fk_id_user)
        REFERENCES `user`(id_user)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE TABLE revoked_token (
    id_revocation INT AUTO_INCREMENT PRIMARY KEY,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fk_id_user INT,
    INDEX idx_token_hash (token_hash),
    INDEX idx_expires_at (expires_at),
    FOREIGN KEY (fk_id_user)
        REFERENCES `user`(id_user)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);
CREATE DATABASE osiris;

use osiris;

CREATE TABLE user (
    id_user INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL
);

CREATE TABLE ai_model (
    id_model INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(100),
    model_name VARCHAR(50) NOT NULL,
    size INT,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE user_memory (
    id_memory INT AUTO_INCREMENT PRIMARY KEY,
    id_user INT,
    content TEXT NOT NULL,
    importance INT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_id_user
        FOREIGN KEY (id_user)
        REFERENCES user(id_user)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE TABLE configuration (
    id_configuration INT AUTO_INCREMENT PRIMARY KEY,
    id_user INT NOT NULL,
    `key` VARCHAR(255) NOT NULL,
    value LONGTEXT,
    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_id_user_configuration
        FOREIGN KEY (id_user)
        REFERENCES user(id_user)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE TABLE user_permission (
    id_user_permission INT AUTO_INCREMENT PRIMARY KEY,
    id_user INT,
    id_permission INT,
    CONSTRAINT fk_id_user_permission
        FOREIGN KEY (id_user)
        REFERENCES user(id_user)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_id_permission
        FOREIGN KEY (id_permission)
        REFERENCES permission(id_permission)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE TABLE model_installation (
    id_installation INT AUTO_INCREMENT PRIMARY KEY,
    id_user INT,
    id_model INT,
    installation_status VARCHAR(50),
    local_path VARCHAR(500),
    download_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_id_user_model
        FOREIGN KEY (id_user)
        REFERENCES user(id_user)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_id_model
        FOREIGN KEY (id_model)
        REFERENCES ai_model(id_model)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE TABLE agent (
    id_agent INT AUTO_INCREMENT PRIMARY KEY,
    id_user INT NOT NULL,
    id_model INT,
    name VARCHAR(255) NOT NULL,
    objective TEXT NOT NULL,
    execution_log VARCHAR(50) NOT NULL,
    memory INT NOT NULL,
    CONSTRAINT fk_id_user_agent
        FOREIGN KEY (id_user)
        REFERENCES user(id_user)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_id_model_agent
        FOREIGN KEY (id_model)
        REFERENCES ai_model(id_model)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE TABLE tool_agent (
    id_tool_agent INT AUTO_INCREMENT PRIMARY KEY,
    id_tool INT,
    id_agent INT,
    CONSTRAINT fk_id_tool
        FOREIGN KEY (id_tool)
        REFERENCES tool(id_tool)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_id_agent
        FOREIGN KEY (id_agent)
        REFERENCES agent(id_agent)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE TABLE agent_permission (
    id_agent_permission INT AUTO_INCREMENT PRIMARY KEY,
    id_agent INT,
    id_permission INT,
    CONSTRAINT fk_id_agent_permission
        FOREIGN KEY (id_agent)
        REFERENCES agent(id_agent)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_id_permission_agent
        FOREIGN KEY (id_permission)
        REFERENCES permission(id_permission)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE TABLE file_agent (
    id_agent_file INT AUTO_INCREMENT PRIMARY KEY,
    id_file INT,
    id_agent INT,
    CONSTRAINT fk_id_file
        FOREIGN KEY (id_file)
        REFERENCES file(id_file)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_id_agent_file
        FOREIGN KEY (id_agent)
        REFERENCES agent(id_agent)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE TABLE workflows (
    id_workflow INT AUTO_INCREMENT PRIMARY KEY,
    id_user INT,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(255) NOT NULL,
    CONSTRAINT fk_id_user_workflows
        FOREIGN KEY (id_user)
        REFERENCES user(id_user)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE TABLE node (
    id_node INT AUTO_INCREMENT PRIMARY KEY,
    id_workflow INT NOT NULL,
    type VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    priority INT NOT NULL,
    id_agent INT,
    CONSTRAINT fk_id_workflow
        FOREIGN KEY (id_workflow)
        REFERENCES workflows(id_workflow)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_id_agent_node
        FOREIGN KEY (id_agent)
        REFERENCES agent(id_agent)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE TABLE file_workflow (
    id_file_workflow INT AUTO_INCREMENT PRIMARY KEY,
    id_file INT,
    id_workflow INT,
    CONSTRAINT fk_id_file_workflow
        FOREIGN KEY (id_file)
        REFERENCES file(id_file)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_id_workflow_file
        FOREIGN KEY (id_workflow)
        REFERENCES workflows(id_workflow)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE TABLE chat (
    id_chat INT AUTO_INCREMENT PRIMARY KEY,
    id_user INT,
    title VARCHAR(255) NOT NULL,
    CONSTRAINT fk_id_user_chat
        FOREIGN KEY (id_user)
        REFERENCES user(id_user)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE TABLE messages (
    id_message INT AUTO_INCREMENT PRIMARY KEY,
    id_chat INT,
    id_model INT,
    type ENUM('user', 'assistant', 'system', 'tool') NOT NULL,
    content LONGTEXT NOT NULL,
    CONSTRAINT fk_id_chat
        FOREIGN KEY (id_chat)
        REFERENCES chat(id_chat)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_id_model_messages
        FOREIGN KEY (id_model)
        REFERENCES ai_model(id_model)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE TABLE file_chat (
    id_chat_file INT AUTO_INCREMENT PRIMARY KEY,
    id_chat INT,
    id_file INT,
    CONSTRAINT fk_id_chat_file
        FOREIGN KEY (id_chat)
        REFERENCES chat(id_chat)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_id_file_chat
        FOREIGN KEY (id_file)
        REFERENCES file(id_file)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);
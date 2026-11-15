-- migracao-001-dono-dos-registros.sql — adiciona o dono (fk_id_user) a agentes, ferramentas, arquivos e logs.
-- Rode uma única vez em bancos criados antes desta mudança; registros antigos ficam sem dono e não aparecem para ninguém.
USE osiris;

ALTER TABLE agent
    ADD COLUMN fk_id_user INT NULL,
    ADD CONSTRAINT fk_agent_usuario FOREIGN KEY (fk_id_user)
        REFERENCES `user`(id_user) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE tool
    ADD COLUMN fk_id_user INT NULL,
    ADD CONSTRAINT fk_tool_usuario FOREIGN KEY (fk_id_user)
        REFERENCES `user`(id_user) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE file
    ADD COLUMN fk_id_user INT NULL,
    ADD CONSTRAINT fk_file_usuario FOREIGN KEY (fk_id_user)
        REFERENCES `user`(id_user) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE file_log
    ADD COLUMN fk_id_user INT NULL,
    ADD CONSTRAINT fk_file_log_usuario FOREIGN KEY (fk_id_user)
        REFERENCES `user`(id_user) ON DELETE CASCADE ON UPDATE CASCADE;

SELECT template_id, com_id, type, name, version, published_version, status,
       LENGTH(field_config) AS field_len,
       LENGTH(layout_config) AS layout_len,
       LENGTH(designer_config) AS designer_len
FROM db_document_template
WHERE template_id = 233295264289390592;

SELECT version_id, template_id, version, status, LENGTH(designer_config) AS designer_len,
       published_at
FROM db_document_template_version
WHERE template_id = 233295264289390592
ORDER BY version DESC;

SHOW COLUMNS FROM db_document_template
WHERE Field IN ('field_config', 'style_config', 'layout_config', 'designer_config');

SHOW COLUMNS FROM db_document_template_version
WHERE Field IN ('field_config', 'style_config', 'layout_config', 'designer_config');

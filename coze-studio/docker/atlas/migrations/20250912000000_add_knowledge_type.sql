-- Add knowledge_type column to knowledge table to distinguish knowledge base types
ALTER TABLE `opencoze`.`knowledge` ADD COLUMN `knowledge_type` varchar(32) NOT NULL DEFAULT 'native' COMMENT 'Knowledge base type: native, fastgpt_rag';

-- Create index on knowledge_type for performance
CREATE INDEX `idx_knowledge_type` ON `opencoze`.`knowledge` (`knowledge_type`);

-- Update existing records to set knowledge_type based on rag_dataset_id
UPDATE `opencoze`.`knowledge` SET `knowledge_type` = 'fastgpt_rag' WHERE `rag_dataset_id` IS NOT NULL AND `rag_dataset_id` != '';

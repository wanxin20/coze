-- Add rag_dataset_id column to knowledge table for FastGPTRAG unified management
ALTER TABLE `opencoze`.`knowledge` ADD COLUMN `rag_dataset_id` varchar(255) NULL COMMENT "FastGPTRAG Dataset ID for unified management";
-- Create index on rag_dataset_id for performance
CREATE INDEX `idx_knowledge_rag_dataset_id` ON `opencoze`.`knowledge` (`rag_dataset_id`);

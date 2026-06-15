ALTER TABLE tags ADD COLUMN usage_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE contacts ADD COLUMN usage_count INTEGER NOT NULL DEFAULT 0;

UPDATE tags SET usage_count = (
    SELECT COUNT(*) FROM transaction_tags tt WHERE tt.tag_id = tags.id
);
UPDATE contacts SET usage_count = (
    SELECT COUNT(*) FROM transactions t WHERE t.contact_id = contacts.id
);

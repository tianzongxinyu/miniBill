package domain

// TxTagsByTransactionIDsSQL is the SELECT for transaction tag rows; use fmt.Sprintf with IN placeholders.
const TxTagsByTransactionIDsSQL = `
		SELECT tt.transaction_id, tt.tag_id, g.name, g.color_bg, g.color_fg FROM transaction_tags tt
		JOIN tags g ON g.id = tt.tag_id
		WHERE tt.transaction_id IN (%s)
		ORDER BY tt.transaction_id, g.name`

// ContactNamesByIDsSQL is the SELECT for contact id/name rows; use fmt.Sprintf with IN placeholders.
const ContactNamesByIDsSQL = `SELECT id, name FROM contacts WHERE id IN (%s)`

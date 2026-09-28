-- Receipt numbers for payments taken before bills numbered them. `nextNumber('receipt')` gives
-- every payment against a bill a number from a counter per Ethiopian year (RCT-2019-00001); the
-- payments recorded before that, and the development seed's, have none, so their printed bills
-- showed "—" where a receipt number belongs and the series had gaps nobody could explain.
--
-- Numbered per Ethiopian year of the day the money came in, in the order it came in, continuing
-- from whatever the year's counter already holds. The Ethiopian year starts on 11 September —
-- the 12th in the Gregorian year before a leap year — and is the Gregorian year less 7 from then,
-- less 8 before it. MariaDB/MySQL spelling throughout: a data migration is per-dialect by nature
-- (PORTABILITY.md), and this one runs once.
--
-- Only money in, against a bill, not deleted: an ERP-era income row with no bill is not a
-- receipt, and a refund is numbered (RFD-) when it is approved.
UPDATE `transactions` t
JOIN (
	SELECT n.id, n.ecy, ROW_NUMBER() OVER (PARTITION BY n.ecy ORDER BY n.occurred_on, n.id) AS rn
	FROM (
		SELECT x.id, x.occurred_on,
			YEAR(x.occurred_on) - IF(
				x.occurred_on >= STR_TO_DATE(
					CONCAT(YEAR(x.occurred_on), '-09-', IF(MOD(YEAR(x.occurred_on) + 1, 4) = 0, '12', '11')),
					'%Y-%m-%d'
				),
				7, 8
			) AS ecy
		FROM `transactions` x
		WHERE x.direction = 'in'
			AND x.receipt_number IS NULL
			AND x.deleted_at IS NULL
			AND x.occurred_on IS NOT NULL
			AND EXISTS (SELECT 1 FROM `invoice_payment` ip WHERE ip.transaction_id = x.id)
	) n
) numbered ON numbered.id = t.id
LEFT JOIN `document_sequence` s ON s.name = CONCAT('receipt-', numbered.ecy)
SET t.receipt_number = CONCAT(
	'RCT-', numbered.ecy, '-', LPAD(COALESCE(s.next_value, 1) + numbered.rn - 1, 5, '0')
);--> statement-breakpoint

-- Move each year's counter past the highest receipt now in it, so the next payment does not
-- reuse a number just given out above.
INSERT INTO `document_sequence` (`name`, `next_value`)
SELECT CONCAT('receipt-', y), MAX(n) + 1
FROM (
	SELECT SUBSTRING_INDEX(SUBSTRING_INDEX(receipt_number, '-', 2), '-', -1) AS y,
		CAST(SUBSTRING_INDEX(receipt_number, '-', -1) AS UNSIGNED) AS n
	FROM `transactions`
	WHERE receipt_number LIKE 'RCT-%-%'
) numbers
GROUP BY y
ON DUPLICATE KEY UPDATE `next_value` = GREATEST(`next_value`, VALUES(`next_value`));

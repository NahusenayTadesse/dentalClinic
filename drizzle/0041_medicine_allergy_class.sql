ALTER TABLE `medicine` ADD `allergen_id` int;--> statement-breakpoint
ALTER TABLE `medicine` ADD CONSTRAINT `medicine_allergen_id_allergen_id_fk` FOREIGN KEY (`allergen_id`) REFERENCES `allergen`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- The allergy family of each medicine the clinic was seeded with, where the family is a listed
-- allergen. By name, so a clinic that renamed or removed either side is simply left unmatched.
UPDATE `medicine` m JOIN `allergen` a ON a.name = CASE
	WHEN m.generic_name LIKE 'Amoxicillin%' OR m.generic_name LIKE '%penicillin%' THEN 'Penicillin'
	WHEN m.generic_name IN ('Erythromycin', 'Clindamycin', 'Doxycycline', 'Metronidazole', 'Azithromycin', 'Ciprofloxacin') THEN 'Other antibiotics'
	WHEN m.generic_name IN ('Ibuprofen', 'Diclofenac', 'Naproxen') OR m.generic_name LIKE 'Aspirin%' THEN 'Aspirin / NSAIDs'
	WHEN m.generic_name LIKE 'Paracetamol%' THEN 'Paracetamol'
	WHEN m.generic_name LIKE 'Lidocaine%' THEN 'Lidocaine'
	WHEN m.generic_name LIKE 'Articaine%' THEN 'Articaine'
	WHEN m.generic_name LIKE 'Sulfamethoxazole%' OR m.generic_name LIKE 'Co-trimoxazole%' THEN 'Sulfa drugs'
END
SET m.allergen_id = a.id
WHERE m.allergen_id IS NULL;

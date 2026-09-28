import { describe, expect, it } from 'vitest';
import { allergyClashes, type ChartAllergy } from './allergyClash';

const penicillin: ChartAllergy = { allergenId: 1, name: 'Penicillin', severity: 'severe' };
const amoxicillin: ChartAllergy = { allergenId: 2, name: 'Amoxicillin', severity: 'mild' };
const latex: ChartAllergy = { allergenId: 9, name: 'Latex', severity: 'moderate' };

describe('allergyClashes', () => {
	it('stops a medicine of the family the patient is allergic to', () => {
		expect(
			allergyClashes([penicillin, latex], { genericName: 'Amoxicillin', allergenId: 1 })
		).toEqual([penicillin]);
	});

	it('stops a medicine named for the allergy even when filed under a wider family', () => {
		expect(
			allergyClashes([amoxicillin], { genericName: 'Amoxicillin + Clavulanic acid', allergenId: 1 })
		).toEqual([amoxicillin]);
	});

	it('lets through a medicine of another family, and one with no family recorded', () => {
		expect(allergyClashes([penicillin], { genericName: 'Clindamycin', allergenId: 3 })).toEqual([]);
		expect(
			allergyClashes([penicillin], { genericName: 'Chlorhexidine', allergenId: null })
		).toEqual([]);
	});
});

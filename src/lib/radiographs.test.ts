import { describe, expect, it } from 'vitest';
import { compareCandidate, isProjection, type Film } from './radiographs';

const film = (
	id: number,
	madeOn: string,
	projection: Film['projection'],
	toothId: number | null = null
): Film => ({ id, madeOn, projection, toothId });

describe('compareCandidate', () => {
	const films = [
		film(1, '2024-01-10', 'periapical', 36),
		film(2, '2025-02-01', 'periapical', 36),
		film(3, '2025-03-01', 'periapical', 46),
		film(4, '2025-06-01', 'panoramic'),
		film(5, '2026-06-01', 'periapical', 36),
		film(6, '2026-07-01', 'panoramic'),
		film(7, '2023-05-01', 'bitewing', 36)
	];

	it('reads a periapical against the newest earlier one of the same tooth', () => {
		expect(compareCandidate(films[4], films)?.id).toBe(2);
	});

	it('reads a panoramic against the last panoramic, whatever the tooth', () => {
		expect(compareCandidate(films[5], films)?.id).toBe(4);
	});

	it('finds nothing for the first film of its kind', () => {
		expect(compareCandidate(films[0], films)).toBeNull();
		expect(compareCandidate(films[6], films)).toBeNull();
	});

	it('orders two films of one day by when they were added', () => {
		const sameDay = [film(10, '2026-01-01', 'bitewing'), film(11, '2026-01-01', 'bitewing')];
		expect(compareCandidate(sameDay[1], sameDay)?.id).toBe(10);
		expect(compareCandidate(sameDay[0], sameDay)).toBeNull();
	});
});

describe('isProjection', () => {
	it('accepts the listed projections only', () => {
		expect(isProjection('bitewing')).toBe(true);
		expect(isProjection('xray')).toBe(false);
		expect(isProjection('')).toBe(false);
	});
});

-- `penality` held the pension rates under the wrong name, and payroll read them by position: its
-- first row as the employee's share, its second as the employer's. It held two disciplinary fines,
-- so a run would have charged pension at fifty and two hundred times salary. Replaced by
-- `pension_rate` (0031), keyed by who pays; the old rows were wrong, so nothing is carried over.
DROP TABLE `penality`;
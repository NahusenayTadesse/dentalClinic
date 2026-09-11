-- Run this ONCE, before any migration, on a new cPanel database.
--
-- Nothing drizzle-kit generates mentions a character set, so every table inherits the
-- database default. If that default is latin1 or utf8mb3, Amharic does not fail — it
-- corrupts silently, and the damage is only visible months later in a clinical note that
-- reads as question marks. Ge'ez needs three bytes per character, which utf8mb3 cannot give.
--
-- Replace `dental` with the real cPanel database name. cPanel usually creates it for you, so
-- the ALTER is the line that matters; the CREATE is here for a database made by hand.

-- CREATE DATABASE IF NOT EXISTS `dental` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

ALTER DATABASE `dental` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- Verify before going further. Both must say utf8mb4. If they do not, stop: applying
-- migrations now would bake the wrong charset into every table, and fixing it afterwards
-- means converting every table and column by hand.
SELECT @@character_set_database AS charset, @@collation_database AS collation;

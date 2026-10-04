-- Rollback for 001_CreateTables.sql
-- Every table below is new (no pre-existing table is altered), so
-- rollback is a straight DROP. Dropping a table also drops its indexes,
-- so the IX_* indexes from 001_CreateTables.sql need no separate DROP
-- INDEX statements. The existing dbo.Vendor table is never touched.
--
-- IMPORTANT: the per-vendor contact table here is named VendorCardContact
-- (not VendorContact) -- dbo.VendorContact already exists in this database
-- as an unrelated lookup table (ContactType/ContactDescription, 6 rows) and
-- must never be dropped by this script.
--
-- Run 002_StoredProcedures_Rollback.sql first if rolling back the whole
-- VendorCard feature. Order below drops child tables (FK holders) before
-- the tables they reference, in reverse of creation order.

DROP TABLE IF EXISTS dbo.EntityAuditLog;
DROP TABLE IF EXISTS dbo.VendorCustomField;
DROP TABLE IF EXISTS dbo.VendorRebateProgram;
DROP TABLE IF EXISTS dbo.VendorReturnPolicy;
DROP TABLE IF EXISTS dbo.VendorShippingPolicy;
DROP TABLE IF EXISTS dbo.VendorFreightPolicy;
DROP TABLE IF EXISTS dbo.VendorPriceList;
DROP TABLE IF EXISTS dbo.VendorContract;
DROP TABLE IF EXISTS dbo.VendorCardContact;     -- FK -> VendorContactGroup, must drop first
DROP TABLE IF EXISTS dbo.VendorContactGroup;
DROP TABLE IF EXISTS dbo.VendorTerms;
DROP TABLE IF EXISTS dbo.VendorBrand;
DROP TABLE IF EXISTS dbo.VendorProfile;
GO

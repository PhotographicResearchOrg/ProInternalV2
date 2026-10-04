-- Rollback for 002_StoredProcedures.sql
-- Every procedure below is new (none replace a pre-existing proc), so
-- rollback is a straight DROP. If rolling back the whole VendorCard
-- feature, run this before 001_CreateTables_Rollback.sql.

DROP PROCEDURE IF EXISTS dbo.PIV2InsertEntityAuditLog;
DROP PROCEDURE IF EXISTS dbo.PIV2GetEntityAuditLog;

-- Custom-field procs live in 004_CustomFieldProcedures.sql; roll those back
-- with 004_CustomFieldProcedures_Rollback.sql.
DROP PROCEDURE IF EXISTS dbo.PIV2AddVendorCustomField;
DROP PROCEDURE IF EXISTS dbo.PIV2GetVendorCustomFields;

DROP PROCEDURE IF EXISTS dbo.PIV2UpdateVendorRebateProgram;
DROP PROCEDURE IF EXISTS dbo.PIV2AddVendorRebateProgram;
DROP PROCEDURE IF EXISTS dbo.PIV2GetVendorRebatePrograms;

DROP PROCEDURE IF EXISTS dbo.PIV2UpsertVendorReturnPolicy;
DROP PROCEDURE IF EXISTS dbo.PIV2GetVendorReturnPolicy;

DROP PROCEDURE IF EXISTS dbo.PIV2UpsertVendorShippingPolicy;
DROP PROCEDURE IF EXISTS dbo.PIV2GetVendorShippingPolicy;

DROP PROCEDURE IF EXISTS dbo.PIV2UpsertVendorFreightPolicy;
DROP PROCEDURE IF EXISTS dbo.PIV2GetVendorFreightPolicy;

DROP PROCEDURE IF EXISTS dbo.PIV2AddVendorPriceList;
DROP PROCEDURE IF EXISTS dbo.PIV2GetVendorPriceLists;

DROP PROCEDURE IF EXISTS dbo.PIV2UpdateVendorContract;
DROP PROCEDURE IF EXISTS dbo.PIV2AddVendorContract;
DROP PROCEDURE IF EXISTS dbo.PIV2GetVendorContracts;

DROP PROCEDURE IF EXISTS dbo.PIV2DeleteVendorContact;
DROP PROCEDURE IF EXISTS dbo.PIV2UpdateVendorContact;
DROP PROCEDURE IF EXISTS dbo.PIV2AddVendorContact;
DROP PROCEDURE IF EXISTS dbo.PIV2GetVendorContacts;
DROP PROCEDURE IF EXISTS dbo.PIV2AddVendorContactGroup;

DROP PROCEDURE IF EXISTS dbo.PIV2UpsertVendorTerms;
DROP PROCEDURE IF EXISTS dbo.PIV2GetVendorTerms;

DROP PROCEDURE IF EXISTS dbo.PIV2ToggleVendorActive;
DROP PROCEDURE IF EXISTS dbo.PIV2GetVendorStats;
DROP PROCEDURE IF EXISTS dbo.PIV2AddVendorBrand;
DROP PROCEDURE IF EXISTS dbo.PIV2GetVendorBrands;
DROP PROCEDURE IF EXISTS dbo.PIV2GetVendorCard;
GO

/* Read only. Prints the B2B site's order / shipped / backorder / invoice procedures so the
   Credit Desk can use exactly the same logic. Nothing is created, changed or dropped.
   Run on the server that has PRO and EDA; send back the Messages output (or the result grid). */
SET NOCOUNT ON;

SELECT 'PRO' AS Db, s.name + '.' + o.name AS ProcName, OBJECT_DEFINITION(o.object_id) AS Definition
FROM PRO.sys.objects o JOIN PRO.sys.schemas s ON s.schema_id = o.schema_id
WHERE o.type IN ('P', 'V', 'FN', 'IF', 'TF')
  AND o.name IN ('Retailer_GetSubmittedOrders', 'SearchSiteOrders', 'GetOrderSummary', 'LoadOrderHistory', 'GetInvoice')
UNION ALL
SELECT 'EDA', s.name + '.' + o.name, OBJECT_DEFINITION(o.object_id)
FROM EDA.sys.objects o JOIN EDA.sys.schemas s ON s.schema_id = o.schema_id
WHERE o.type IN ('P', 'V', 'FN', 'IF', 'TF')
  AND o.name IN ('Accounting_GetInvoiceHistory', 'Accounting_GetShippedData', 'Accounting_GetBackorders');

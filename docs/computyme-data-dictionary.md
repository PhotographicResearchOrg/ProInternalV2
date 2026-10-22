# Computyme data dictionary (decoded from BP_Computyme / Extracted-rules)

Decoded 2026-10-22 from the UniVerse dictionary files (`BP/D_<file>`) in PhotographicResearchOrg/Extracted-rules. `Attr` is the attribute (field) number; several names on one attribute are synonyms. Conversions: MD2 = 2 implied decimals (stored without the point), D2/ = UniVerse date (days since 1967-12-31), MD0Z = whole number. M = multi-value.

Dates in Computyme are day numbers: 19758 = 2022-02-03, 21204 = 2026-01-19.


## IVMST

Product master (one record per product code). SQL copy: EDA.IVMST.IVMST (+ multi-value side tables PO_MV, QTY_REC_MV, DATE_REC_MV, AMT_REC_MV, MORD_MV).

| Attr | Names | Heading | Conv | S/M |
|---|---|---|---|---|
| 0 | ID, PROD | IVMST |  | S |
| 1 | SG, SUB, SUB.GRP | SUB.GRP |  | S |
| 2 | ORD.QTY, QO | ORDER |  | S |
| 3 | L.REQ, REQ, REQ5, REQ6 | Ord-Qty | MD0Z, | S |
| 4 | DESC, LONG.DESC | Description |  | S |
| 5 | PVEND, VEND, VENDOR | VND |  | S |
| 6 | GP, GRP, GRP.NO | GP |  | S |
| 7 | QUAN | SP-QTY |  | S |
| 8 | COST, NET.1 | COST | MD2Z | S |
| 9 | NET.2 | PRICE-2 | MD2Z | S |
| 10 | NET.3 | PRICE-3 | MD2Z | S |
| 11 | DATE, DATE.YR, DATES | DATE-CHG | D2/ | M |
| 12 | PCT | S/C PCT | MD1 | S |
| 13 | YTD | YTD-SHIP | MD0Z | M |
| 14 | BID, BRAND.ID | Brand |  | S |
| 15 | STATUS | S |  | S |
| 16 | MOQ, MULT | MULT | MD0Z | S |
| 17 | MORD |  | MD0Z | M |
| 18 | MPYR |  | MD0Z | M |
| 19 | RAW, RAW.COST | RAW    COST | MD2 | S |
| 20 | PO.NO, PO.NUM, PONO | PO-NUM |  | M |
| 21 | PO.QTY, PO.QUAN, QTY.ORD | PO-  QUAN |  | M |
| 22 | PO.CST | PO-Cost | MD2 | M |
| 23 | BO, BO.QTY, PO.BO, QTY.BO | BO-Q |  | M |
| 24 | QTY.REC, QTY.RECD | Quan | MD, | M |
| 25 | AMT.REC, AMT.RECD | Total | MD2 | M |
| 26 | DATE.REC, DT.REC, DT.RECD, MON.REC, REC, YEAR.REC, YR.RECD | Date-Rec | D2/ | M |
| 27 | CASE | Case | MD0 | S |
| 28 | FILM.PK, LAST.COST, LCOST | LST-COST | MD2 | S |
| 29 | UPC | UPC |  | S |
| 30 | CAT.NO, CATNO, FULL.CAT, S.CAT | Vendor-CATNo |  | S |
| 31 | RETAIL | RETAIL | MD2Z, | S |
| 32 | MAP | MAP | MD2Z, | S |
| 33 | CARTON | Cart |  | S |
| 34 | MOS | MOS |  | S |
| 35 | AUX.DESC, SH.WEB.DESC, WDESC, WEB.DESC | Web-Description |  | S |
| 36 | DISPLAY | WD |  | S |
| 37 | A.VENDOR, AVEND, HAVENDOR | Actual-Vendor |  | S |
| 38 | PO.COST | PO-Cost | MD2Z | S |
| 39 | E.GRP, EGRP, HEGRP | EG |  | S |
| 40 | QRB |  |  | S |
| 41 | DISCD | DC | MD | S |
| 42 | DMAMT | Disc |  | S |
| 43 | FUJI.REB, FUJIREB, IPI, NOT.USED, WIPI | Fuji   Reb |  | S |
| 44 | SYTD | Sales-YTD | MD02Z, | M |
| 45 | PYTD | Profit-YTD | MD02Z, | M |
| 46 | HOLD | Hold |  | S |
| 47 | P.LOC | LOC |  | S |
| 48 | S.LOC |  |  | S |
| 49 | LBS, WEIGHT | LBS |  | S |
| 50 | DIMEN | Ln:Wth:Ht |  | S |
| 51 | EAN, W.UPC | WHSE-UPC-EAN |  | S |
| 52 | COO |  |  | S |
| 53 | HS.CODE | HS-CODE |  | M |
| 54 | DUTY, SHIP.CHG | Ship SurCh | MD2Z | S |
| 55 | ENTRY, ENTRY.NO | Entry-Number | MDZ | S |
| 56 | FIRST.IN | First-Recd | D2/ |  |
| 57 | P65, P65.LS | P65 |  | S |
| 58 | LAST.SALE | Last-Sale | D2/ | S |
| 59 | DS.CHG, DS.SCHG | DROP-SHIP | MD2 | S |
| 61 | MIN.STK | M-STK |  | S |
| 62 | MIX.MATCH, MIXMATCH, MM | MIXMAT |  | S |
| 63 | UPS.LABEL | LABEL |  | S |
| 64 | ALLOC, ALLOCATE |  |  | S |
| 65 | ALLOCATION, TOT.ALLOC | TOT-ALLOC |  | S |
| 66 | KILOS, METWGHT, METWGT | Kilos |  | S |
| 67 | METDIM, METDIMS | M-Ln:Wth:Ht |  | S |
| 68 | SPEC.ORD, SPECORD, SPORD |  |  |  |
| 69 | LITH.8081 | LITH 8081 |  | S |

## IVMST.LOG

Product maintenance change log, written by IV.MNT.PROD on every save: who, when (record id = date*time), product, each changed field with old and new value. This is the price history.

| Attr | Names | Heading | Conv | S/M |
|---|---|---|---|---|
| 1 | USER | User |  | S |
| 2 | PROD | Prod |  | S |
| 3 | FIELD, FIELD.NAME | Field-Name |  | M |
| 4 | ATTR | Atr |  | M |
| 5 | OLD | Old-Value |  | M |
| 6 | NEW | New-Value |  | M |
| 7 | TYPE | Tp |  | S |

Calculated (I-descriptors):

- `AVEND` = `TRANS(IVMST,PROD,AVEND,'X')`
- `DATE` = `FIELD(@ID,'*',1)`
- `DESC` = `TRANS(IVMST,PROD,DESC,'X')`
- `NEW.PRICE.1` = `FIELD(NEW,@VM,1)`
- `NEW.PRICE.2` = `FIELD(NEW,@VM,2)`
- `OLD.PRICE.1` = `FIELD(OLD,@VM,1)`
- `OLD.PRICE.2` = `FIELD(OLD,@VM,2)`
- `P.LOC` = `TRANS(IVMST,PROD,P.LOC,'X')`
- `TIME` = `FIELD(@ID,'*',2)`

## VNMST

PRO vendor (vendor group, IVMST VEND / field 5).

| Attr | Names | Heading | Conv | S/M |
|---|---|---|---|---|
| 0 | @ID | VNMST |  | S |
| 1 | NAME |  |  | S |
| 2 | NAME2 |  |  | S |
| 3 | STREET |  |  | S |
| 4 | CITY.STATE |  |  | S |
| 5 | ZIP |  |  | S |
| 6 | CODE | TP |  | S |
| 7 | YTD.SALES |  | MD02Z, | S |
| 8 | PCT |  | MD1 | S |
| 9 | SURCHARGES |  | MD2Z, | S |
| 10 | PREV.YR |  | MD0Z, | S |
| 11 | PHONE |  |  | S |
| 12 | APID, APMST, F12 |  |  | S |
| 13 | F13 |  |  | S |
| 14 | F14, SPCDED |  |  | S |
| 15 | ADMDAYS, F15 |  |  | S |
| 16 | SPC.PCT |  |  | S |
| 17 | FTR |  |  | S |
| 18 | VND.TERMS |  |  |  |
| 19 | APADJ |  |  | S |

Calculated (I-descriptors):

- `ADM.DAYS` = `FIELD(F15,@VM,1)`
- `AP.NAME` = `TRANS(APMST,APID,NAME,'X')`
- `APNAME` = `TRANS(APMST,APID,NAME,'X')`
- `CSZ` = `CITY.STATE:' ':ZIP`
- `PRO.TERMS` = `FIELD(F15,@VM,2)`
- `VEND.NAME` = `@ID 'L#5':NAME`

## APMST

Accounts-payable vendor master (actual vendor, IVMST A.VENDOR / field 37).

| Attr | Names | Heading | Conv | S/M |
|---|---|---|---|---|
| 0 | @ID | APMST |  | S |
| 1 | NAME, NAME.SHORT | Vendor Name |  | S |
| 2 | TYPE | TYP |  | S |
| 3 | NAME2 | Additional Name or Address |  | S |
| 4 | STREET | Street Address |  | S |
| 5 | CITY.ST | City, ST |  | S |
| 6 | ZIP | Zip |  | S |
| 7 | PHONE | Phone Number |  | S |
| 8 | AME, SH.NAME, SVNAME | NAME |  | S |
| 9 | PCT | PCT |  | S |
| 10 | DUE.DAYS | Due-Days |  | S |
| 11 | SPLIT |  |  | S |
| 12 | LEDGER | G/L-NO |  | S |
| 13 | EXPENSE |  |  | S |
| 14 | PREV.YR | PREV-YR | MD02Z, | S |
| 15 | YTD.GROSS | YTD-GROSS | MD2Z, | S |
| 16 | OPEN.GROSS | Open-Gross | MD2Z, | S |
| 17 | YTD.DISC | YTD-DISC | MD2Z, | S |
| 18 | LAST.PAID | LAST-PAID | D2/ | S |
| 19 | NEXT.INV | Next-Inv | MD0Z | S |
| 20 | FG.PCT | FG-% |  | S |
| 21 | DEALER | Dealer No. |  | S |
| 22 | NOT.IN.USE |  | MD1 | S |
| 24 | MISC | Misc. Information |  | S |
| 25 | D1, P.ADD1 | Payment Address Line 1 |  | S |
| 26 | P.ADD2 | Payment Address Line 2 |  | S |
| 27 | P.CSZ | Payment City, ST Zip |  | S |
| 28 | P.PHONE | Payment Phone |  | S |
| 29 | CODE |  |  | S |
| 30 | R.ADD.SHORT, SRCH | Rep. Address | MD1 | S |
| 31 | R.CSZ | Rep. City, ST Zip |  | S |
| 32 | R.PHONE | Rep. Phone |  | S |
| 33 | WH.REC | WH-Rec |  | S |
| 34 | PP.ORD, PREP.ORD, PREPD.ORD | Prep-Ord | MD, | S |
| 35 | REP.EMAIL | REP-Email |  | S |
| 36 | PAY.EMAIL, PAY.TO.EMAIL | PAY-To-Email |  | S |
| 37 | EMAIL | Company-Email |  | S |
| 38 | PAID.IN | PAID-IN |  | S |
| 39 | SEP.SHIP | SS |  | S |

Calculated (I-descriptors):

- `CITY` = `FIELD(CSZ,',',1)`
- `CSZ` = `CITY.ST:' ':ZIP`
- `L.ADD1` = `IF P.ADD1 = '' THEN NAME2 ELSE P.ADD1`
- `L.ADD2` = `IF P.ADD1 = '' THEN STREET ELSE P.ADD2`
- `L.CSZ` = `IF P.ADD1 = '' THEN CSZ ELSE P.CSZ`
- `LINE` = `'____________'`
- `NM` = `TRIM(FIELD(NAME,',',2):' ':FIELD(NAME,',',1))`
- `STATE` = `FIELD(CSZ,',',2)`
- `VEND.NAME` = `@ID 'L#5':NAME`

## VENDXREF

PRO vendor to AP vendor cross reference.

| Attr | Names | Heading | Conv | S/M |
|---|---|---|---|---|
| 1 | AVEND | AP VENDOR |  | S |

## VENDPERC

Vendor payment percentage.

| Attr | Names | Heading | Conv | S/M |
|---|---|---|---|---|
| 0 | VENDOR |  |  | S |
| 1 | PAY |  |  | S |

## IVPO

Purchase orders (one record per PO).

| Attr | Names | Heading | Conv | S/M |
|---|---|---|---|---|
| 0 | @ID, ID, PO, PONO | PO-NO |  | S |
| 1 | VEND | Vend |  | S |
| 6 | PROD | Prod |  | M |
| 7 | QTY.ORD, QUAN | Quan  Ord | MD0 | M |
| 8 | COST, TEST | Cost | MD2 | M |
| 9 | QR, QTY.REC, QTY.RECD | Q-RCV | MD0Z | M |
| 11 | DT.RECD | Date  Recd | D0/ | M |
| 12 | COST.REC, COST.RECD | Cost-Recd | MD2, | M |
| 13 | F13, RECD, RECV | Rec |  | S |
| 14 | FG.PCT | FG-% |  | S |
| 15 | F15, MISC.DESC | Field-15 |  | S |
| 16 | F16, MISC.SALE | Field-16 | MD2 | S |
| 17 | F17, V9999.INFO | Field-17 |  | S |
| 18 | CBM, F18 | C-B-M |  | M |

## ORDDUE

Expected stock due date per product.

| Attr | Names | Heading | Conv | S/M |
|---|---|---|---|---|
| 0 | @ID | ORDDUE |  | S |
| 1 | DATE, DUE, DUE.DESC |  | D2/ | S |
| 2 | UPD.DATE | UPD-DATE | D2/ | S |
| 3 | PO | VIA-PO |  | S |

## PRICE.CHANGES

Price changes file (PRICE.CHANGES): new raw cost, PO cost, nets, MAP, retail.

| Attr | Names | Heading | Conv | S/M |
|---|---|---|---|---|
| 1 | NEW.RAW, RAW | NEW-RAW |  | S |
| 2 | PO.COST | PO-Cost |  | S |
| 3 | NET.1, NEW.COST | New-Net |  | S |
| 4 | NET.2, NEW.MAP, RETAIL | New-Net-2 |  | S |
| 5 | MAP, NEW.RETAIL | New-Map |  | S |

## MAP.PRICE

MAP price list.

| Attr | Names | Heading | Conv | S/M |
|---|---|---|---|---|
| 0 | @ID | MAP |  | S |
| 1 | RETAIL | Retail | MD2Z, | S |
| 2 | MAP | MAP-Price | MD2Z, | S |

## KITS

Kits: component products and quantities.

| Attr | Names | Heading | Conv | S/M |
|---|---|---|---|---|
| 1 | PROD, PRODS | Prod |  | M |
| 2 | QUAN, QUANS | Qty |  | M |
| 3 | DISC | D% |  | S |

## BRANDS

Brands.

| Attr | Names | Heading | Conv | S/M |
|---|---|---|---|---|
| 1 | F1, NAME | Name |  | S |
| 5 | REP.JOG | JOG |  |  |
| 10 | BRAND.ID | ID |  | S |

## CURRENCIES

Currencies and conversion rates.

| Attr | Names | Heading | Conv | S/M |
|---|---|---|---|---|
| 1 | COUNTRY | Country |  | S |
| 2 | DESC | Description |  | S |
| 4 | CONVERSION | Conversion |  | S |
| 5 | LAST.UPDATED | Last-Updated |  | S |
| 6 | WHO.UPDATED | Who-Updated |  | S |
| 8 | PRIOR.CONV | Prior-Conver |  | S |

## TERMSDATA

Terms / discounts per product.

| Attr | Names | Heading | Conv | S/M |
|---|---|---|---|---|
| 0 | PROD |  |  | S |
| 1 | PERC | DISC |  | S |
| 2 | FTR | FTR |  | S |
| 3 | OST |  |  | S |
| 4 | OQA |  |  | S |
| 5 | OQQ |  |  | S |
| 6 | OAQ |  |  | S |
| 7 | ED, EXPD |  |  | S |
| 8 | OPCT1 |  |  | S |
| 9 | OPCT2 |  |  | S |
| 10 | OPCT3 |  |  | S |
| 11 | OPCT4 |  |  | S |
| 12 | OPCT5 |  |  | S |
| 13 | OPCT6 |  |  | S |
| 14 | OPCT7 |  |  | S |
| 15 | OPCT8 |  |  | S |
| 16 | OPCT9 |  |  | S |
| 17 | OPCT10 |  |  | S |
| 18 | OPCT11 |  |  | S |
| 19 | OPCT12 |  |  | S |
| 20 | OPCT13 |  |  | S |
| 21 | OPCT14 |  |  | S |
| 22 | OPCT15 |  |  | S |
| 23 | CSPK |  |  | S |

## VENDORD

Member purchases by vendor (vendor orders).

| Attr | Names | Heading | Conv | S/M |
|---|---|---|---|---|
| 0 | @ID, MEMB, MEMBER | MEMB |  | S |
| 1 | VENDOR | VEND |  | M |
| 2 | P.O, PO | PURCH.ORD |  | M |
| 3 | DATE | DATE | D2/ | M |
| 4 | AMOUNT | AMOUNT | MD2Z, | M |
| 5 | BILLED | BILLED | MD2Z, | M |

## IVEND

Member sales by vendor with surcharge.

| Attr | Names | Heading | Conv | S/M |
|---|---|---|---|---|
| 0 | @ID, ACCOUNT, ID | IVEND |  | S |
| 1 | VENDOR |  |  | M |
| 2 | AMOUNT | Amount | MD02Z, | M |
| 3 | AMT, SC, SURCHG | PERC | MD2Z, | M |
| 4 | F4 | FINISHING     SALES | MD2Z, | S |
| 5 | F5 | FINISHING SURCHARGE | MD2Z, | S |

## BVEND

Member sales by vendor (B).

| Attr | Names | Heading | Conv | S/M |
|---|---|---|---|---|
| 0 | @ID, ACCOUNT, MEMBER | BVEND |  | S |
| 1 | VENDOR |  |  | M |
| 2 | AMOUNT |  | MD02Z, | M |
| 3 | SC, SURCHG |  | MD2Z, | M |

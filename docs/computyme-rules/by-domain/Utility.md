# Utility — Computyme programs and rules

52 programs, 58 rules. Source: BP_Computyme (Extracted-rules repo). Tags are suggestions for the CTO to confirm.

## CAPTURE

**Mode:** Utility/maintenance · **Lines:** 59 · **Relevance:** none

Runs any LIST/SORT sentence and transfers the captured report to a PC file (default C:\DOWNLOADS\) via the FT file-transfer utility.

**Files:** writes BP (temporary TMP_<user>.RPT, then deleted)  
**Calls:** EXECUTE TERM, PTERM, GET-LIST, FT; INCLUDE UTLBP I_GETPORT

| ID | Rule | Source | Tag |
|---|---|---|---|
| CAPTURE.01 | Non-LIST/SORT sentences are prefixed with SORT; optional saved list applied first; report staged in BP and pushed with FT to the PC directory | L15-58 | OBSOLETE-INTEGRATION |

**Bugs / oddities:** Stray quote at L53 (`TXT.ID'`); writes temp data into the program file BP.

## DH$

**Mode:** Utility/maintenance · **Lines:** 53 · **Relevance:** none

Test harness that converts an amount in cents to check-writing words using word table CONTROL 'MONEY'.

**Files:** reads CONTROL ('MONEY') · writes none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| DH$.01 | Amount entered in cents; last 2 digits = cents, INT(AMT/100) = dollars; max $9,999,999.99; words from CONTROL MONEY attrs 1-32 (30/31/32 appear to be hundred/thousand/million) | L3,L18-47 | SIMPLIFY |

**Bugs / oddities:** L47 tests BUCKS=1 after BUCKS has been truncated, so e.g. $101 prints "Dollar"; interactive input meant to be replaced (L15 comment).

## DRAW.BOX

**Mode:** Subroutine · **Lines:** 29 · **Relevance:** none

Draws a box on the terminal using per-terminal graphics chars from TERMINALS.

**Files:** reads TERMINALS · writes none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| DRAW.BOX.01 | Terminal-specific box drawing chars (TERMINALS 'KEYS'+user no.) with ASCII fallback | L5-26 | OBSOLETE |

## DSP.REPORT

**Mode:** Subroutine · **Lines:** 37 · **Relevance:** none

Pages a field-mark-delimited report on screen 21 lines at a time with Back/End/custom prompt.

**Files:** none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| DSP.REPORT.01 | Terminal paging UI; returns operator choice matching PATTERN else 'E' | L10-33 | OBSOLETE |

## EDIT.LINE

**Mode:** Subroutine · **Lines:** 75 · **Relevance:** none

Raw-keystroke full-line editor for green-screen input fields (insert/overtype, arrows, ESC/up exit).

**Files:** none  
**Calls:** INCLUDE BP I_RAWINP

| ID | Rule | Source | Tag |
|---|---|---|---|
| EDIT.LINE.01 | Terminal field-edit behavior (uppercase input via MCU, '/' toggles insert, '\' clears, max length MAX) | L16-73 | OBSOLETE |

**Bugs / oddities:** none material.

## EPSON.DRAFT

**Mode:** Utility/maintenance · **Lines:** 8 · **Relevance:** none

Sends escape code to set an Epson 5000 printer to draft mode.

**Files:** none · Calls: none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| EPSON.DRAFT.01 | ESC x 0 + form feed to printer | L3-7 | OBSOLETE |

## EPSON.NLQ

**Mode:** Utility/maintenance · **Lines:** 8 · **Relevance:** none

Sets Epson 5000 printer to near-letter-quality mode.

**Files:** none · Calls: none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| EPSON.NLQ.01 | ESC x 1 + form feed to printer | L3-7 | OBSOLETE |

## FF

**Mode:** Utility/maintenance · **Lines:** 7 · **Relevance:** none

Sends a form feed to the Epson 5000 printer.

**Files:** none · Calls: none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| FF.01 | Print CHAR(12) | L3-6 | OBSOLETE |

## FILE.STATS.SUB

**Mode:** Subroutine · **Lines:** 12 · **Relevance:** none

Diagnostic: displays UNIX permissions of a file after a write error.

**Files:** reads file STATUS of passed FILE · Calls: none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| FILE.STATS.SUB.01 | Shows octal permissions from STATUS<5>; aborts if file can't be opened | L7-10 | OBSOLETE |

## FILE.STATUS

**Mode:** Utility/maintenance · **Lines:** 7 · **Relevance:** none

Interactive version of FILE.STATS.SUB showing a file's permissions.

**Files:** none · Calls: none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| FILE.STATUS.01 | Display octal permissions of entered file | L1-6 | OBSOLETE |

## GET.SLAVE

**Mode:** Subroutine · **Lines:** 10 · **Relevance:** none

Returns the terminal slave-printer port from CONTROL 'SLAVEPORT', prompting and saving it if missing.

**Files:** reads/writes CONTROL ('SLAVEPORT' attr 2) · Calls: none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| GET.SLAVE.01 | Slave printer port stored once in CONTROL 'SLAVEPORT' attr 2 | L3-8 | OBSOLETE |

**Bugs / oddities:** Single global port for all users.

## HP.RESET

**Mode:** Utility/maintenance · **Lines:** 5 · **Relevance:** none

Sends PCL reset to HP8000 printer.

**Files:** none · Calls: none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| HP.RESET.01 | ESC E to printer | L2-4 | OBSOLETE |

## HP.WIDE

**Mode:** Utility/maintenance · **Lines:** 7 · **Relevance:** none

Sets HP8000 printer to landscape and prints a test line.

**Files:** none · Calls: EXECUTE SETPTR  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| HP.WIDE.01 | SETPTR 132 cols on HP8000, PCL landscape | L2-6 | OBSOLETE |

## IDATE

**Mode:** Subroutine · **Lines:** 50 · **Relevance:** none

Inventory date-entry parser/validator with allowed past/future day windows.

**Files:** none · Calls: none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| IDATE.01 | Shorthand entry: blank = today; 1-2 digits = day in current month/year; 4 digits = MMDD current year; 6 digits = MMDDYY | L6-20 | SIMPLIFY |
| IDATE.02 | Window: PAST and FUTURE both blank → must be today; both 0 → any date; only FUTURE → not beyond today+FUTURE; only PAST → not before today-PAST; else must be within both | L24-47 | KEEP |

**Bugs / oddities:** Non-numeric/negative checks come after cases that already used PAST/FUTURE, so they only fire when both are set.

## IV.LABELS

**Mode:** Utility/maintenance · **Lines:** 32 · **Relevance:** none

Prints keys from the active select list as text labels on a Blazer label printer via aux port.

**Files:** none · Calls: !SLEEP$  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| IV.LABELS.01 | Blazer printer command stream (font 24X31, origin 30,30) with characters space-separated | L2-25 | OBSOLETE |

## I_APTREE_EQUATE

**Mode:** Subroutine · **Lines:** 7 · **Relevance:** none

Include file that names TS() slots used by the AP B-tree index routines (TREE, ROOTID, PRG) and defines AM/DELIM/NILL constants.

**Files:** reads none · writes none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| I_APTREE_EQUATE.01 | Tree/index state is passed through a shared TS(30) array (TS(1)=TREE, TS(9)=ROOTID, TS(28)=PRG); a home-grown B-tree index is used instead of database indexes | L1-4 | OBSOLETE |

**Bugs / oddities:** identical in content to I_IV14EQ_COMMON.

## I_CLOSE.PORT

**Mode:** Subroutine · **Lines:** 14 · **Relevance:** none

Include that turns off the system printer or the terminal slave (aux) port depending on WORD.

**Files:** reads none · writes none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| I_CLOSE.PORT.01 | If destination WORD starts with 'F' close the system printer, otherwise send AUX.OFF to the terminal slave printer | L7-13 | OBSOLETE |

## I_IV14EQ_COMMON

**Mode:** Subroutine · **Lines:** 7 · **Relevance:** none

Include defining TS() tree-index equates (duplicate of I_APTREE_EQUATE).

**Files:** reads none · writes none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| I_IV14EQ_COMMON.01 | Same equates as I_APTREE_EQUATE (TREE=TS(1), ROOTID=TS(9), PRG=TS(28)) | L1-7 | OBSOLETE |

**Bugs / oddities:** name says COMMON but contains only EQUs.

## I_MV_COMMON

**Mode:** Subroutine · **Lines:** 28 · **Relevance:** none

COMMON include declaring TS(30), FILES(50), IV(150), AP(30), TL(12), SOLD(12) and the reserved file-slot equates.

**Files:** reads none · writes none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| I_MV_COMMON.01 | Same reserved FILES() slot map as I_IV46_COMMON (slots 17-20 unused) | L6-28 | OBSOLETE |

## I_OPEN.PORT

**Mode:** Subroutine · **Lines:** 27 · **Relevance:** none

Include that turns on the system printer or a terminal slave printer using terminal-specific escape codes.

**Files:** reads none · writes none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| I_OPEN.PORT.01 | Destination codes: F=system printer; AS/AP = ADDS 4000 serial/parallel; LS/LP = Link MC3 serial/parallel; OT = other aux; default nothing | L8-26 | OBSOLETE |

## I_RAWINP

**Mode:** Subroutine · **Lines:** 6 · **Relevance:** none

Include that reads one raw keystroke (KEYIN) for UniVerse.

**Files:** reads none · writes none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| I_RAWINP.01 | Single raw keystroke input via KEYIN() | L4 | OBSOLETE |

## I_TREE_EQUATE

**Mode:** Subroutine · **Lines:** 36 · **Relevance:** none

Include naming TS(1..29) slots for the home-grown B-tree index routines.

**Files:** reads none · writes none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| I_TREE_EQUATE.01 | Custom B-tree index state in TS() (TREE, HEIGHT, KEY, PTR, ROOTID, PREFIX/POSTFIX etc.) | L1-30 | OBSOLETE |

## LASER.TEST

**Mode:** Test-variant · **Lines:** 32 · **Relevance:** none

Test print of a sample cheque-like form with MICR font to the laser printer.

**Files:** reads none · writes none  
**Calls:** EXECUTE TERM

| ID | Rule | Source | Tag |
|---|---|---|---|
| LASER.TEST.01 | Prints sample data (JOHN Q. CUSTOMER, $1234.55, MICR line) — test only | L16-28 | OBSOLETE |

## LIST.BOX

**Mode:** Subroutine · **Lines:** 99 · **Relevance:** none

AccuTerm 2K2 helper that builds and runs a Windows script dialog listbox and returns the selected index (0 on cancel).

**Files:** none  
**Calls:** none (sends AccuTerm script escape sequence)

| ID | Rule | Source | Tag |
|---|---|---|---|
| LIST.BOX.01 | Terminal-emulator UI helper; dialog min width 250/height 100 dialog units; returns 1-based index or 0 | L20-21,53 | OBSOLETE |

**Bugs / oddities:** quote-fixup at L94 (ARG[1,J]:ARG[J,99999]) duplicates the quote character — intended, but loop increments K by 2 regardless of position.

## LJFONTS

**Mode:** Test-variant · **Lines:** 29 · **Relevance:** none

Test of check-print overlay config (CHKTEST, RBTCHK.BMP, HP8150) and MICR font.

**Files:** none  
**Calls:** EXECUTE SETPTR

| ID | Rule | Source | Tag |
|---|---|---|---|
| LJFONTS.01 | Printer/MICR font test; references rebate-check bitmap C:\PDFTEST\RBTCHK.BMP | L14 | OBSOLETE |

## MONEY

**Mode:** Subroutine · **Lines:** 21 · **Relevance:** PRICING

Validates an operator-typed money string and converts it to integer cents.

**Files:** none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| MONEY.01 | Accepts "N.", "N.n", "N.nn" or whole number; converts decimals to cents (N. -> N00, N.n -> Nn0, N.nn -> Nnn) | L6-17 | SIMPLIFY |
| MONEY.02 | Whole-number input with no decimal point is accepted unchanged — i.e. treated as cents, not dollars (typing 5 = $0.05) | L19 | QUESTION |

**Bugs / oddities:** L19 inconsistency: "12." becomes 1200 cents but "12" stays 12 cents. Negative values rejected.

## MONEY.CONV

**Mode:** Subroutine · **Lines:** 23 · **Relevance:** PRICING

Converts a foreign-currency amount tagged Y (yen) or R (renminbi) to USD using rates stored in CONTROL.

**Files:** reads CONTROL ('YEN.CONV' attr 2, 'RBI.CONV' attr 2) · writes none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| MONEY.CONV.01 | Amount with alpha prefix 'Y' converted = numeric * 10000 / CONTROL YEN.CONV attr 2 | L9-13 | KEEP |
| MONEY.CONV.02 | Prefix 'R' (renminbi) converted = numeric * 10000 / CONTROL RBI.CONV attr 2 | L14-18 | KEEP |
| MONEY.CONV.03 | Any other value returned unchanged (assumed USD) | L19 | KEEP |

**Bugs / oddities:** scale factor 10000 implies rate stored scaled (units of result unclear: cents vs dollars) — confirm; no rounding.

## P.OFF

**Mode:** Utility/maintenance · **Lines:** 2 · **Relevance:** none

Sends terminal escape ESC 4 (slave/aux printer off).

**Files:** none · writes none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| P.OFF.01 | Terminal pass-through printer off | L1 | OBSOLETE |

## P.ON

**Mode:** Utility/maintenance · **Lines:** 2 · **Relevance:** none

Sends terminal escape ESC 3 (slave/aux printer on).

**Files:** none · writes none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| P.ON.01 | Terminal pass-through printer on | L1 | OBSOLETE |

## PC.PRINTOFF

**Mode:** Utility/maintenance · **Lines:** 3 · **Relevance:** none

Turns off Windows PC printing and resets terminal to 80x24.

**Files:** none  
**Calls:** WIN.PRINTOFF

| ID | Rule | Source | Tag |
|---|---|---|---|
| PC.PRINTOFF.01 | Terminal printer helper | L1-2 | OBSOLETE |

## PC.PRINTON

**Mode:** Utility/maintenance · **Lines:** 3 · **Relevance:** none

Sets terminal to 132x57 and turns on Windows PC printing.

**Files:** none  
**Calls:** WIN.PRINTON

| ID | Rule | Source | Tag |
|---|---|---|---|
| PC.PRINTON.01 | Terminal printer helper | L1-2 | OBSOLETE |

## PRINT.132

**Mode:** Utility/maintenance · **Lines:** 3 · **Relevance:** none

Sends compressed-print / PCL 132-column codes to printer.

**Files:** none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| PRINT.132.01 | Printer escape helper | L1-2 | OBSOLETE |

## PRINT.132.JP

**Mode:** Utility/maintenance · **Lines:** 10 · **Relevance:** none

Turns on slave printer port at 132 chars (16.67 cpi).

**Files:** none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| PRINT.132.JP.01 | Printer escape helper | L5-8 | OBSOLETE |

## PRT.NR

**Mode:** Utility/maintenance · **Lines:** 4 · **Relevance:** none

Runs NEW.REPORT.PRT with aux printer on/off around it.

**Files:** none  
**Calls:** EXECUTE NEW.REPORT.PRT

| ID | Rule | Source | Tag |
|---|---|---|---|
| PRT.NR.01 | Aux printer wrapper | L1-3 | OBSOLETE |

## PRT.OFF

**Mode:** Utility/maintenance · **Lines:** 4 · **Relevance:** none

Aux printer off (ESC 4); duplicate of P.OFF.

**Files:** none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| PRT.OFF.01 | Aux printer off | L3 | OBSOLETE |

**Bugs / oddities:** duplicate of P.OFF.

## PRT.ON

**Mode:** Utility/maintenance · **Lines:** 4 · **Relevance:** none

Aux printer on (ESC 3); duplicate of P.ON.

**Files:** none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| PRT.ON.01 | Aux printer on | L3 | OBSOLETE |

**Bugs / oddities:** duplicate of P.ON.

## PURGE.PGM.AUDIT

**Mode:** Utility/maintenance · **Lines:** 40 · **Relevance:** none

Purges program-usage audit entries older than 30/60/90/120 days from PGM.AUDIT.

**Files:** reads/writes PGM.AUDIT  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| PURGE.PGM.AUDIT.01 | Retention must be exactly 30, 60, 90 or 120 days; operator confirms cutoff | L10-19 | SIMPLIFY |
| PURGE.PGM.AUDIT.02 | Removes every multivalue position (attrs 1-5) whose date (attr 1) < cutoff | L27-34 | SIMPLIFY |

**Bugs / oddities:** cutoff round-trips through D2/ (2-digit year) conversion (L14,20); empty records left in place.

## RAWINPUT

**Mode:** Subroutine · **Lines:** 86 · **Relevance:** none

Terminal full-line editor (raw keystroke input with insert mode, arrows, tab/esc/up/down actions).

**Files:** none  
**Calls:** INCLUDE I_RAWINP

| ID | Rule | Source | Tag |
|---|---|---|---|
| RAWINPUT.01 | Terminal line-edit helper; returns ACTION TAB/ESC/UP/DOWN/DEL; input forced uppercase | L19-34 | OBSOLETE |

**Bugs / oddities:** SCRCTL parameter vs SCRCT DIM name mismatch (L1,L5).

## RESIZE.FILES

**Mode:** Utility/maintenance · **Lines:** 35 · **Relevance:** none

DBA tool that runs RESIZE ... * * * on every file and dictionary in VOC (skipping paths that contain '/') and resizes each physical path once.

**Files:** reads VOC · writes none (UniVerse RESIZE)  
**Calls:** EXECUTE SELECTFL, RESIZE

| ID | Rule | Source | Tag |
|---|---|---|---|
| RESIZE.FILES.01 | Resizes every local file and dict (VOC attr 2/attr 3 paths without '/') once per physical path, using default sizing | L7-33 | OBSOLETE |

**Bugs / oddities:** HASH.AID.FILE is opened and never used. The program ends with RETURN, not STOP.

## SET.HP.132

**Mode:** Utility/maintenance · **Lines:** 16 · **Relevance:** none

Sends PCL reset/margin/16.66-cpi codes to set an HP printer to 132 columns.

**Files:** none · writes printer  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| SET.HP.132.01 | PCL printer setup string (reset, top/left margin 0, line-draw charset, 16.66 cpi) | L8-13 | OBSOLETE |

## SET.HP.80

**Mode:** Utility/maintenance · **Lines:** 15 · **Relevance:** none

Same as SET.HP.132 without the compressed-pitch code (80 columns).

**Files:** none · writes printer  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| SET.HP.80.01 | PCL printer reset/margin setup | L8-12 | OBSOLETE |

## SPOOL.ORDERS

**Mode:** Utility/maintenance · **Lines:** 42 · **Relevance:** none

Lists jobs on Unix spool queue PR1, lets the operator choose jobs, copies them to the &HOLD& file (through SETPROWHSE + SPOOL) and cancels them from the queue.

**Files:** reads UV.SPOOLQ · writes &HOLD& (via SPOOL)  
**Calls:** EXECUTE SH usa -p PR1, SETPROWHSE, SSELECT UV.SPOOLQ, SPOOL, SPOOL -CANCEL

| ID | Rule | Source | Tag |
|---|---|---|---|
| SPOOL.ORDERS.01 | Selected print jobs on queue PR1 (max 20) are respooled to the warehouse printer setup (SETPROWHSE) and cancelled from the original queue | L4-41 | OBSOLETE |

**Bugs / oddities:** Comma-list entries are not validated as numeric.

## T

**Mode:** Test-variant · **Lines:** 13 · **Relevance:** none

Test print of a PCL barcode font and two text fonts with sample strings.

**Files:** none · writes printer  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| T.01 | Printer font/barcode test only | L1-12 | OBSOLETE |

## TEST

**Mode:** Test-variant · **Lines:** 9 · **Relevance:** none

Developer test of LOCATE to find a second occurrence in a multivalue list.

**Files:** none · writes none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| TEST.01 | No business rule (developer scratch) | L1-9 | OBSOLETE |

## TEST.BC

**Mode:** Test-variant · **Lines:** 4 · **Relevance:** none

Prints a test barcode "*12345*" in a PCL barcode font.

**Files:** none · writes printer  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| TEST.BC.01 | Barcode print test only | L2 | OBSOLETE |

## TESTDATE

**Mode:** Test-variant · **Lines:** 4 · **Relevance:** none

Prints TIMEDATE() and its ICONV date conversion.

**Files:** none · writes none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| TESTDATE.01 | No business rule | L1-3 | OBSOLETE |

## TT

**Mode:** Test-variant · **Lines:** 5 · **Relevance:** none

Prints a test barcode "*72262*".

**Files:** none · writes printer  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| TT.01 | Barcode print test only | L2-3 | OBSOLETE |

## UPD.DICTS

**Mode:** Utility/maintenance · **Lines:** 20 · **Relevance:** none

Year-end utility that points the VOC entries of last year's archive files (APHIST.yy, ARHIST.yy, IVMST.yy, ORDHIST.yy etc.) at the shared live dictionaries.

**Files:** writes VOC  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| UPD.DICTS.01 | Yearly archive copies are made for APHIST, APBR, ARHIST, BVEND, IVEND, IVADJ, IVMST, IVPO, IVRET, IVSOLD, ORDHIST, RETURNS, SCANORD, RECLOG as `<FILE>.<yy>` (prior year). This shows the year-end archive policy and which files are archived. | L3-18 | QUESTION |
| UPD.DICTS.02 | ARHIST archives use the ARSHIP dictionary (D_ARSHIP), which confirms that ARHIST and ARSHIP share a record layout | L7 | KEEP |

**Bugs / oddities:** It assumes the archive VOC entries already exist (WRITEV on a missing VOC item creates a broken entry).

## UPDATE

**Mode:** Utility/maintenance · **Lines:** 27 · **Relevance:** none

Generic tool that overwrites one attribute (validated against the dictionary) with a fixed value on every record of an active select list, in any file.

**Files:** reads/writes any file (operator-chosen)  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| UPDATE.01 | Mass attribute overwrite with no audit. The attribute number must match the dict item's attr 2. A blank value is entered as 'NULL'. | L5-25 | OBSOLETE |

**Bugs / oddities:** Uncontrolled data-change backdoor. With no active select list, READNEXT ends immediately.

## WH.PRINT

**Mode:** Utility/maintenance · **Lines:** 27 · **Relevance:** none

Lets the warehouse choose which printer prints new orders and packing lists (CONTROL 'WH-PRINTERS').

**Files:** reads/writes CONTROL 'WH-PRINTERS'  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| WH.PRINT.01 | CONTROL 'WH-PRINTERS' attr 1 = new-order printer, attr 2 = packing-list printer. The choices are hard-coded: WH8100, PROWH, LABELS. UPS printing is not covered. | L5-24 | WAREHOUSE-ONLY |

## WHOAMI

**Mode:** Utility/maintenance · **Lines:** 2 · **Relevance:** none

Displays SYSTEM(42) (current session/terminal info).

**Files:** none · writes none  
**Calls:** none

| ID | Rule | Source | Tag |
|---|---|---|---|
| WHOAMI.01 | No business rule | L1 | OBSOLETE |

## WIN.FTP.DATA

**Mode:** Utility/maintenance · **Lines:** 23 · **Relevance:** none

Downloads the whole FTP.DATA file to the PC (directory from CONTROL 'FTP.DIR' attr 2, file IVDATA) via the wIntegrate terminal import.

**Files:** reads FTP.DATA, CONTROL · writes PC file  
**Calls:** WIN.IMPORT

| ID | Rule | Source | Tag |
|---|---|---|---|
| WIN.FTP.DATA.01 | Transfers all FTP.DATA items/fields as ASCII to `<FTP.DIR>\IVDATA` on the PC | L11-21 | OBSOLETE-INTEGRATION |

**Bugs / oddities:** The source account is hard-coded as "(PHOTOWARE".

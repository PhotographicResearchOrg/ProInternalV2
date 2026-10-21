/* ---------------------------------------------------------------
    Phase 2 · 11  SQL Agent job: nightly sales summary for the Rebate Desk

    Run once, after 10, by someone allowed to create SQL Agent jobs
    (on RDS: the master user). Safe to run twice: an existing job of
    the same name is left alone.

    Job:    PIV2 Rebate sales refresh
    Runs:   every night at 02:30 (server time)
    Step:   EXEC PRO_NUKE.piv2.Rebate_RefreshSales
            (rebuilds piv2.MemberSalesMonth, piv2.MemberName and
             piv2.RebateArCredit from [EDA].dbo.ARHistorical)
    Check:  SELECT TOP (10) * FROM PRO_NUKE.piv2.SalesRefreshLog ORDER BY RunId DESC;
    First fill without waiting for the night:
            EXEC msdb.dbo.sp_start_job @job_name = N'PIV2 Rebate sales refresh';
   --------------------------------------------------------------- */
USE msdb;
GO

IF NOT EXISTS (SELECT 1 FROM msdb.dbo.sysjobs WHERE name = N'PIV2 Rebate sales refresh')
BEGIN
    EXEC msdb.dbo.sp_add_job
         @job_name = N'PIV2 Rebate sales refresh',
         @description = N'Rebate Desk: nightly copy of member sales by PRO code and month, and AR rebate credits, from EDA.ARHistorical.',
         @enabled = 1;

    EXEC msdb.dbo.sp_add_jobstep
         @job_name = N'PIV2 Rebate sales refresh',
         @step_name = N'Rebuild sales summary',
         @subsystem = N'TSQL',
         @database_name = N'PRO_NUKE',
         @command = N'EXEC piv2.Rebate_RefreshSales;',
         @retry_attempts = 1,
         @retry_interval = 15;

    EXEC msdb.dbo.sp_add_jobschedule
         @job_name = N'PIV2 Rebate sales refresh',
         @name = N'Nightly 02:30',
         @freq_type = 4,              -- daily
         @freq_interval = 1,
         @active_start_time = 023000;

    EXEC msdb.dbo.sp_add_jobserver @job_name = N'PIV2 Rebate sales refresh', @server_name = N'(local)';

    PRINT N'Job created: PIV2 Rebate sales refresh (nightly 02:30).';
END
ELSE
    PRINT N'Job already exists; left as it is.';
GO

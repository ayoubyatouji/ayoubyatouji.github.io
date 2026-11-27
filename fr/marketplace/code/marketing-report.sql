-- Illustrative, read-only PostgreSQL query.
-- Replace the table and column names with an authorized reporting view.
SELECT
    date_trunc('month', report_date)::date AS report_month,
    source,
    SUM(clicks) AS clicks,
    SUM(conversions) AS conversions,
    CASE
        WHEN SUM(clicks) = 0 THEN NULL
        ELSE ROUND(SUM(conversions)::numeric / SUM(clicks), 4)
    END AS conversion_rate
FROM campaign_metrics
WHERE report_date >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

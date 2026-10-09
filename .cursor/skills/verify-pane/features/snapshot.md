# Snapshot scrolling migration

Snapshot scrolling is now the single [Scrolling layout](scrolling.md). Its full-width live-page behavior survives, with the former scrolling appearance and controls. The `snapshot` ID is a compatibility alias, not a picker or layout-menu choice. Legacy PR #3 records with either `snapshot` boolean restore the combined layout and retain column widths. Follow the scrolling recipe, including old-session migration and restart checks.

# Privacy

Pane runs locally inside Zen Browser. It has no accounts or telemetry and does not upload browsing data.

## Data used while running

The picker reads eligible open tabs’ titles, addresses, favicons, workspace identifiers, and recent-use ordering. It captures local page previews in memory. Experimental scrolling also captures visible pages to show its overview. These previews may contain visible page content; Pane does not upload them or deliberately write them to disk.

Settings load bundled files from Sine’s local chrome URI. This is separate from contacting an external service. Normal webpage requests and Sine’s installation/update requests are handled by Zen and Sine.

## Data saved locally

Zen’s preference service stores settings and update-guide delivery/acknowledgement state. SessionStore stores original tab placement (including existing Zen pinned-tab attributes), layout/group identifiers, the active tab, scrolling mode, and individual column widths. Local group identifiers associate tabs in a restored layout; they are not analytics identifiers.

Floating geometry and header pins are stored per tab in versioned local SessionStore records. Disabling Pane clears its presentation metadata and restores tracked tabs; browser shutdown retains metadata needed for session recovery. Zen manages its own tab/session storage independently.

## Diagnostics

Reports include versions, feature availability, loading status, and sanitized errors. They exclude tab titles, URLs, searches, browsing history, file paths, and stacks. Pane does not send reports automatically. Sharing a copied report is the user’s choice.

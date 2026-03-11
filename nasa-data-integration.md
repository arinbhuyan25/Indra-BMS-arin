# NASA Data Integration Plan

## Goal Description
Integrate the NASA battery dataset as a "NASA Data Explorer" tab in the React dashboard. This provides a direct, localized visualization of NASA battery degradation curves within the application, ensuring a seamless styling match with the main dashboard. Additionally, offline simulated data will be validated by this NASA dataset, while live UART data will dynamically adjust visible parameters to avoid presenting inauthentic information.

## Proposed Changes

### Dashboard Navigation & App Core
- **[MODIFY] App.jsx:** Add a 4th navigation tab (NASA DATA EXPLORER). Integrate conditionally rendered components per tab.
- **[MODIFY] App.jsx:** Update simulation loop logic to conditionally pull from the NASA mock JSON rather than simple random noise when the RISC-V board is disconnected. Ensure live mode hides parameters completely absent from the hardware feed (e.g., pure NASA-only fields) to preserve authenticity.

### NASA Data Explorer Component
- **[NEW] src/NASADataExplorer.jsx:** A top-level React component rendering the NASA battery datasets (e.g., Voltage/Capacity vs Cycle, SoH degradation). Following the `frontend-specialist` theme (Glassmorphism, dark metrics, neon accents).
- **[NEW] src/nasa_mock_data.json:** Contains a condensed mock representation of the NASA dataset (e.g., sample cycle, voltage, temperature, capacity metrics) for offline testing and 4th tab display.

## Verification Plan
### Automated Tests
- Run React local dev server and ensure console has no errors.
- Verify Recharts render without warning.

### Manual Verification
- Verify the "NASA DATA EXPLORER" tab switches cleanly.
- Verify that disconnecting the UART defaults to the NASA mock feed.
- Connect via simulated UART (or actual hardware if possible) and verify that "fake" metrics disappear.

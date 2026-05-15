import React from "react";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import { useOfflineSync } from "./hooks/useOfflineSync";

function App() {
  // Registers service worker and manages offline state globally
  const { isOnline, isSyncing } = useOfflineSync();

  return (
    <div>
      <AnalyticsDashboard
        userId="demo-user-001"
        isOnline={isOnline}
        isSyncing={isSyncing}
      />
    </div>
  );
}

export default App;

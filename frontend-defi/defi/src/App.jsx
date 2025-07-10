import "tailwindcss"
import { ConnectButton } from '@rainbow-me/rainbowkit'

function App() {
  return (
    <div className="app-wrapper">
      <div className="top-bar">
        <ConnectButton />
      </div>

      <div className="main-content">
        <h1>DeFi Lending App</h1>
        {/* Later: deposit, borrow, health factor, etc. */}
      </div>
    </div>
  );
}

export default App;
import App from "@/components/App";

// The Next server just serves the shell; the interactive nation runs client-side
// (localStorage stand-in for the chain). API routes for LLM/web3 land in phase 2.
export default function Page() {
  return <App />;
}

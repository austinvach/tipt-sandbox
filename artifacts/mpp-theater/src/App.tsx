import { Switch, Route, Router as WouterRouter } from "wouter";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Theater from "@/pages/Theater";
import SdkDemo from "@/pages/SdkDemo";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/vod" component={Theater} />
      <Route path="/sdk-demo" component={SdkDemo} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Router />
    </WouterRouter>
  );
}

export default App;
